// Records the whole visit from arrival (ADR-0008 Amendment 1). Nothing plays or
// draws here: events go into the timeline and into session storage, and the
// piece plays only at Goodbye. A reload in the same tab continues the visit.

import { canResume } from '../../../lib/experience/envelope';
import type { PageNav, VisitEvent } from '../../../lib/experience/events';
import { deriveKey, referrerCategory } from '../../../lib/experience/key';
import { append } from '../../../lib/experience/timeline';
import type { Clock, Warn } from './ports';
import {
  createRecorder,
  type RecorderDeps,
  type RecorderView,
} from './recorder';
import type { VisitStore } from './storage';

export interface VisitRecord {
  key: string;
  enteredAtEpochMs: number;
  events: readonly VisitEvent[];
}

export interface Recording {
  /** Ends the recording for Goodbye and returns the whole visit. */
  stop(): Promise<VisitRecord>;
}

export interface RecordingDeps {
  doc: Document;
  view: RecorderView;
  clock: Clock;
  store: VisitStore;
  warn: Warn;
  createObserver: RecorderDeps['createObserver'];
  readPath: () => string;
  ownOrigin: string;
  randomHex: (bytes: number) => string;
  timeZone: () => string;
}

export function startRecording(deps: RecordingDeps): Recording {
  const stored = deps.store.read();
  const resumed =
    stored !== null && canResume(stored.header.state) ? stored : null;
  if (stored !== null && resumed === null) deps.store.clear();

  const enteredAt =
    resumed?.header.enteredAtEpochMs ?? Math.round(deps.clock.epochNow());
  const events: VisitEvent[] = [];
  // A continued visit: the stored events come back through a parser that loads
  // only now (it is not in the startup code). New events wait until then.
  let ready = resumed === null;
  const queued: VisitEvent[] = [];
  const visitNow = (): number => deps.clock.epochNow() - enteredAt;
  let key: string | null = resumed?.header.key ?? null;
  let full = false;
  let stopped = false;
  let nextNav: PageNav = 'push';

  const snapshot = (state: 'live' | 'goodbye') => ({
    state,
    enteredAtEpochMs: enteredAt,
    key: key ?? '',
    events,
  });
  const flushNow = (): void => {
    if (key !== null && ready) deps.store.flush(snapshot('live'));
  };

  const add = (event: VisitEvent): void => {
    if (append(events, event) === 'full' && !full) {
      full = true;
      deps.warn('timeline-full');
    }
  };
  const emit = (event: VisitEvent): void => {
    if (stopped) return;
    if (!ready) {
      queued.push(event);
      return;
    }
    add(event);
    if (key !== null) deps.store.requestFlush(() => snapshot('live'));
  };

  const loaded: Promise<void> =
    resumed === null
      ? Promise.resolve()
      : import('../../../lib/experience/timeline-read')
          .then(({ parseEvents }) => {
            const parsed = parseEvents(resumed.rawEvents);
            if (parsed.dropped > 0) deps.warn('record-discarded');
            events.push(...parsed.events);
          })
          .catch(() => {
            deps.warn('record-discarded');
          })
          .then(() => {
            ready = true;
            for (const event of queued.splice(0, queued.length)) add(event);
            flushNow();
          });

  // A new visit: the key comes from the start values, which are then dropped.
  const keyReady =
    key !== null
      ? Promise.resolve(key)
      : deriveKey({
          entropyHex: deps.randomHex(16),
          epochMs: enteredAt,
          timeZone: deps.timeZone(),
          theme:
            deps.doc.documentElement.dataset['theme'] === 'light'
              ? 'light'
              : 'dark',
          viewportWidth: deps.view.innerWidth,
          viewportHeight: deps.view.innerHeight,
          referrer: referrerCategory(deps.doc.referrer, deps.ownOrigin),
        }).then((derived) => {
          key = derived;
          flushNow();
          return derived;
        });

  if (resumed === null) emit({ kind: 'enter', t: 0 });
  emit({ kind: 'page', t: visitNow(), path: deps.readPath(), nav: 'load' });

  const recorder = createRecorder({
    doc: deps.doc,
    view: deps.view,
    visitNow,
    emit,
    createObserver: deps.createObserver,
  });

  const onBeforePreparation = (event: Event): void => {
    const type = (event as Event & { navigationType?: string }).navigationType;
    nextNav = type === 'traverse' || type === 'replace' ? type : 'push';
  };
  // Astro also fires astro:page-load on the first load, which is already
  // recorded; only a load after a swap is a page change.
  let swapped = false;
  const onBeforeSwap = (): void => {
    swapped = true;
    recorder.suspend(true);
  };
  const onPageLoad = (): void => {
    if (!swapped) return;
    swapped = false;
    recorder.suspend(false);
    emit({ kind: 'page', t: visitNow(), path: deps.readPath(), nav: nextNav });
    nextNav = 'push';
  };
  const onHide = (): void => {
    if (deps.doc.visibilityState === 'hidden') flushNow();
  };
  const docListeners: [string, EventListener][] = [
    ['astro:before-preparation', onBeforePreparation],
    ['astro:before-swap', onBeforeSwap],
    ['astro:page-load', onPageLoad],
    ['visibilitychange', onHide],
  ];
  for (const [type, listener] of docListeners)
    deps.doc.addEventListener(type, listener);
  deps.view.addEventListener('pagehide', flushNow);
  recorder.start();

  return {
    async stop() {
      emit({ kind: 'goodbye', t: visitNow() });
      stopped = true;
      recorder.stop();
      for (const [type, listener] of docListeners)
        deps.doc.removeEventListener(type, listener);
      deps.view.removeEventListener('pagehide', flushNow);
      await loaded;
      const finalKey = await keyReady;
      deps.store.flush(snapshot('goodbye'));
      return { key: finalKey, enteredAtEpochMs: enteredAt, events };
    },
  };
}
