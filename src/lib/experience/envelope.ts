// The stored record's header: read by the startup script, so it stays small and
// imports only events.ts (ADR-0009 §1, §5). Tuple validation lives in timeline.ts.

export const STORAGE_KEY = 'experience:visit';
export const ENVELOPE_VERSION = 1;
export const MAX_RECORD_CHARS = 1_000_000;
/** Open decision 12 in the Phase A plan; these are the planner defaults. */
export const IDLE_EXPIRY_MS = 30 * 60 * 1000;
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const FUTURE_TOLERANCE_MS = 60 * 1000;

export type VisitState =
  'idle' | 'starting' | 'live' | 'goodbye' | 'ended' | 'failed';

const STATES: readonly VisitState[] = [
  'idle',
  'starting',
  'live',
  'goodbye',
  'ended',
  'failed',
];

export interface EnvelopeHeader {
  v: typeof ENVELOPE_VERSION;
  state: VisitState;
  enteredAtEpochMs: number;
  savedAtEpochMs: number;
  key: string;
}

export type EnvelopeRead =
  | { ok: true; header: EnvelopeHeader; events: unknown }
  | { ok: false; reason: 'missing' | 'invalid' | 'expired' };

const KEY_PATTERN = /^[0-9a-f]{64}$/;

function isEpoch(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isState(value: unknown): value is VisitState {
  return typeof value === 'string' && STATES.some((state) => state === value);
}

/**
 * Reads and checks a stored record. It reads named fields only and fails closed:
 * any doubt gives `invalid`, and an old record gives `expired` (ADR-0008 §4).
 */
export function readEnvelope(
  text: string | null,
  nowEpochMs: number,
): EnvelopeRead {
  if (text === null) return { ok: false, reason: 'missing' };
  if (text.length > MAX_RECORD_CHARS) return { ok: false, reason: 'invalid' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'invalid' };
  }
  const record = parsed as Record<string, unknown>;
  const v = record['v'];
  const state = record['state'];
  const enteredAtEpochMs = record['enteredAtEpochMs'];
  const savedAtEpochMs = record['savedAtEpochMs'];
  const key = record['key'];
  if (
    v !== ENVELOPE_VERSION ||
    !isState(state) ||
    !isEpoch(enteredAtEpochMs) ||
    !isEpoch(savedAtEpochMs) ||
    typeof key !== 'string' ||
    !KEY_PATTERN.test(key)
  ) {
    return { ok: false, reason: 'invalid' };
  }
  if (
    nowEpochMs - savedAtEpochMs > IDLE_EXPIRY_MS ||
    savedAtEpochMs - nowEpochMs > FUTURE_TOLERANCE_MS ||
    nowEpochMs - enteredAtEpochMs > MAX_AGE_MS
  ) {
    return { ok: false, reason: 'expired' };
  }
  return {
    ok: true,
    header: { v, state, enteredAtEpochMs, savedAtEpochMs, key },
    events: record['events'],
  };
}

/** A stored visit resumes only from these states; a stored goodbye counts as ended. */
export function canResume(state: VisitState): boolean {
  return state === 'live';
}
