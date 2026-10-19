// Turns visitor input into VisitEvents (ADR-0008 §4). It reads events only
// through narrow types: positions become coarse grid cells at once, a key press
// is a count and a time, and nothing inside a form field counts. Page paths come
// from the session, so this module never reads the URL.

import { GRID, toCell, type VisitEvent } from '../../../lib/experience/events';

/** Inside these, nothing is recorded: form fields and the experience's own controls. */
export const EXCLUDED =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], #experience-layer';

const POINTER_MIN_MS = 100;
const SCROLL_MIN_MS = 250;
const SWIPE_MIN_SHARE = 0.1;
const SCROLL_LIMIT = 1000;

type PathEvent = { composedPath(): EventTarget[] };
type PointerInput = PathEvent & Pick<MouseEvent, 'clientX' | 'clientY'>;
type ClickInput = PointerInput & Pick<MouseEvent, 'detail'>;
type KeyInput = PathEvent & Pick<KeyboardEvent, 'repeat' | 'isComposing'>;
type TouchInput = PathEvent & {
  changedTouches: ArrayLike<Pick<Touch, 'clientX' | 'clientY'>>;
};

export interface RecorderView {
  /** The window: scroll position and viewport size. */
  scrollX: number;
  scrollY: number;
  innerWidth: number;
  innerHeight: number;
  addEventListener: Window['addEventListener'];
  removeEventListener: Window['removeEventListener'];
}

export interface RecorderDeps {
  doc: Document;
  view: RecorderView;
  /** Visit time in milliseconds since Enter. */
  visitNow: () => number;
  emit: (event: VisitEvent) => void;
  createObserver: (
    callback: () => void,
  ) => Pick<MutationObserver, 'observe' | 'disconnect'>;
}

export interface Recorder {
  start(): void;
  stop(): void;
  /** While suspended (a page change), scroll is not counted: the router moves it. */
  suspend(suspended: boolean): void;
}

export function isExcluded(path: readonly EventTarget[]): boolean {
  return path.some(
    (target) =>
      typeof Element !== 'undefined' &&
      target instanceof Element &&
      target.matches(EXCLUDED),
  );
}

const clampScroll = (value: number): number =>
  Math.round(Math.max(-SCROLL_LIMIT, Math.min(SCROLL_LIMIT, value)));

export function createRecorder(deps: RecorderDeps): Recorder {
  const { doc, view } = deps;
  let width = view.innerWidth || 1;
  let height = view.innerHeight || 1;
  let lastPointerT = -Infinity;
  let lastCell = { gx: GRID / 2, gy: GRID / 2 };
  let lastScrollT = -Infinity;
  let scrollFrom = { x: view.scrollX, y: view.scrollY };
  let scrolledSinceTouch = false;
  let touchStart: { x: number; y: number } | null = null;
  let suspended = false;
  let lastLight: boolean | null = null;
  let observer: Pick<MutationObserver, 'disconnect'> | null = null;

  const cellOf = (x: number, y: number) => ({
    gx: toCell(x / width),
    gy: toCell(y / height),
  });

  const onResize = (): void => {
    width = view.innerWidth || 1;
    height = view.innerHeight || 1;
  };

  const onPointer = (event: PointerInput): void => {
    if (isExcluded(event.composedPath())) return;
    const t = deps.visitNow();
    const cell = cellOf(event.clientX, event.clientY);
    if (t - lastPointerT < POINTER_MIN_MS) return;
    if (cell.gx === lastCell.gx && cell.gy === lastCell.gy) return;
    lastPointerT = t;
    lastCell = cell;
    deps.emit({ kind: 'pointer', t, ...cell });
  };

  const onClick = (event: ClickInput): void => {
    if (isExcluded(event.composedPath())) return;
    // A keyboard click has no position; use the last pointer cell.
    const cell =
      event.detail > 0 ? cellOf(event.clientX, event.clientY) : lastCell;
    deps.emit({ kind: 'click', t: deps.visitNow(), ...cell });
  };

  const onScroll = (): void => {
    scrolledSinceTouch = true;
    if (suspended) {
      scrollFrom = { x: view.scrollX, y: view.scrollY };
      return;
    }
    const t = deps.visitNow();
    if (t - lastScrollT < SCROLL_MIN_MS) return;
    const dy = clampScroll(((view.scrollY - scrollFrom.y) / height) * 100);
    const dx = clampScroll(((view.scrollX - scrollFrom.x) / width) * 100);
    scrollFrom = { x: view.scrollX, y: view.scrollY };
    lastScrollT = t;
    if (dy !== 0 || dx !== 0) deps.emit({ kind: 'scroll', t, dy, dx });
  };

  const onTouchStart = (event: TouchInput): void => {
    const touch = event.changedTouches[0];
    if (touch === undefined || isExcluded(event.composedPath())) {
      touchStart = null;
      return;
    }
    scrolledSinceTouch = false;
    touchStart = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchInput): void => {
    const touch = event.changedTouches[0];
    const start = touchStart;
    touchStart = null;
    // A swipe that scrolled the page is already a scroll event.
    if (touch === undefined || start === null || scrolledSinceTouch) return;
    const dy = (start.y - touch.clientY) / height;
    const dx = (start.x - touch.clientX) / width;
    if (Math.max(Math.abs(dy), Math.abs(dx)) < SWIPE_MIN_SHARE) return;
    deps.emit({
      kind: 'scroll',
      t: deps.visitNow(),
      dy: clampScroll(dy * 100),
      dx: clampScroll(dx * 100),
    });
  };

  const onKey = (event: KeyInput): void => {
    if (event.repeat || event.isComposing || isExcluded(event.composedPath()))
      return;
    deps.emit({ kind: 'keystroke', t: deps.visitNow() });
  };

  const onVisibility = (): void => {
    deps.emit({
      kind: 'visibility',
      t: deps.visitNow(),
      hidden: doc.visibilityState === 'hidden',
    });
  };

  const readTheme = (): void => {
    const light = doc.documentElement.dataset['theme'] === 'light';
    // ClientRouter rewrites <html> attributes on every page change; record changes only.
    if (light === lastLight) return;
    const first = lastLight === null;
    lastLight = light;
    if (!first) deps.emit({ kind: 'theme', t: deps.visitNow(), light });
  };

  const passive = { passive: true } as const;
  const listeners: [EventTarget, string, EventListener][] = [
    [doc, 'pointermove', onPointer as unknown as EventListener],
    [doc, 'click', onClick as unknown as EventListener],
    [doc, 'keydown', onKey as unknown as EventListener],
    [doc, 'touchstart', onTouchStart as unknown as EventListener],
    [doc, 'touchend', onTouchEnd as unknown as EventListener],
    [doc, 'visibilitychange', onVisibility],
  ];

  return {
    start() {
      onResize();
      scrollFrom = { x: view.scrollX, y: view.scrollY };
      for (const [target, type, listener] of listeners) {
        target.addEventListener(type, listener, passive);
      }
      view.addEventListener('scroll', onScroll, passive);
      view.addEventListener('resize', onResize, passive);
      lastLight = null;
      readTheme();
      const created = deps.createObserver(readTheme);
      created.observe(doc.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
      observer = created;
    },
    stop() {
      for (const [target, type, listener] of listeners) {
        target.removeEventListener(type, listener);
      }
      view.removeEventListener('scroll', onScroll);
      view.removeEventListener('resize', onResize);
      observer?.disconnect();
      observer = null;
    },
    suspend(next) {
      suspended = next;
      if (!next) scrollFrom = { x: view.scrollX, y: view.scrollY };
    },
  };
}
