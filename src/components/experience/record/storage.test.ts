// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../../../lib/experience/envelope';
import { parseEvents } from '../../../lib/experience/timeline-read';
import type { VisitEvent } from '../../../lib/experience/events';
import type { Clock, Scheduler, StorageLike, WarnCode } from './ports';
import {
  FLUSH_DELAY_MS,
  createVisitStore,
  type VisitSnapshot,
} from './storage';

const KEY = 'cd'.repeat(32);
const NOW = 1_800_000_000_000;

function setup(storage: StorageLike | null) {
  const warnings: WarnCode[] = [];
  const idle: { callback: () => void; timeoutMs: number }[] = [];
  const clock: Clock = { now: () => 0, epochNow: () => NOW };
  const scheduler: Scheduler = {
    frame: () => 0,
    cancelFrame: () => undefined,
    interval: () => 0,
    clearInterval: () => undefined,
    idle: (callback, timeoutMs) => {
      idle.push({ callback, timeoutMs });
    },
  };
  const store = createVisitStore({
    storage,
    clock,
    idle: (callback, timeoutMs) => scheduler.idle(callback, timeoutMs),
    warn: (code) => warnings.push(code),
  });
  return { store, warnings, idle };
}

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

const events: VisitEvent[] = [
  { kind: 'enter', t: 0 },
  { kind: 'page', t: 0, path: '/experience/', nav: 'load' },
  { kind: 'click', t: 1200, gx: 3, gy: 4 },
];

const snapshot = (list: readonly VisitEvent[]): VisitSnapshot => ({
  state: 'live',
  enteredAtEpochMs: NOW - 60_000,
  key: KEY,
  events: list,
});

describe('visit store', () => {
  it('writes a record that it can read back', () => {
    const storage = memory();
    const { store } = setup(storage);
    store.flush(snapshot(events));
    const read = store.read();
    expect(read?.header).toEqual({
      v: 1,
      state: 'live',
      enteredAtEpochMs: NOW - 60_000,
      savedAtEpochMs: NOW,
      key: KEY,
    });
    expect(parseEvents(read?.rawEvents).events).toEqual(events);
  });

  it('appends new events to the earlier text', () => {
    const storage = memory();
    const { store } = setup(storage);
    store.flush(snapshot(events.slice(0, 2)));
    store.flush(snapshot(events));
    expect(parseEvents(store.read()?.rawEvents).events).toEqual(events);
  });

  it('flushes in idle time within 5 s, once for repeated requests', () => {
    const storage = memory();
    const { store, idle } = setup(storage);
    store.requestFlush(() => snapshot(events));
    store.requestFlush(() => snapshot(events));
    expect(idle).toHaveLength(1);
    expect(idle[0]?.timeoutMs).toBe(FLUSH_DELAY_MS);
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
    idle[0]?.callback();
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
  });

  it('removes and logs a bad record', () => {
    const storage = memory();
    storage.data.set(STORAGE_KEY, '{"v":9}');
    const { store, warnings } = setup(storage);
    expect(store.read()).toBeNull();
    expect(warnings).toEqual(['record-discarded']);
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
  });

  it('falls back to memory once when storage throws', () => {
    const throwing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
      removeItem: () => undefined,
    };
    const { store, warnings } = setup(throwing);
    store.flush(snapshot(events));
    store.flush(snapshot(events));
    expect(warnings).toEqual(['storage-unavailable']);
  });

  it('clears the record', () => {
    const storage = memory();
    const { store } = setup(storage);
    store.flush(snapshot(events));
    store.clear();
    expect(storage.data.size).toBe(0);
  });
});
