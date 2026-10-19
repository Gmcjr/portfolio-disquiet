// The sessionStorage adapter for the visit record (ADR-0009 §5). Writes are
// incremental: the encoded text of earlier events is kept, so a flush encodes
// only the new events. If storage throws, the visit runs in memory only.

import {
  STORAGE_KEY,
  readEnvelope,
  type EnvelopeHeader,
  type VisitState,
} from '../../../lib/experience/envelope';
import type { VisitEvent } from '../../../lib/experience/events';
import { encodeFrom, wrapEnvelope } from '../../../lib/experience/timeline';
import type { Clock, Scheduler, StorageLike, Warn } from './ports';

/** A flush waits at most this long for an idle moment. */
export const FLUSH_DELAY_MS = 5000;

/** A stored visit. The events stay raw until the caller parses them (lazily). */
export interface StoredVisit {
  header: EnvelopeHeader;
  rawEvents: unknown;
}

export interface VisitSnapshot {
  state: VisitState;
  enteredAtEpochMs: number;
  key: string;
  events: readonly VisitEvent[];
}

export interface VisitStore {
  /** The stored visit, or null. A bad or old record is removed and logged. */
  read(): StoredVisit | null;
  /** Writes now. Used on state changes, tab hide, and page hide. */
  flush(snapshot: VisitSnapshot): void;
  /** Writes within FLUSH_DELAY_MS, in idle time. Repeated calls share one write. */
  requestFlush(snapshot: () => VisitSnapshot): void;
  clear(): void;
}

export interface VisitStoreDeps {
  storage: StorageLike | null;
  clock: Clock;
  idle: Scheduler['idle'];
  warn: Warn;
}

export function createVisitStore(deps: VisitStoreDeps): VisitStore {
  let storage = deps.storage;
  let encoded = '';
  let encodedCount = 0;
  let pending = false;

  const disable = (): void => {
    if (storage === null) return;
    storage = null;
    deps.warn('storage-unavailable');
  };

  const remove = (): void => {
    try {
      storage?.removeItem(STORAGE_KEY);
    } catch {
      disable();
    }
  };

  function encode(events: readonly VisitEvent[]): string {
    // Thinning at the cap rewrites earlier events, so the cache starts over.
    if (events.length < encodedCount) {
      encoded = '';
      encodedCount = 0;
    }
    const added = encodeFrom(events, encodedCount);
    if (added !== '') encoded = encoded === '' ? added : `${encoded},${added}`;
    encodedCount = events.length;
    return encoded;
  }

  function flush(snapshot: VisitSnapshot): void {
    if (storage === null) return;
    const header: EnvelopeHeader = {
      v: 1,
      state: snapshot.state,
      enteredAtEpochMs: snapshot.enteredAtEpochMs,
      savedAtEpochMs: Math.round(deps.clock.epochNow()),
      key: snapshot.key,
    };
    try {
      storage.setItem(
        STORAGE_KEY,
        wrapEnvelope(header, encode(snapshot.events)),
      );
    } catch {
      disable();
    }
  }

  return {
    read() {
      if (storage === null) return null;
      let text: string | null;
      try {
        text = storage.getItem(STORAGE_KEY);
      } catch {
        disable();
        return null;
      }
      const result = readEnvelope(text, deps.clock.epochNow());
      if (!result.ok) {
        if (result.reason !== 'missing') {
          deps.warn(
            result.reason === 'expired' ? 'record-expired' : 'record-discarded',
          );
          remove();
        }
        return null;
      }
      return { header: result.header, rawEvents: result.events };
    },
    flush,
    requestFlush(snapshot) {
      if (pending || storage === null) return;
      pending = true;
      deps.idle(() => {
        pending = false;
        flush(snapshot());
      }, FLUSH_DELAY_MS);
    },
    clear() {
      encoded = '';
      encodedCount = 0;
      remove();
    },
  };
}
