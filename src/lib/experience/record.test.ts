import { describe, expect, it } from 'vitest';
import {
  FUTURE_TOLERANCE_MS,
  IDLE_EXPIRY_MS,
  MAX_AGE_MS,
  MAX_RECORD_CHARS,
  canResume,
  readEnvelope,
  type EnvelopeHeader,
} from './envelope.js';
import {
  quantizeTime,
  sanitizePath,
  toCell,
  type VisitEvent,
} from './events.js';
import { createPRNG } from './key.js';
import {
  MAX_EVENTS,
  MAX_GAP_MS,
  append,
  encodeFrom,
  parseEvents,
  wrapEnvelope,
} from './timeline.js';
import { PROPERTY_RUNS, SEED_A, randomStream } from './__fixtures__/streams.js';
import { GOLDEN_V1 } from './__fixtures__/golden-v1.js';

const KEY = 'ab'.repeat(32);
const NOW = 1_800_000_000_000;

function header(overrides: Partial<EnvelopeHeader>): EnvelopeHeader {
  return {
    v: 1,
    state: 'live',
    enteredAtEpochMs: NOW - 60_000,
    savedAtEpochMs: NOW - 1000,
    key: KEY,
    ...overrides,
  };
}

function build(events: VisitEvent[]): VisitEvent[] {
  const stored: VisitEvent[] = [];
  for (const event of events) append(stored, event);
  return stored;
}

describe('events', () => {
  it('rounds key-press times to 100 ms and other times to 10 ms', () => {
    expect(quantizeTime('keystroke', 1249)).toBe(1200);
    expect(quantizeTime('keystroke', 1250)).toBe(1300);
    expect(quantizeTime('click', 1234)).toBe(1230);
  });

  it('keeps grid cells inside 0–63', () => {
    expect(toCell(-1)).toBe(0);
    expect(toCell(0.999)).toBe(63);
    expect(toCell(5)).toBe(63);
    expect(toCell(Number.NaN)).toBe(0);
  });

  it('replaces unsafe paths with "/"', () => {
    expect(sanitizePath('/work/barta/')).toBe('/work/barta/');
    expect(sanitizePath('//evil.example')).toBe('/');
    expect(sanitizePath('/<script>')).toBe('/');
    expect(sanitizePath('javascript:x')).toBe('/');
  });
});

