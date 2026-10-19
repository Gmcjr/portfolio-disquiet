// Folds recorded events into a plain state, and samples that state at a visit
// time (ADR-0009 §3). The state is plain data, so it can be copied with
// structuredClone for showcase checkpoints. Nothing here reads a clock.

import { GRID, isActivity, type VisitEvent } from './events.js';

/** No input for this long counts as stillness (mapping row `stillness`). */
export const STILL_AFTER_MS = 3000;
/** Stillness reaches full strength at this length. */
export const STILL_FULL_MS = 10000;
/** Row `long-stillness` starts here. */
export const LONG_STILL_MS = 30000;
export const ORDER_WINDOW_MS = 10000;
export const TYPING_WINDOW_MS = 5000;
const TYPING_FULL_PER_S = 8;

export interface FeatureState {
  pointerX: number;
  pointerY: number;
  lastPointerT: number;
  lastPointerGx: number;
  lastPointerGy: number;
  pointerSpeed: number;
  lastActivityT: number;
  /** Hidden time since the last activity; stillness does not count it. */
  hiddenSinceActivityMs: number;
  hidden: boolean;
  hiddenSinceT: number;
  lastAbsenceMs: number;
  returnedAtT: number;
  activityTimes: number[];
  keyTimes: number[];
  scrollMomentum: number;
  lastScrollT: number;
  pages: string[];
  chordStep: number;
  firstChord: Record<string, number>;
  currentPath: string;
  pageEnteredT: number;
  lastRevisitT: number;
  revisitChord: number;
  lastBackT: number;
  light: boolean;
}

export interface Features {
  pointerX: number;
  pointerY: number;
  /** 0–1. */
  pointerSpeed: number;
  /** 0 (irregular input) – 1 (regular input), over the last 10 s. */
  order: number;
  stillMs: number;
  /** 0 below 3 s of stillness, rising to 1 at 10 s. */
  stillness: number;
  longStill: boolean;
  /** 0–1. */
  typingRate: number;
  chordStep: number;
  /** Ms since the visitor returned to a page seen before; Infinity if never. */
  revisitAgeMs: number;
  revisitChord: number;
  /** Ms since the last Back or Forward page change; Infinity if never. */
  backAgeMs: number;
  dwellMs: number;
  visitMs: number;
  hidden: boolean;
  /** Ms since the visitor came back to the tab; Infinity if never away. */
  returnAgeMs: number;
  lastAbsenceMs: number;
  /** -1 – 1, decaying after each scroll. */
  scrollMomentum: number;
  light: boolean;
}

export function createFeatureState(): FeatureState {
  return {
    pointerX: 0.5,
    pointerY: 0.5,
    lastPointerT: -1,
    lastPointerGx: GRID / 2,
    lastPointerGy: GRID / 2,
    pointerSpeed: 0,
    lastActivityT: 0,
    hiddenSinceActivityMs: 0,
    hidden: false,
    hiddenSinceT: 0,
    lastAbsenceMs: 0,
    returnedAtT: -1,
    activityTimes: [],
    keyTimes: [],
    scrollMomentum: 0,
    lastScrollT: 0,
    pages: [],
    chordStep: -1,
    firstChord: {},
    currentPath: '',
    pageEnteredT: 0,
    lastRevisitT: -1,
    revisitChord: 0,
    lastBackT: -1,
    light: false,
  };
}

const cellCenter = (cell: number): number => (cell + 0.5) / GRID;

const within = (
  times: readonly number[],
  t: number,
  windowMs: number,
): number[] => times.filter((time) => t - time <= windowMs);

