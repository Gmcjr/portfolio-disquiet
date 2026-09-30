import { describe, expect, it, vi } from 'vitest';
import {
  handleContact,
  type ContactDeps,
  type SendEmailResult,
} from './contact';

const SITE_URL = 'https://disquiet.dev';

function makeDeps(overrides: Partial<ContactDeps> = {}): ContactDeps {
  return {
    sendEmail: () =>
      Promise.resolve({ ok: true, id: 'test-id' } satisfies SendEmailResult),
    now: () => 0,
    timeoutMs: 50,
    env: { SITE_URL, VERCEL_ENV: undefined, VERCEL_URL: undefined },
    log: vi.fn(),
    ...overrides,
  };
}

function makeRequest(options: {
  method?: string;
  contentType?: string;
  origin?: string;
  body?: unknown;
  rawBody?: string;
}): Request {
  const headers = new Headers();
  if (options.contentType !== undefined)
    headers.set('content-type', options.contentType);
  if (options.origin !== undefined) headers.set('origin', options.origin);
  const bodyText =
    options.rawBody ??
    (options.body !== undefined ? JSON.stringify(options.body) : undefined);
  const method = options.method ?? 'POST';
  const canHaveBody = method !== 'GET' && method !== 'HEAD';
  return new Request('http://x/api/contact', {
    method,
    headers,
    body: canHaveBody ? bodyText : undefined,
  });
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    message: 'Hello there',
    _gotcha: '',
    elapsedMs: 2000,
    ...overrides,
  };
}

describe('handleContact', () => {
  it('rejects non-POST with 405', async () => {
    const req = makeRequest({ method: 'GET' });
    const res = await handleContact(req, makeDeps());
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
  });

  it('rejects a non-JSON content-type with 415', async () => {
    const req = makeRequest({
      contentType: 'text/plain',
      origin: SITE_URL,
      rawBody: 'hi',
    });
    const res = await handleContact(req, makeDeps());
    expect(res.status).toBe(415);
  });

  it('accepts a content-type with a charset suffix', async () => {
    const req = makeRequest({
      contentType: 'application/json;charset=utf-8',
      origin: SITE_URL,
      body: validPayload(),
    });
    const res = await handleContact(req, makeDeps());
    expect(res.status).toBe(200);
  });

  it('rejects a body over the 16KB limit', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      origin: SITE_URL,
      body: validPayload({ message: 'x'.repeat(20000) }),
    });
    const res = await handleContact(req, makeDeps());
    expect(res.status).toBe(413);
  });

  it('rejects malformed JSON with 400', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      origin: SITE_URL,
      rawBody: '{not json',
    });
    const res = await handleContact(req, makeDeps());
    expect(res.status).toBe(400);
  });

  it('rejects a missing Origin with 403', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      body: validPayload(),
    });
    const res = await handleContact(req, makeDeps());
    expect(res.status).toBe(403);
  });

  it('rejects an origin not on the allow-list', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      origin: 'https://evil.example.com',
      body: validPayload(),
    });
    const res = await handleContact(req, makeDeps());
    expect(res.status).toBe(403);
  });

  it('rejects an origin that only contains vercel.app as a substring', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      origin: 'https://foo.vercel.app.attacker.com',
      body: validPayload(),
    });
    const res = await handleContact(
      req,
      makeDeps({
        env: { SITE_URL, VERCEL_ENV: 'preview', VERCEL_URL: undefined },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('allows a *.vercel.app origin on preview', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      origin: 'https://my-branch.vercel.app',
      body: validPayload(),
    });
    const res = await handleContact(
      req,
      makeDeps({
        env: { SITE_URL, VERCEL_ENV: 'preview', VERCEL_URL: undefined },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('allows localhost outside production', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      origin: 'http://localhost:4321',
      body: validPayload(),
    });
    const res = await handleContact(
      req,
      makeDeps({
        env: { SITE_URL, VERCEL_ENV: 'development', VERCEL_URL: undefined },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('rejects localhost in production', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      origin: 'http://localhost:4321',
      body: validPayload(),
    });
    const res = await handleContact(
      req,
      makeDeps({
        env: { SITE_URL, VERCEL_ENV: 'production', VERCEL_URL: undefined },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('rejects invalid fields with 422 and a field-level errors list', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      origin: SITE_URL,
      body: validPayload({ email: 'not-an-email', name: '' }),
    });
    const res = await handleContact(req, makeDeps());
    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors: unknown[] };
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it('returns a fake 200 when the honeypot is filled', async () => {
    const log = vi.fn();
    const req = makeRequest({
      contentType: 'application/json',
      origin: SITE_URL,
      body: validPayload({ _gotcha: 'i-am-a-bot' }),
    });
    const res = await handleContact(req, makeDeps({ log }));
    expect(res.status).toBe(200);
    expect(log).not.toHaveBeenCalledWith('contact.sent', expect.anything());
  });

  it('returns a visible 422 when submitted too fast', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      origin: SITE_URL,
      body: validPayload({ elapsedMs: 999 }),
    });
    const res = await handleContact(req, makeDeps());
    expect(res.status).toBe(422);
    const body = (await res.json()) as { type: string; errors?: unknown };
    expect(body.type).toContain('submitted-too-fast');
    expect(body.errors).toBeUndefined();
  });

  it('accepts elapsedMs at exactly the timing floor', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      origin: SITE_URL,
      body: validPayload({ elapsedMs: 1000 }),
    });
    const res = await handleContact(req, makeDeps());
    expect(res.status).toBe(200);
  });

  it('maps a quota error to 503 with Retry-After', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      origin: SITE_URL,
      body: validPayload(),
    });
    const res = await handleContact(
      req,
      makeDeps({
        sendEmail: () =>
          Promise.resolve({
            ok: false,
            kind: 'quota',
            message: 'rate_limit_exceeded',
          }),
      }),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('maps a config error to 500', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      origin: SITE_URL,
      body: validPayload(),
    });
    const res = await handleContact(
      req,
      makeDeps({
        sendEmail: () =>
          Promise.resolve({
            ok: false,
            kind: 'config',
            message: 'validation_error',
          }),
      }),
    );
    expect(res.status).toBe(500);
  });

  it('maps any other send failure to 502', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      origin: SITE_URL,
      body: validPayload(),
    });
    const res = await handleContact(
      req,
      makeDeps({
        sendEmail: () =>
          Promise.resolve({
            ok: false,
            kind: 'other',
            message: 'network_error',
          }),
      }),
    );
    expect(res.status).toBe(502);
  });

  it('maps a timeout to 502', async () => {
    const req = makeRequest({
      contentType: 'application/json',
      origin: SITE_URL,
      body: validPayload(),
    });
    const res = await handleContact(
      req,
      makeDeps({ timeoutMs: 5, sendEmail: () => new Promise(() => {}) }),
    );
    expect(res.status).toBe(502);
  });

  it('returns 200 and logs contact.sent on success', async () => {
    const log = vi.fn();
    const req = makeRequest({
      contentType: 'application/json',
      origin: SITE_URL,
      body: validPayload(),
    });
    const res = await handleContact(req, makeDeps({ log }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(log).toHaveBeenCalledWith(
      'contact.sent',
      expect.objectContaining({ resendId: 'test-id' }),
    );
  });

  it('every non-2xx response uses application/problem+json', async () => {
    const req = makeRequest({ method: 'GET' });
    const res = await handleContact(req, makeDeps());
    expect(res.headers.get('Content-Type')).toBe('application/problem+json');
  });
});
