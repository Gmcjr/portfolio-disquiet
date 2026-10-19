// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Clock, WarnCode } from './ports';
import type { RecorderView } from './recorder';
import { startRecording, type RecordingDeps } from './recording';
import type { StoredVisit, VisitSnapshot, VisitStore } from './storage';

let epoch = 0;
let flushed: VisitSnapshot[] = [];
let cleared = 0;
let warnings: WarnCode[] = [];
let stored: StoredVisit | null = null;

function deps(): RecordingDeps {
  const clock: Clock = { now: () => epoch, epochNow: () => epoch };
  const store: VisitStore = {
    read: () => stored,
    flush: (snapshot) =>
      flushed.push({ ...snapshot, events: [...snapshot.events] }),
    requestFlush: (snapshot) =>
      flushed.push({ ...snapshot(), events: [...snapshot().events] }),
    clear: () => {
      cleared += 1;
    },
  };
  const view: RecorderView = {
    scrollX: 0,
    scrollY: 0,
    innerWidth: 640,
    innerHeight: 640,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
  };
  return {
    doc: document,
    view,
    clock,
    store,
    warn: (code) => warnings.push(code),
    createObserver: (callback) => new MutationObserver(callback),
    readPath: () => '/work/',
    ownOrigin: 'https://example.test',
    randomHex: () => '00'.repeat(16),
    timeZone: () => 'UTC',
  };
}

const click = (): boolean =>
  document.body.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      clientX: 10,
      clientY: 10,
      detail: 1,
    }),
  );

beforeEach(() => {
  epoch = 1_800_000_000_000;
  flushed = [];
  cleared = 0;
  warnings = [];
  stored = null;
});

describe('recording', () => {
  it('records from arrival: enter and the first page, with nothing played', async () => {
    const recording = startRecording(deps());
    epoch += 1500;
    click();
    const visit = await recording.stop();
    expect(visit.events.map((e) => e.kind)).toEqual([
      'enter',
      'page',
      'click',
      'goodbye',
    ]);
    expect(visit.key).toMatch(/^[0-9a-f]{64}$/);
    expect(flushed.at(-1)?.state).toBe('goodbye');
  });

  it('continues a stored visit after a reload, with the same key', async () => {
    stored = {
      header: {
        v: 1,
        state: 'live',
        enteredAtEpochMs: epoch - 60_000,
        savedAtEpochMs: epoch - 1000,
        key: 'ab'.repeat(32),
      },
      rawEvents: [
        ['e', 0],
        ['n', 0, '/', 0],
      ],
    };
    const visit = await startRecording(deps()).stop();
    expect(visit.key).toBe('ab'.repeat(32));
    expect(visit.events.map((e) => e.kind)).toEqual([
      'enter',
      'page',
      'page',
      'goodbye',
    ]);
    expect(visit.events[2]?.t).toBe(60_000);
  });

  it('drops a stored visit that was in Goodbye, and starts a new one', async () => {
    stored = {
      header: {
        v: 1,
        state: 'goodbye',
        enteredAtEpochMs: epoch - 60_000,
        savedAtEpochMs: epoch - 1000,
        key: 'ab'.repeat(32),
      },
      rawEvents: [['e', 0]],
    };
    const visit = await startRecording(deps()).stop();
    expect(cleared).toBe(1);
    expect(visit.key).not.toBe('ab'.repeat(32));
    expect(visit.events[0]?.kind).toBe('enter');
  });

  it('ignores the page-load event of the first load', async () => {
    const recording = startRecording(deps());
    document.dispatchEvent(new Event('astro:page-load'));
    const visit = await recording.stop();
    expect(visit.events.filter((e) => e.kind === 'page')).toHaveLength(1);
  });

  it('records page changes from the router and stops listening after Goodbye', async () => {
    const recording = startRecording(deps());
    document.dispatchEvent(
      Object.assign(new Event('astro:before-preparation'), {
        navigationType: 'traverse',
      }),
    );
    document.dispatchEvent(new Event('astro:before-swap'));
    document.dispatchEvent(new Event('astro:page-load'));
    const visit = await recording.stop();
    click();
    expect(visit.events.filter((e) => e.kind === 'page').at(-1)).toMatchObject({
      nav: 'traverse',
    });
    expect(visit.events.at(-1)?.kind).toBe('goodbye');
    expect(warnings).toEqual([]);
  });
});
