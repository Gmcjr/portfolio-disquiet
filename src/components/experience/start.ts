// The startup entry: ExperienceLayer.astro's one import. It wires the recording
// and the Goodbye button to the real browser, once per document, even if a
// deploy loads a second copy.
import { wireBootstrap } from './bootstrap';
import type { Clock, Scheduler } from './record/ports';
import { startRecording } from './record/recording';
import { createVisitStore } from './record/storage';

const GUARD = Symbol.for('exp.bootstrap');
const marked = window as unknown as Record<symbol, boolean>;

if (marked[GUARD] !== true) {
  marked[GUARD] = true;
  const sessionStorageOrNull = (): Storage | null => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  };
  const warn = (code: string): void => console.warn('[experience]', code);
  const clock: Clock = {
    now: () => performance.now(),
    epochNow: () => performance.timeOrigin + performance.now(),
  };
  const idle: Scheduler['idle'] = (callback, timeoutMs) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(callback, { timeout: timeoutMs });
    } else {
      window.setTimeout(callback, Math.min(timeoutMs, 1000));
    }
  };
  const store = createVisitStore({
    storage: sessionStorageOrNull(),
    clock,
    idle,
    warn,
  });
  wireBootstrap({
    doc: document,
    startRecording: () =>
      startRecording({
        doc: document,
        view: window,
        clock,
        store,
        warn,
        createObserver: (callback) => new MutationObserver(callback),
        readPath: () => window.location.pathname,
        ownOrigin: window.location.origin,
        randomHex: (bytes) =>
          Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
            b.toString(16).padStart(2, '0'),
          ).join(''),
        timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    clearRecord: () => store.clear(),
    createAudioContext: () =>
      typeof AudioContext === 'function' ? new AudioContext() : null,
    loadEngine: () => import('./engine/index'),
    warn,
  });
}
