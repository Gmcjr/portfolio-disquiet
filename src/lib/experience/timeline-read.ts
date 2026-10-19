// Rebuilds events from a stored record (ADR-0009 §5). Separate from timeline.ts
// so the startup code loads it only when a visit continues after a reload.

import { GRID, NAVS, sanitizePath, type VisitEvent } from './events.js';
import { MAX_EVENTS } from './timeline.js';

const MAX_DT_MS = 86_400_000;
const MAX_SCROLL = 1000;

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;

const isFlag = (value: unknown): value is 0 | 1 => value === 0 || value === 1;

function decode(tuple: unknown, previous: number): VisitEvent | null {
  if (!Array.isArray(tuple)) return null;
  const items: readonly unknown[] = tuple;
  const [tag, dt, a, b] = items;
  if (typeof tag !== 'string' || !isInt(dt, 0, MAX_DT_MS)) return null;
  const t = previous + dt;
  const arity = items.length;
  switch (tag) {
    case 'e':
      return arity === 2 ? { kind: 'enter', t } : null;
    case 'k':
      return arity === 2 ? { kind: 'keystroke', t } : null;
    case 'g':
      return arity === 2 ? { kind: 'goodbye', t } : null;
    case 'n': {
      const nav = isInt(b, 0, NAVS.length - 1) ? NAVS[b] : undefined;
      if (arity !== 4 || typeof a !== 'string' || nav === undefined)
        return null;
      return { kind: 'page', t, path: sanitizePath(a), nav };
    }
    case 'p':
    case 'c':
      if (arity !== 4 || !isInt(a, 0, GRID - 1) || !isInt(b, 0, GRID - 1)) {
        return null;
      }
      return { kind: tag === 'p' ? 'pointer' : 'click', t, gx: a, gy: b };
    case 's':
      if (
        arity !== 4 ||
        !isInt(a, -MAX_SCROLL, MAX_SCROLL) ||
        !isInt(b, -MAX_SCROLL, MAX_SCROLL)
      ) {
        return null;
      }
      return { kind: 'scroll', t, dy: a, dx: b };
    case 'v':
      return arity === 3 && isFlag(a)
        ? { kind: 'visibility', t, hidden: a === 1 }
        : null;
    case 't':
      return arity === 3 && isFlag(a)
        ? { kind: 'theme', t, light: a === 1 }
        : null;
    case 'm':
      return arity === 3 && isFlag(a)
        ? { kind: 'mute', t, muted: a === 1 }
        : null;
    case 'o':
      return arity === 3 && (a === 0 || a === 1 || a === 2)
        ? { kind: 'motion', t, motion: a }
        : null;
    default:
      return null;
  }
}

/**
 * Rebuilds events from stored tuples. A malformed tuple is dropped alone; its
 * neighbours survive. A non-array input gives no events.
 */
export function parseEvents(raw: unknown): {
  events: VisitEvent[];
  dropped: number;
} {
  if (!Array.isArray(raw)) return { events: [], dropped: 0 };
  const events: VisitEvent[] = [];
  let dropped = 0;
  let previous = 0;
  for (const tuple of raw as readonly unknown[]) {
    const event = decode(tuple, previous);
    if (event === null || events.length >= MAX_EVENTS) {
      dropped += 1;
      continue;
    }
    events.push(event);
    previous = event.t;
  }
  return { events, dropped };
}
