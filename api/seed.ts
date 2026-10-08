import { createHash, randomUUID } from 'crypto';

/**
 * Serverless function that returns a deterministic seed for the visitor.
 * The seed is SHA-256 of `${ip}|${sessionId}|${timestamp}` where:
 *   - ip: value of the `x-forwarded-for` header (may be a comma-separated list; we take the first).
 *   - sessionId: a persistent HttpOnly cookie. If missing we create one.
 *   - timestamp: optional `ts` query-parameter (client `Date.now()`).
 *
 * The response is `{ "seed": "<hex>" }` with `application/json`.
 * All non-GET methods and any validation error are returned as RFC 9457
 * `application/problem+json` just like the contact function.
 */

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

function successResponse(seed: string, setCookie?: string): Response {
  const hdrs: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  if (setCookie) hdrs['Set-Cookie'] = setCookie;
  return new Response(JSON.stringify({ seed }), { status: 200, headers: hdrs });
}

/** Extract the first IP from the X-Forwarded-For header. */
function getIp(req: Request): string {
  const header = req.headers.get('x-forwarded-for') ?? '';
  const firstIp = header.split(',')[0] ?? '';
  return firstIp.trim() || 'unknown';
}

/** Parse the `sessionId` cookie; if missing generate a new one and return the Set-Cookie header. */
function getSessionId(req: Request): { sessionId: string; setCookie?: string } {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/(?:^|; )sessionId=([^;]+)/);
  if (match?.[1]) {
    return { sessionId: match[1] };
  }
  const newId = randomUUID();
  // HttpOnly, Secure, SameSite=Strict, Path=/
  const setCookie = `sessionId=${newId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=31536000`;
  return { sessionId: newId, setCookie };
}

export function handleSeed(req: Request, siteUrl: string): Response {
  if (req.method !== 'GET') {
    return problemResponse(
      siteUrl,
      405,
      'method-not-allowed',
      'Method not allowed',
      'Only GET is supported for the seed endpoint.',
      undefined,
      { Allow: 'GET' },
    );
  }

  // Extract optional timestamp from query string (client-side salt).
  const url = new URL(req.url);
  const ts = url.searchParams.get('ts') ?? '';

  const ip = getIp(req);
  const { sessionId, setCookie } = getSessionId(req);

  // Compute SHA-256 hash.
  const hash = createHash('sha256');
  hash.update(`${ip}|${sessionId}|${ts}`);
  const seed = hash.digest('hex');

  return successResponse(seed, setCookie);
}

export default {
  async fetch(request: Request): Promise<Response> {
    const siteUrl = new URL(request.url).origin;
    await Promise.resolve();
    return handleSeed(request, siteUrl);
  },
};