/** Returns a new state; the input state is not changed. */
export function fold(state: FeatureState, event: VisitEvent): FeatureState {
  const next: FeatureState = {
    ...state,
    activityTimes: state.activityTimes,
    keyTimes: state.keyTimes,
    pages: state.pages,
    firstChord: state.firstChord,
  };
  const t = event.t;
  if (isActivity(event)) {
    next.lastActivityT = t;
    next.hiddenSinceActivityMs = 0;
    next.activityTimes = [
      ...within(state.activityTimes, t, ORDER_WINDOW_MS),
      t,
    ];
  }
  switch (event.kind) {
    case 'pointer':
    case 'click': {
      next.pointerX = cellCenter(event.gx);
      next.pointerY = cellCenter(event.gy);
      if (event.kind === 'pointer') {
        const dt = t - state.lastPointerT;
        if (state.lastPointerT >= 0 && dt > 0 && dt < 2000) {
          const cells = Math.hypot(
            event.gx - state.lastPointerGx,
            event.gy - state.lastPointerGy,
          );
          const screensPerSecond = cells / GRID / (dt / 1000);
          const instant = Math.min(1, screensPerSecond / 2);
          next.pointerSpeed = 0.7 * state.pointerSpeed + 0.3 * instant;
        }
        next.lastPointerT = t;
        next.lastPointerGx = event.gx;
        next.lastPointerGy = event.gy;
      }
      break;
    }
    case 'scroll': {
      const decayed = sampleMomentum(state, t);
      next.scrollMomentum = Math.max(-1, Math.min(1, decayed + event.dy / 100));
      next.lastScrollT = t;
      break;
    }
    case 'keystroke':
      next.keyTimes = [...within(state.keyTimes, t, TYPING_WINDOW_MS), t];
      break;
    case 'page': {
      if (event.nav === 'traverse') next.lastBackT = t;
      if (event.path === state.currentPath) break;
      const seen = state.firstChord[event.path];
      if (seen === undefined) {
        next.chordStep = state.chordStep + 1;
        next.firstChord = { ...state.firstChord, [event.path]: next.chordStep };
        next.pages = [...state.pages, event.path];
      } else {
        next.lastRevisitT = t;
        next.revisitChord = seen;
      }
      next.currentPath = event.path;
      next.pageEnteredT = t;
      break;
    }
    case 'visibility':
      if (event.hidden && !state.hidden) {
        next.hidden = true;
        next.hiddenSinceT = t;
      } else if (!event.hidden && state.hidden) {
        const away = t - state.hiddenSinceT;
        next.hidden = false;
        next.lastAbsenceMs = away;
        next.returnedAtT = t;
        next.hiddenSinceActivityMs = state.hiddenSinceActivityMs + away;
      }
      break;
    case 'theme':
      next.light = event.light;
      break;
    case 'enter':
    case 'mute':
    case 'motion':
    case 'goodbye':
      break;
  }
  return next;
}

function sampleMomentum(state: FeatureState, t: number): number {
  return (
    state.scrollMomentum * Math.exp(-Math.max(0, t - state.lastScrollT) / 600)
  );
}

function regularity(times: readonly number[]): number {
  if (times.length < 4) return 0.5;
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i += 1) {
    gaps.push((times[i] ?? 0) - (times[i - 1] ?? 0));
  }
  const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  if (mean <= 0) return 0.5;
  const variance =
    gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length;
  return Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / mean));
}

export function stillnessMs(state: FeatureState, t: number): number {
  const end = state.hidden ? state.hiddenSinceT : t;
  return Math.max(0, end - state.lastActivityT - state.hiddenSinceActivityMs);
}

export function sample(state: FeatureState, t: number): Features {
  const stillMs = stillnessMs(state, t);
  const sinceLastPointer =
    state.lastPointerT < 0 ? Infinity : t - state.lastPointerT;
  const keys = within(state.keyTimes, t, TYPING_WINDOW_MS).length;
  return {
    pointerX: state.pointerX,
    pointerY: state.pointerY,
    pointerSpeed: state.pointerSpeed * Math.exp(-sinceLastPointer / 1000),
    order: regularity(within(state.activityTimes, t, ORDER_WINDOW_MS)),
    stillMs,
    stillness:
      stillMs < STILL_AFTER_MS
        ? 0
        : Math.min(
            1,
            (stillMs - STILL_AFTER_MS) / (STILL_FULL_MS - STILL_AFTER_MS),
          ),
    longStill: stillMs >= LONG_STILL_MS,
    typingRate: Math.min(
      1,
      keys / (TYPING_WINDOW_MS / 1000) / TYPING_FULL_PER_S,
    ),
    chordStep: Math.max(0, state.chordStep),
    revisitAgeMs: state.lastRevisitT < 0 ? Infinity : t - state.lastRevisitT,
    revisitChord: state.revisitChord,
    backAgeMs: state.lastBackT < 0 ? Infinity : t - state.lastBackT,
    dwellMs: Math.max(0, t - state.pageEnteredT),
    visitMs: t,
    hidden: state.hidden,
    returnAgeMs: state.returnedAtT < 0 ? Infinity : t - state.returnedAtT,
    lastAbsenceMs: state.lastAbsenceMs,
    scrollMomentum: sampleMomentum(state, t),
    light: state.light,
  };
}
