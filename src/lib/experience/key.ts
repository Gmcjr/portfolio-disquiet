// The visit key (ADR-0008 §2): an artistic device, not a security feature. Each
// start value is hashed alone, the hashes are put in an order that the random
// bytes decide, and the ordered list is hashed into one key. Only the key is
// stored; the start values are dropped after this.

const MASK_64 = (1n << 64n) - 1n;

/**
 * Xorshift64* generator seeded from the first 16 hex characters of a string.
 * Callers take independent streams from different slices of one key.
 */
export function createPRNG(seedHex: string): () => number {
  const head = seedHex.slice(0, 16);
  let state = /^[0-9a-f]{16}$/.test(head) ? BigInt('0x' + head) : 0n;
  // Xorshift never leaves the all-zero state.
  if (state === 0n) state = 0x9e3779b97f4a7c15n;
  return () => {
    state ^= state >> 12n;
    state ^= (state << 25n) & MASK_64;
    state ^= state >> 27n;
    const result = (state * 2685821657736338717n) & MASK_64;
    // Top 53 bits → a float in [0, 1).
    return Number(result >> 11n) / 2 ** 53;
  };
}

/** SHA-256 of a string, as 64 hex characters. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export type ReferrerCategory = 'none' | 'internal' | 'external';

export interface StartValues {
  /** Random bytes as hex, from crypto.getRandomValues. */
  entropyHex: string;
  epochMs: number;
  timeZone: string;
  theme: 'dark' | 'light';
  viewportWidth: number;
  viewportHeight: number;
  referrer: ReferrerCategory;
}

/**
 * The referrer as a category only (security review D-2). The caller discards the
 * referrer string at once; this function never returns any part of it.
 */
export function referrerCategory(
  referrer: string,
  ownOrigin: string,
): ReferrerCategory {
  if (referrer === '') return 'none';
  try {
    return new URL(referrer).origin === ownOrigin ? 'internal' : 'external';
  } catch {
    return 'external';
  }
}

/** Fisher–Yates shuffle with an injected generator; returns a new array. */
export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) continue;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

export async function deriveKey(values: StartValues): Promise<string> {
  const fields = [
    `entropy:${values.entropyHex}`,
    `epoch:${values.epochMs}`,
    `zone:${values.timeZone}`,
    `theme:${values.theme}`,
    `viewport:${values.viewportWidth}x${values.viewportHeight}`,
    `referrer:${values.referrer}`,
  ];
  const hashes = await Promise.all(fields.map((field) => sha256Hex(field)));
  // The random order: each hash is ranked by a hash of itself and the random
  // bytes. Same values, same order; new random bytes, a new order.
  const ranks = await Promise.all(
    hashes.map((hash) => sha256Hex(`${values.entropyHex}|${hash}`)),
  );
  const order = hashes
    .map((hash, i) => ({ hash, rank: ranks[i] ?? '' }))
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
  return sha256Hex(order.map((item) => item.hash).join('|'));
}
