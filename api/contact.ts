import { Resend } from 'resend';
import { contactSchema, type ContactInput } from '../src/lib/contact-schema.js';
import { env } from './_env.js';

const BODY_SIZE_LIMIT = 16384;
const TIMING_FLOOR_MS = 1000;

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; kind: 'quota' | 'config' | 'other'; message: string };

export interface ContactDeps {
  sendEmail: (input: ContactInput) => Promise<SendEmailResult>;
  now: () => number;
  timeoutMs: number;
  env: { SITE_URL: string; VERCEL_ENV?: string; VERCEL_URL?: string };
  log: (event: string, fields: Record<string, unknown>) => void;
}

function problemResponse(
  siteUrl: string,
  status: number,
  slug: string,
  title: string,
  detail: string,
  extra?: Record<string, unknown>,
  headers?: Record<string, string>,
): Response {
  const body = {
    type: `${siteUrl}/problems/${slug}`,
    title,
    status,
    detail,
    ...extra,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/problem+json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function successResponse(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function allowedOriginPatterns(deps: ContactDeps): string[] {
  const patterns = [deps.env.SITE_URL];
  if (deps.env.VERCEL_ENV === 'preview') {
    patterns.push('https://*.vercel.app');
    if (deps.env.VERCEL_URL) {
      patterns.push(`https://${deps.env.VERCEL_URL}`);
    }
  }
  if (deps.env.VERCEL_ENV !== 'production') {
    patterns.push('http://localhost:*', 'http://127.0.0.1:*');
  }
  return patterns;
}

function originIsAllowed(origin: string, deps: ContactDeps): boolean {
  return allowedOriginPatterns(deps).some((pattern) => {
    if (!pattern.includes('*')) {
      return pattern === origin;
    }
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`).test(origin);
  });
}

export async function handleContact(
  req: Request,
  deps: ContactDeps,
): Promise<Response> {
  const siteUrl = deps.env.SITE_URL;

  if (req.method !== 'POST') {
    return problemResponse(
      siteUrl,
      405,
      'method-not-allowed',
      'Method not allowed',
      'This endpoint only accepts POST.',
      undefined,
      { Allow: 'POST' },
    );
  }

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.startsWith('application/json')) {
    return problemResponse(
      siteUrl,
      415,
      'unsupported-media-type',
      'Unsupported media type',
      'The request body must be application/json',
    );
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > BODY_SIZE_LIMIT) {
    return problemResponse(
      siteUrl,
      413,
      'payload-too-large',
      'Payload too large',
      'The request body exceeds the 16KB limit.',
    );
  }

  const raw = await req.text();
  const bodyBytes = Buffer.byteLength(raw, 'utf8');
  if (bodyBytes > BODY_SIZE_LIMIT) {
    return problemResponse(
      siteUrl,
      413,
      'payload-too-large',
      'Payload too large',
      'The request body exceeds the 16KB limit.',
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(raw);
  } catch {
    return problemResponse(
      siteUrl,
      400,
      'invalid-json',
      'Invalid JSON',
      'The request body is not valid JSON.',
    );
  }

  const origin = req.headers.get('origin');
  if (!origin || !originIsAllowed(origin, deps)) {
    return problemResponse(
      siteUrl,
      403,
      'origin-not-allowed',
      'Origin not allowed',
      "This request's origin is not permitted.",
    );
  }

  const result = contactSchema.safeParse(parsedBody);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      code: issue.code,
    }));
    return problemResponse(
      siteUrl,
      422,
      'validation-failed',
      'Validation failed',
      'One or more fields are invalid.',
      { errors },
    );
  }
  const input = result.data;

  const honeypotTripped = input._gotcha.length > 0;
  const timingOk = input.elapsedMs >= TIMING_FLOOR_MS;
  deps.log('contact.received', {
    origin,
    elapsedMs: input.elapsedMs,
    bodyBytes,
    honeypotTripped,
    timingOk,
  });

  // Honeypot: fake success
  if (honeypotTripped) {
    deps.log('contact.rejected', { reason: 'honeypot' });
    return successResponse();
  }

  // Timing floor: real error
  if (!timingOk) {
    deps.log('contact.rejected', { reason: 'timing' });
    return problemResponse(
      siteUrl,
      422,
      'submitted-too-fast',
      'That was quick - please try again',
      'The form was submitted unusually fast. Please try again.',
    );
  }

  // Step 9 (reserved): Insert future KV rate-limiter here. See ADR-0004

  const start = deps.now();
  const outcome = await Promise.race([
    deps.sendEmail(input),
    new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), deps.timeoutMs),
    ),
  ]);
  const durationMs = deps.now() - start;

  if (outcome === 'timeout') {
    deps.log('contact.send_failed', { resendErrorName: 'timeout', durationMs });
    return problemResponse(
      siteUrl,
      502,
      'email-delivery-failed',
      'Could not deliver your message',
      'Try again, or email me directly.',
    );
  }

  if (!outcome.ok) {
    deps.log('contact.send_failed', {
      resendErrorName: outcome.message,
      durationMs,
    });
    if (outcome.kind === 'quota') {
      return problemResponse(
        siteUrl,
        503,
        'email-service-unavailable',
        'The email service is temporarily unavailable',
        'Try again shortly, or email me directly.',
        undefined,
        {
          'Retry-After': '60',
        },
      );
    }
    if (outcome.kind === 'config') {
      return problemResponse(
        siteUrl,
        500,
        'configuration-error',
        'The contact service is misconfigured',
        'Something went wrong on my end. Please email me directly.',
      );
    }
    return problemResponse(
      siteUrl,
      502,
      'email-delivery-failed',
      'Could not deliver your message',
      'Try again, or email me directly.',
    );
  }

  deps.log('contact.sent', { resendId: outcome.id, durationMs });
  return successResponse();
}

async function sendEmail(input: ContactInput): Promise<SendEmailResult> {
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: env.CONTACT_FROM,
      to: [env.CONTACT_TO],
      replyTo: input.email,
      subject: `Portfolio contact - ${input.name}`,
      text: `From: ${input.name} <${input.email}>\n\n${input.message}`,
    });
    if (error) {
      if (
        error.name === 'rate_limit_exceeded' ||
        error.name === 'daily_quota_exceeded'
      ) {
        return { ok: false, kind: 'quota', message: error.name };
      }
      if (error.name === 'validation_error') {
        return { ok: false, kind: 'config', message: error.name };
      }
      return { ok: false, kind: 'other', message: error.name };
    }
    return { ok: true, id: data?.id ?? '' };
  } catch (thrown) {
    return {
      ok: false,
      kind: 'other',
      message: thrown instanceof Error ? thrown.message : 'unknown',
    };
  }
}

function log(event: string, fields: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), event, ...fields }),
  );
}

export default function handler(req: Request): Promise<Response> {
  return handleContact(req, {
    sendEmail,
    now: () => Date.now(),
    timeoutMs: 10_000,
    env: {
      SITE_URL: env.SITE_URL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
    },
    log,
  });
}
