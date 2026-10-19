// The visit seal (ADR-0008, user decision 8): one hash over the key and every
// recorded event, in order. It comes from random numbers and the visit itself, so
// it cannot identify a visitor or a device. It is computed once, at Goodbye.

import type { VisitEvent } from './events.js';
import { sha256Hex } from './key.js';
import { encodeFrom } from './timeline.js';

export const SEAL_DISPLAY_CHARS = 16;

export function computeSeal(
  key: string,
  events: readonly VisitEvent[],
): Promise<string> {
  return sha256Hex(`${key}|${encodeFrom(events, 0)}`);
}

export function displaySeal(seal: string): string {
  return seal.slice(0, SEAL_DISPLAY_CHARS);
}
