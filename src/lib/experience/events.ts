// What the visitor did, never a sound or an image (ADR-0009 §3). This module is
// the whole recorded data set (ADR-0008 §4): coarse grid cells, scroll amounts,
// key-press times only, page paths only.

/** Grid cells per axis for pointer and click positions. A maximum, never finer. */
export const GRID = 64;

export type PageNav = 'load' | 'push' | 'replace' | 'traverse';

export type VisitEvent =
  | { kind: 'enter'; t: number }
  | { kind: 'page'; t: number; path: string; nav: PageNav }
  | { kind: 'pointer'; t: number; gx: number; gy: number }
  | { kind: 'click'; t: number; gx: number; gy: number }
  | { kind: 'scroll'; t: number; dy: number; dx: number }
  | { kind: 'keystroke'; t: number }
  | { kind: 'visibility'; t: number; hidden: boolean }
  | { kind: 'theme'; t: number; light: boolean }
  | { kind: 'mute'; t: number; muted: boolean }
  | { kind: 'motion'; t: number; motion: 0 | 1 | 2 }
  | { kind: 'goodbye'; t: number };

export type VisitEventKind = VisitEvent['kind'];

/** Pointer, click, scroll, and key presses count as activity; the rest does not. */
export function isActivity(event: VisitEvent): boolean {
  return (
    event.kind === 'pointer' ||
    event.kind === 'click' ||
    event.kind === 'scroll' ||
    event.kind === 'keystroke'
  );
}

/** Pointer and scroll events are continuous: the timeline may thin them. */
export function isContinuous(event: VisitEvent): boolean {
  return event.kind === 'pointer' || event.kind === 'scroll';
}

const KEY_STEP_MS = 100;
const DEFAULT_STEP_MS = 10;

/**
 * Rounds a visit time before it is stored (security review D-2). Key-press times
 * round to 100 ms so the record holds no fine typing rhythm; other times to 10 ms.
 */
export function quantizeTime(kind: VisitEventKind, t: number): number {
  const step = kind === 'keystroke' ? KEY_STEP_MS : DEFAULT_STEP_MS;
  return Math.max(0, Math.round(t / step) * step);
}

/** A cell index from a position in [0, 1). Out-of-range input clamps to the edge. */
export function toCell(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(GRID - 1, Math.max(0, Math.floor(fraction * GRID)));
}

const SAFE_PATH = /^\/[A-Za-z0-9._~%/-]{0,255}$/;

/** A path that is safe to store and show. Anything else becomes "/". */
export function sanitizePath(path: string): string {
  return SAFE_PATH.test(path) && !path.startsWith('//') ? path : '/';
}