describe('readEnvelope', () => {
  const text = (h: EnvelopeHeader) => wrapEnvelope(h, '');

  it('accepts a current record', () => {
    const result = readEnvelope(text(header({})), NOW);
    expect(result.ok).toBe(true);
  });

  it('reports a missing record', () => {
    expect(readEnvelope(null, NOW)).toEqual({ ok: false, reason: 'missing' });
  });

  it.each([
    ['not JSON', '{'],
    ['an array', '[]'],
    ['a wrong version', text(header({})).replace('"v":1', '"v":2')],
    ['an unknown state', text(header({})).replace('"live"', '"open"')],
    ['a bad key', text(header({ key: 'XYZ' }))],
    ['a fractional time', text(header({ savedAtEpochMs: 1.5 }))],
  ])('rejects %s', (_name, input) => {
    expect(readEnvelope(input, NOW)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects input over 1 MB', () => {
    const big = 'x'.repeat(MAX_RECORD_CHARS + 1);
    expect(readEnvelope(big, NOW)).toEqual({ ok: false, reason: 'invalid' });
  });

  it.each([
    ['idle too long', header({ savedAtEpochMs: NOW - IDLE_EXPIRY_MS - 1 })],
    [
      'saved in the future',
      header({ savedAtEpochMs: NOW + FUTURE_TOLERANCE_MS + 1 }),
    ],
    ['too old', header({ enteredAtEpochMs: NOW - MAX_AGE_MS - 1 })],
  ])('expires a record that is %s', (_name, h) => {
    expect(readEnvelope(text(h), NOW)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('resumes only a live visit', () => {
    expect(canResume('live')).toBe(true);
    expect(canResume('goodbye')).toBe(false);
    expect(canResume('ended')).toBe(false);
  });
});

describe('timeline', () => {
  it('round-trips through encode and parse', () => {
    const rand = createPRNG(SEED_A);
    for (let run = 0; run < PROPERTY_RUNS; run += 1) {
      const stored = build(randomStream(rand, 60));
      const parsed = parseEvents(JSON.parse(`[${encodeFrom(stored, 0)}]`));
      expect(parsed.dropped).toBe(0);
      expect(parsed.events).toEqual(stored);
    }
  });

  it('encodes a slice that continues from the earlier text', () => {
    const stored = build(randomStream(createPRNG(SEED_A), 40));
    const joined = [
      encodeFrom(stored.slice(0, 20), 0),
      encodeFrom(stored, 20),
    ].join(',');
    expect(joined).toBe(encodeFrom(stored, 0));
  });

  it('never stores a time before the previous event', () => {
    const stored = build([
      { kind: 'click', t: 5000, gx: 1, gy: 1 },
      { kind: 'click', t: 4000, gx: 1, gy: 1 },
      { kind: 'keystroke', t: 4999 },
    ]);
    expect(stored.map((e) => e.t)).toEqual([5000, 5000, 5000]);
  });

  it('caps a gap at the idle expiry', () => {
    const stored = build([
      { kind: 'click', t: 0, gx: 1, gy: 1 },
      { kind: 'click', t: MAX_GAP_MS * 3, gx: 1, gy: 1 },
    ]);
    expect(stored[1]?.t).toBe(MAX_GAP_MS);
  });

  it('keeps every discrete event when it thins at the cap', () => {
    const stored: VisitEvent[] = [];
    for (let i = 0; i < 20_000; i += 1) {
      append(stored, { kind: 'pointer', t: i * 10, gx: i % 64, gy: 0 });
      if (i % 40 === 0)
        append(stored, { kind: 'click', t: i * 10, gx: 0, gy: 0 });
    }
    expect(stored.length).toBeLessThanOrEqual(MAX_EVENTS);
    expect(stored.filter((e) => e.kind === 'click')).toHaveLength(500);
    const times = stored.map((e) => e.t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('reports full when only discrete events remain', () => {
    const stored: VisitEvent[] = [];
    for (let i = 0; i < MAX_EVENTS; i += 1)
      append(stored, { kind: 'keystroke', t: i * 100 });
    expect(append(stored, { kind: 'keystroke', t: 99_999_900 })).toBe('full');
    expect(append(stored, { kind: 'goodbye', t: 99_999_990 })).toBe('added');
  });

  it('drops a malformed tuple alone', () => {
    const raw: unknown = [
      ['e', 0],
      ['p', 10, 64, 0],
      ['p', 10, 3, 4],
      ['k', -5],
      ['k', 1.5],
      ['z', 1],
      ['n', 10, '//evil', 1],
      ['c', 10, 1, 2, 3],
      'text',
    ];
    const { events, dropped } = parseEvents(raw);
    expect(dropped).toBe(6);
    expect(events).toEqual([
      { kind: 'enter', t: 0 },
      { kind: 'pointer', t: 10, gx: 3, gy: 4 },
      { kind: 'page', t: 20, path: '/', nav: 'push' },
    ]);
  });
});

describe('golden v1 record', () => {
  it('still parses, so a format change without a version bump fails here', () => {
    const result = readEnvelope(GOLDEN_V1, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { events, dropped } = parseEvents(result.events);
    expect(dropped).toBe(0);
    expect(events.map((e) => e.kind)).toEqual([
      'enter',
      'page',
      'pointer',
      'click',
      'scroll',
      'keystroke',
      'visibility',
      'visibility',
      'theme',
      'mute',
      'motion',
      'page',
      'goodbye',
    ]);
  });
});
