// Test inputs made from a seeded generator, so every failure reproduces exactly.

import type { VisitEvent } from '../events.js';

export const SEED_A =
  'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
export const SEED_B =
  '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0';
export const PROPERTY_RUNS = 200;

const PATHS = ['/', '/work/', '/work/barta/', '/about/', '/contact/'];

/** A plausible visit: an enter, a first page, then mixed input. */
export function randomStream(rand: () => number, count: number): VisitEvent[] {
  const events: VisitEvent[] = [
    { kind: 'enter', t: 0 },
    { kind: 'page', t: 0, path: '/experience/', nav: 'load' },
  ];
  let t = 0;
  let hidden = false;
  for (let i = 0; i < count; i += 1) {
    t += Math.floor(rand() * 900) + 10;
    const roll = rand();
    const gx = Math.floor(rand() * 64);
    const gy = Math.floor(rand() * 64);
    if (roll < 0.45) events.push({ kind: 'pointer', t, gx, gy });
    else if (roll < 0.55) events.push({ kind: 'click', t, gx, gy });
    else if (roll < 0.65) {
      events.push({
        kind: 'scroll',
        t,
        dy: Math.floor(rand() * 200) - 100,
        dx: 0,
      });
    } else if (roll < 0.8) events.push({ kind: 'keystroke', t });
    else if (roll < 0.88) {
      const path = PATHS[Math.floor(rand() * PATHS.length)] ?? '/';
      events.push({
        kind: 'page',
        t,
        path,
        nav: rand() < 0.2 ? 'traverse' : 'push',
      });
    } else if (roll < 0.93) {
      hidden = !hidden;
      events.push({ kind: 'visibility', t, hidden });
    } else if (roll < 0.96)
      events.push({ kind: 'theme', t, light: rand() < 0.5 });
    else if (roll < 0.98) events.push({ kind: 'mute', t, muted: rand() < 0.5 });
    else events.push({ kind: 'motion', t, motion: 0 });
  }
  return events;
}

/** A burst of fast clicks: the worst case for the flash limit. */
export function clickBurst(
  start: number,
  count: number,
  gapMs: number,
): VisitEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    kind: 'click' as const,
    t: start + i * gapMs,
    gx: (i * 7) % 64,
    gy: (i * 13) % 64,
  }));
}
