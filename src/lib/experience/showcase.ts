// The Goodbye showcase replays the recorded visit through the same fold, sample,
// and map as the live layer (ADR-0009 §3), compressed to 60–90 s.

import type { Backdrop } from './backdrop.js';
import type { VisitEvent } from './events.js';
import {
  createFeatureState,
  fold,
  sample,
  type FeatureState,
} from './features.js';
import { map } from './mapping.js';
import type { ParameterFrame, Trigger } from './params.js';

export const SHOWCASE_MIN_MS = 60_000;
export const SHOWCASE_MAX_MS = 90_000;
const FULL_LENGTH_VISIT_MS = 30 * 60 * 1000;
export const MAX_CHECKPOINTS = 64;

/** Longer visits get a longer showcase, from 60 s up to 90 s at 30 minutes. */
export function showcaseDurationMs(visitMs: number): number {
  const share = Math.min(1, Math.max(0, visitMs) / FULL_LENGTH_VISIT_MS);
  return Math.round(
    SHOWCASE_MIN_MS + (SHOWCASE_MAX_MS - SHOWCASE_MIN_MS) * share,
  );
}

/** The visit time that a replay time shows. Never decreases as replayMs grows. */
export function visitTimeAt(
  replayMs: number,
  visitMs: number,
  showcaseMs: number,
): number {
  if (showcaseMs <= 0) return visitMs;
  const share = Math.min(1, Math.max(0, replayMs) / showcaseMs);
  return share * visitMs;
}

/** A replay position: events[0..index) are folded into state. */
export interface ReplayCursor {
  index: number;
  state: FeatureState;
}

export function startCursor(): ReplayCursor {
  return { index: 0, state: createFeatureState() };
}

/** Folds every event up to and including visit time `t`. Returns the new events. */
export function advance(
  cursor: ReplayCursor,
  events: readonly VisitEvent[],
  t: number,
): { cursor: ReplayCursor; folded: VisitEvent[] } {
  let { index, state } = cursor;
  const folded: VisitEvent[] = [];
  for (; index < events.length; index += 1) {
    const event = events[index];
    if (event === undefined || event.t > t) break;
    state = fold(state, event);
    folded.push(event);
  }
  return { cursor: { index, state }, folded };
}

/** One replay step: the frame at visit time `t` and the triggers since the last step. */
export function replayStep(
  cursor: ReplayCursor,
  events: readonly VisitEvent[],
  backdrop: Backdrop,
  t: number,
): { cursor: ReplayCursor; frame: ParameterFrame; triggers: Trigger[] } {
  const next = advance(cursor, events, t);
  const { frame, triggers } = map(
    sample(next.cursor.state, t),
    backdrop,
    next.folded,
  );
  return { cursor: next.cursor, frame, triggers };
}

/**
 * Snapshots of the folded state at even steps of visit time, so a replay can
 * start from the nearest snapshot and not from the first event.
 */
export function buildCheckpoints(
  events: readonly VisitEvent[],
  count: number,
): ReplayCursor[] {
  const total = Math.max(1, Math.min(MAX_CHECKPOINTS, Math.floor(count)));
  const end = events[events.length - 1]?.t ?? 0;
  const checkpoints: ReplayCursor[] = [startCursor()];
  let cursor = startCursor();
  for (let i = 1; i < total; i += 1) {
    cursor = advance(cursor, events, (end * i) / total).cursor;
    checkpoints.push({
      index: cursor.index,
      state: structuredClone(cursor.state),
    });
  }
  return checkpoints;
}

/** The latest checkpoint whose folded events all come at or before visit time `t`. */
export function seek(
  checkpoints: readonly ReplayCursor[],
  events: readonly VisitEvent[],
  t: number,
): ReplayCursor {
  let best = checkpoints[0] ?? startCursor();
  for (const checkpoint of checkpoints) {
    const lastFolded = events[checkpoint.index - 1];
    if (lastFolded === undefined || lastFolded.t <= t) best = checkpoint;
    else break;
  }
  return { index: best.index, state: structuredClone(best.state) };
}
