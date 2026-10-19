// The visit's event list and its stored form (ADR-0009 §5). Times are visit
// milliseconds since Enter. Stored events are delta-encoded tuples, so a record
// stays small and readable in the browser's developer tools.

import {
  ENVELOPE_VERSION,
  IDLE_EXPIRY_MS,
  type EnvelopeHeader,
} from './envelope.js';
import {
  GRID,
  isContinuous,
  quantizeTime,
  sanitizePath,
  type PageNav,
  type VisitEvent,
} from './events.js';

export const MAX_EVENTS = 12_000;
/** A gap between two events never counts as longer than the idle expiry. */
export const MAX_GAP_MS = IDLE_EXPIRY_MS;
const MAX_DT_MS = 86_400_000;
const MAX_SCROLL = 1000;
const NAVS: readonly PageNav[] = ['load', 'push', 'replace', 'traverse'];

export type AppendResult = 'added' | 'decimated' | 'full';

function lastTime(events: readonly VisitEvent[]): number {
  const last = events[events.length - 1];
  return last === undefined ? 0 : last.t;
}

/**
 * The stored time for a new event: rounded, never before the previous event, and
 * never more than MAX_GAP_MS after it (clock changes and sleep cannot break t).
 */
export function clampTime(event: VisitEvent, previousT: number): number {
  const step = event.kind === 'keystroke' ? 100 : 10;
  let t = quantizeTime(event.kind, event.t);
  if (t < previousT) t = Math.ceil(previousT / step) * step;
  if (t - previousT > MAX_GAP_MS) {
    t = Math.floor((previousT + MAX_GAP_MS) / step) * step;
  }
  return t;
}

/** Removes every second pointer or scroll event. Discrete events always stay. */
export function decimate(events: VisitEvent[]): void {
  let seen = 0;
  let write = 0;
  for (const event of events) {
    if (isContinuous(event)) {
      seen += 1;
      if (seen % 2 === 0) continue;
    }
    events[write] = event;
    write += 1;
  }
  events.length = write;
}

/** Adds an event in place. At the cap, it thins continuous events first. */
export function append(events: VisitEvent[], event: VisitEvent): AppendResult {
  const stored = { ...event, t: clampTime(event, lastTime(events)) };
  if (events.length < MAX_EVENTS) {
    events.push(stored);
    return 'added';
  }
  decimate(events);
  if (events.length < MAX_EVENTS) {
    events.push(stored);
    return 'decimated';
  }
  if (stored.kind === 'goodbye') {
    events.push(stored);
    return 'added';
  }
  return 'full';
}

type Tuple = (string | number)[];

const bit = (value: boolean): number => (value ? 1 : 0);

function encode(event: VisitEvent, dt: number): Tuple {
  switch (event.kind) {
    case 'enter':
      return ['e', dt];
    case 'page':
      return ['n', dt, event.path, NAVS.indexOf(event.nav)];
    case 'pointer':
      return ['p', dt, event.gx, event.gy];
    case 'click':
      return ['c', dt, event.gx, event.gy];
    case 'scroll':
      return ['s', dt, event.dy, event.dx];
    case 'keystroke':
      return ['k', dt];
    case 'visibility':
      return ['v', dt, bit(event.hidden)];
    case 'theme':
      return ['t', dt, bit(event.light)];
    case 'mute':
      return ['m', dt, bit(event.muted)];
    case 'motion':
      return ['o', dt, event.motion];
    case 'goodbye':
      return ['g', dt];
  }
}

/**
 * Encodes events[from..] as comma-joined tuple JSON. The storage adapter keeps the
 * earlier text and appends this, so a flush costs only the new events.
 */
export function encodeFrom(
  events: readonly VisitEvent[],
  from: number,
): string {
  const parts: string[] = [];
  let previous = from > 0 ? (events[from - 1]?.t ?? 0) : 0;
  for (let i = from; i < events.length; i += 1) {
    const event = events[i];
    if (event === undefined) continue;
    parts.push(JSON.stringify(encode(event, event.t - previous)));
    previous = event.t;
  }
  return parts.join(',');
}

/** The whole stored record, from a header and the joined tuple text. */
export function wrapEnvelope(header: EnvelopeHeader, tuples: string): string {
  return `{"v":${ENVELOPE_VERSION},"state":${JSON.stringify(header.state)},"enteredAtEpochMs":${header.enteredAtEpochMs},"savedAtEpochMs":${header.savedAtEpochMs},"key":${JSON.stringify(header.key)},"events":[${tuples}]}`;
}

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
