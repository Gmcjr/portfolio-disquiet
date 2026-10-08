import type { DerivedTokens } from './types.js';

/** Simple Xorshift64* PRNG seeded from a SHA-256 hex string. */
function createPRNG(seedHex: string): () => number {
  // Convert first 16 chars (64 bits) to bigint
  let state = BigInt('0x' + seedHex.slice(0, 16));
  return () => {
    // Xorshift64*
    state ^= state >> 12n;
    state ^= state << 25n;
    state ^= state >> 27n;
    const result = (state * 2685821657736338717n) & ((1n << 64n) - 1n);
    // Return float in [0,1)
    return Number(result) / 2 ** 64;
  };
}

/** Map a seed to deterministic UI tokens. */
export function deriveTokens(seed: string): DerivedTokens {
  const rand = createPRNG(seed);

  const hue = Math.floor(rand() * 360);
  const opacity = rand();
  const fontIdx = Math.floor(rand() * 3);

  const oscTypes: DerivedTokens['synth']['oscType'][] = [
    'sine',
    'square',
    'triangle',
    'sawtooth',
  ];
  const oscType = oscTypes[Math.floor(rand() * oscTypes.length)] ?? 'sine';
  const synth = {
    oscType,
    detune: Math.round((rand() - 0.5) * 2400), // -1200 .. +1200 cents
    reverb: Math.round(rand() * 2 * 10) / 10, // 0-2 s, one-decimal precision
  };

  const sketch = {
    shapeCount: Math.floor(rand() * 12) + 4, // 4-15 shapes
    bgHue: Math.floor(rand() * 360),
  };

  return { hue, opacity, fontIdx, synth, sketch };
}
