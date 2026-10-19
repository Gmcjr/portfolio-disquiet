import { describe, expect, it } from 'vitest';
import { deriveBackdrop, scaleNote } from './backdrop.js';
import { contrastRatio, hslToRgb, isSaturatedRed, safeColor } from './color.js';
import type { VisitEvent } from './events.js';
import {
  LONG_STILL_MS,
  STILL_AFTER_MS,
  createFeatureState,
  fold,
  sample,
  type Features,
} from './features.js';
import { createPRNG, deriveKey, referrerCategory, shuffle } from './key.js';
import { nextQuality } from './ladder.js';
import {
  CONTINUOUS_ROWS,
  EVENT_ROWS,
  MAPPING_ROW_IDS,
  map,
} from './mapping.js';
import {
  DETUNE_MAX_CENTS,
  MAX_BRIGHT_TRIGGERS_PER_S,
  PARALLAX_MAX_PX,
  limitBright,
  type ParameterFrame,
  type Trigger,
} from './params.js';
import { computeSeal, displaySeal } from './provenance.js';
import {
  advance,
  buildCheckpoints,
  replayStep,
  seek,
  showcaseDurationMs,
  startCursor,
  visitTimeAt,
} from './showcase.js';
import {
  BLACKOUT_MS,
  WHITEOUT_HOLD_MS,
  WHITEOUT_SWELL_MS,
  WHITEOUT_TO_BLACK_MS,
  MESSAGE_VARIANTS,
  allText,
  buildCues,
  pickVariant,
  holdMs,
} from './script.js';
import { summarize } from './summary.js';
import {
  PROPERTY_RUNS,
  SEED_A,
  SEED_B,
  clickBurst,
  randomStream,
} from './__fixtures__/streams.js';

const BACKDROP = deriveBackdrop(SEED_A);

/** The live layer's loop, written out: fold each event, sample, map. */
function live(events: readonly VisitEvent[], t: number) {
  let state = createFeatureState();
  for (const event of events) if (event.t <= t) state = fold(state, event);
  return map(sample(state, t), BACKDROP, []).frame;
}

const baseFeatures = (): Features => sample(createFeatureState(), 1000);

function frameFor(features: Features): ParameterFrame {
  return map(features, BACKDROP, []).frame;
}

describe('key', () => {
  const values = {
    entropyHex: '00'.repeat(16),
    epochMs: 1_800_000_000_000,
    timeZone: 'Europe/Lisbon',
    theme: 'dark' as const,
    viewportWidth: 1280,
    viewportHeight: 800,
    referrer: 'none' as const,
  };

  it('is the same for the same start values', async () => {
    expect(await deriveKey(values)).toBe(await deriveKey(values));
  });

  it('changes when one random byte changes', async () => {
    const other = { ...values, entropyHex: '01' + '00'.repeat(15) };
    expect(await deriveKey(values)).not.toBe(await deriveKey(other));
  });

  it('is 64 hex characters', async () => {
    expect(await deriveKey(values)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('shuffles the same way for the same seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(shuffle(items, createPRNG(SEED_A))).toEqual(
      shuffle(items, createPRNG(SEED_A)),
    );
    expect([...shuffle(items, createPRNG(SEED_A))].sort()).toEqual(items);
  });

  it('keeps the generator in [0, 1), also for an all-zero seed', () => {
    for (const seed of [SEED_A, '0'.repeat(64), 'f'.repeat(64), 'not hex']) {
      const rand = createPRNG(seed);
      for (let i = 0; i < 1000; i += 1) {
        const value = rand();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    }
  });

  it('keeps only a category of the referrer', () => {
    const origin = 'https://disquiet.dev';
    expect(referrerCategory('', origin)).toBe('none');
    expect(referrerCategory('https://disquiet.dev/work/', origin)).toBe(
      'internal',
    );
    expect(referrerCategory('https://jobs.example/apply?id=42', origin)).toBe(
      'external',
    );
    expect(referrerCategory('not a url', origin)).toBe('external');
  });
});

describe('backdrop', () => {
  it('is the same for the same key and differs between keys', () => {
    expect(deriveBackdrop(SEED_A)).toEqual(deriveBackdrop(SEED_A));
    expect(deriveBackdrop(SEED_A)).not.toEqual(deriveBackdrop(SEED_B));
  });

  it('keeps the user-decided ranges', () => {
    const rand = createPRNG(SEED_A);
    for (let run = 0; run < PROPERTY_RUNS; run += 1) {
      const key = Array.from({ length: 64 }, () =>
        Math.floor(rand() * 16).toString(16),
      ).join('');
      const b = deriveBackdrop(key);
      expect(b.breathMs).toBeGreaterThanOrEqual(6000);
      expect(b.breathMs).toBeLessThanOrEqual(10000);
      expect(b.voiceJoinMs).toBeGreaterThanOrEqual(15000);
      expect(b.voiceJoinMs).toBeLessThanOrEqual(30000);
      expect(b.seasonMs).toBeGreaterThanOrEqual(60000);
      expect(b.seasonMs).toBeLessThanOrEqual(240000);
    }
  });

  it('plays notes inside two octaves above the root', () => {
    expect(scaleNote(BACKDROP, 0)).toBe(BACKDROP.rootMidi + 12);
    expect(scaleNote(BACKDROP, 1)).toBeLessThan(BACKDROP.rootMidi + 12 + 24);
  });
});

describe('features', () => {
  it('starts stillness at exactly 3 s', () => {
    const state = fold(createFeatureState(), {
      kind: 'click',
      t: 1000,
      gx: 0,
      gy: 0,
    });
    expect(sample(state, 1000 + STILL_AFTER_MS - 1).stillness).toBe(0);
    expect(sample(state, 1000 + STILL_AFTER_MS + 1).stillness).toBeGreaterThan(
      0,
    );
  });

  it('does not count hidden time as stillness', () => {
    let state = fold(createFeatureState(), {
      kind: 'click',
      t: 0,
      gx: 0,
      gy: 0,
    });
    state = fold(state, { kind: 'visibility', t: 1000, hidden: true });
    expect(sample(state, 50_000).stillMs).toBe(1000);
    state = fold(state, { kind: 'visibility', t: 60_000, hidden: false });
    expect(sample(state, 61_000).stillMs).toBe(2000);
    expect(sample(state, 61_000).lastAbsenceMs).toBe(59_000);
  });

  it('marks long stillness at 30 s', () => {
    const state = createFeatureState();
    expect(sample(state, LONG_STILL_MS - 1).longStill).toBe(false);
    expect(sample(state, LONG_STILL_MS).longStill).toBe(true);
  });

  it('reads regular input as order and irregular input as chaos', () => {
    let regular = createFeatureState();
    let irregular = createFeatureState();
    const gaps = [100, 1900, 150, 2500, 300, 1200];
    let t = 0;
    for (let i = 0; i < 6; i += 1) {
      regular = fold(regular, { kind: 'click', t: i * 500, gx: 0, gy: 0 });
      t += gaps[i] ?? 0;
      irregular = fold(irregular, { kind: 'click', t, gx: 0, gy: 0 });
    }
    expect(sample(regular, 2600).order).toBeGreaterThan(0.9);
    expect(sample(irregular, t + 100).order).toBeLessThan(0.5);
  });

  it('copies cleanly for checkpoints', () => {
    let state = createFeatureState();
    for (const event of randomStream(createPRNG(SEED_A), 200))
      state = fold(state, event);
    expect(structuredClone(state)).toEqual(state);
  });
});

describe('mapping rows', () => {
  it('has one record for every row id, and no extra ids', () => {
    const ids = new Set(
      [...CONTINUOUS_ROWS, ...EVENT_ROWS].map((row) => row.id),
    );
    expect([...ids].sort()).toEqual([...MAPPING_ROW_IDS].sort());
  });

  // Each continuous row: a change in its input changes sound and image.
  const continuous: [string, Partial<Features>][] = [
    ['pointer-position', { pointerX: 0.9, pointerY: 0.1 }],
    ['pointer-speed', { pointerSpeed: 1 }],
    ['order-chaos', { order: 0 }],
    ['stillness', { stillness: 1, stillMs: 10_000 }],
    ['long-stillness', { longStill: true, stillMs: 40_000, visitMs: 40_000 }],
    ['scroll', { scrollMomentum: 0.8 }],
    ['keystroke', { typingRate: 1 }],
    ['page-new', { chordStep: 3 }],
    ['page-revisit', { revisitAgeMs: 0, revisitChord: 2 }],
    ['page-dwell', { dwellMs: 120_000 }],
    ['visit-time', { visitMs: BACKDROP.seasonMs * 2 + 1 }],
    ['tab-hidden', { returnAgeMs: 0, lastAbsenceMs: 60_000 }],
  ];

  it.each(continuous)('%s changes sound and image', (_id, change) => {
    const before = frameFor(baseFeatures());
    const after = frameFor({ ...baseFeatures(), ...change });
    expect(after.audio).not.toEqual(before.audio);
    expect(after.visual).not.toEqual(before.visual);
  });

  it('tab-hidden silences and darkens while away', () => {
    const frame = frameFor({ ...baseFeatures(), hidden: true });
    expect(frame.audio.masterLevel).toBe(0);
    expect(frame.visual.dim).toBe(1);
  });

  const triggersFor = (event: VisitEvent): Trigger[] =>
    map(baseFeatures(), BACKDROP, [event]).triggers;

  it.each<[string, VisitEvent, Trigger['kind'][]]>([
    ['click', { kind: 'click', t: 1, gx: 10, gy: 50 }, ['pluck', 'ripple']],
    ['scroll', { kind: 'scroll', t: 1, dy: 40, dx: 0 }, ['glide']],
    ['keystroke', { kind: 'keystroke', t: 1 }, ['tick']],
    [
      'page-back',
      { kind: 'page', t: 1, path: '/', nav: 'traverse' },
      ['glide', 'swell', 'ripple'],
    ],
    ['tab-hidden', { kind: 'visibility', t: 1, hidden: false }, ['swell']],
    ['theme', { kind: 'theme', t: 1, light: true }, ['swell']],
  ])('%s fires its triggers', (_id, event, kinds) => {
    expect(triggersFor(event).map((t) => t.kind)).toEqual(kinds);
  });

  it('controls-unmapped: mute and pause motion leave no trace', () => {
    const before = map(baseFeatures(), BACKDROP, []);
    const events: VisitEvent[] = [
      { kind: 'mute', t: 1, muted: true },
      { kind: 'motion', t: 1, motion: 2 },
    ];
    let state = createFeatureState();
    for (const event of events) state = fold(state, event);
    const after = map(sample(state, 1000), BACKDROP, events);
    expect(after).toEqual(before);
  });

  it('plays a higher note for a higher click', () => {
    const high = map(baseFeatures(), BACKDROP, [
      { kind: 'click', t: 1, gx: 0, gy: 2 },
    ]);
    const low = map(baseFeatures(), BACKDROP, [
      { kind: 'click', t: 1, gx: 0, gy: 60 },
    ]);
    const pitch = (triggers: Trigger[]): number => {
      const pluck = triggers.find((t) => t.kind === 'pluck');
      return pluck?.kind === 'pluck' ? pluck.pitchMidi : Number.NaN;
    };
    expect(pitch(high.triggers)).toBeGreaterThan(pitch(low.triggers));
  });
});

describe('determinism and safety', () => {
  it('gives the same frames for the same events and key', () => {
    const events = randomStream(createPRNG(SEED_A), 300);
    for (const t of [0, 5000, 60_000, 150_000]) {
      expect(live(events, t)).toEqual(live(events, t));
    }
  });

  it('keeps every frame inside the safety limits', () => {
    const rand = createPRNG(SEED_B);
    for (let run = 0; run < PROPERTY_RUNS; run += 1) {
      const events = [
        ...randomStream(rand, 80),
        ...clickBurst(100_000, 50, 20),
      ];
      for (const t of [1000, 30_000, 100_500, 200_000]) {
        const { audio, visual } = live(events, t);
        expect(Math.abs(audio.detuneCents)).toBeLessThanOrEqual(
          DETUNE_MAX_CENTS,
        );
        expect(audio.masterLevel).toBeLessThanOrEqual(1);
        expect(Math.abs(visual.layerOffset)).toBeLessThanOrEqual(
          PARALLAX_MAX_PX,
        );
        const values: number[] = [
          ...Object.values<number>(audio as unknown as Record<string, number>),
          ...Object.values<number>(visual as unknown as Record<string, number>),
        ];
        for (const value of values) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });

  it('lets at most 3 bright triggers through in any second', () => {
    const recent: number[] = [];
    let allowed = 0;
    for (let ms = 0; ms < 1000; ms += 20) {
      const burst = map(
        baseFeatures(),
        BACKDROP,
        clickBurst(ms, 1, 1),
      ).triggers;
      allowed += limitBright(burst, recent, ms).filter(
        (t) => t.kind === 'ripple',
      ).length;
    }
    expect(allowed).toBe(MAX_BRIGHT_TRIGGERS_PER_S);
  });
});

describe('showcase', () => {
  const events = randomStream(createPRNG(SEED_A), 400);
  const visitMs = events[events.length - 1]?.t ?? 0;

  it('lasts 60–90 s', () => {
    expect(showcaseDurationMs(0)).toBe(60_000);
    expect(showcaseDurationMs(10 * 60 * 60 * 1000)).toBe(90_000);
  });

  it('never moves backward in visit time', () => {
    const showcaseMs = showcaseDurationMs(visitMs);
    let previous = -1;
    for (let replay = 0; replay <= showcaseMs + 1000; replay += 250) {
      const t = visitTimeAt(replay, visitMs, showcaseMs);
      expect(t).toBeGreaterThanOrEqual(previous);
      previous = t;
    }
  });

  it('replays the same frame as the live layer at the same visit time', () => {
    let cursor = startCursor();
    for (const t of [0, 1000, 20_000, visitMs / 2, visitMs]) {
      const step = replayStep(cursor, events, BACKDROP, t);
      cursor = step.cursor;
      expect(step.frame).toEqual(live(events, t));
    }
  });

  it('gives the same frame from a checkpoint as from the start', () => {
    const checkpoints = buildCheckpoints(events, 64);
    expect(checkpoints.length).toBeLessThanOrEqual(64);
    for (const t of [visitMs * 0.3, visitMs * 0.71, visitMs]) {
      const fromStart = advance(startCursor(), events, t).cursor;
      const fromCheckpoint = advance(
        seek(checkpoints, events, t),
        events,
        t,
      ).cursor;
      expect(fromCheckpoint).toEqual(fromStart);
    }
  });
});

describe('goodbye script', () => {
  const V = MESSAGE_VARIANTS[0] ?? { opening: [], closing: [] };

  it('picks the same variant for the same key, and varies across keys', () => {
    expect(pickVariant(SEED_A)).toBe(pickVariant(SEED_A));
    const rand = createPRNG(SEED_B);
    const seen = new Set<unknown>();
    for (let run = 0; run < PROPERTY_RUNS; run += 1) {
      const key = Array.from({ length: 64 }, () =>
        Math.floor(rand() * 16).toString(16),
      ).join('');
      seen.add(pickVariant(key));
    }
    expect(seen.size).toBe(MESSAGE_VARIANTS.length);
  });

  it('holds a sentence for at least 2.5 s, then 300 ms a word', () => {
    expect(holdMs('one two three four five')).toBe(2500);
    expect(holdMs('one two three four five six')).toBe(2800);
  });

  it('always ends in a blackout with calm motion', () => {
    const whiteout = {
      ...BACKDROP,
      ending: 'whiteout' as const,
      emergence: 'sudden' as const,
    };
    const cues = buildCues(whiteout, true, 60_000, V);
    expect(cues.find((c) => c.kind === 'ending')).toMatchObject({
      ending: 'blackout',
      durationMs: BLACKOUT_MS,
    });
    expect(cues.find((c) => c.kind === 'showcase')).toMatchObject({
      rampMs: 6000,
    });
  });

  it('spreads a whiteout and blackout over at least 5 s', () => {
    const cues = buildCues(
      { ...BACKDROP, ending: 'whiteout' },
      false,
      60_000,
      V,
    );
    const ending = cues.find((c) => c.kind === 'ending');
    expect(ending?.durationMs).toBe(
      WHITEOUT_SWELL_MS + WHITEOUT_HOLD_MS + WHITEOUT_TO_BLACK_MS,
    );
    expect(ending?.durationMs).toBeGreaterThanOrEqual(5000);
  });

  it('keeps the cues in time order and ends with the fade back in', () => {
    const cues = buildCues(BACKDROP, false, 75_000, V);
    const times = cues.map((c) => c.atMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(cues[cues.length - 1]?.kind).toBe('fade-in');
    expect(allText(V)[allText(V).length - 1]).toBe('Remember?');
  });
});

describe('summary and seal', () => {
  const events: VisitEvent[] = [
    { kind: 'enter', t: 0 },
    { kind: 'page', t: 0, path: '/experience/', nav: 'load' },
    { kind: 'click', t: 1000, gx: 1, gy: 1 },
    { kind: 'keystroke', t: 1200 },
    { kind: 'page', t: 9000, path: '/work/', nav: 'push' },
    { kind: 'page', t: 12_000, path: '/experience/', nav: 'traverse' },
    { kind: 'click', t: 60_000, gx: 1, gy: 1 },
  ];

  it('counts the visit', () => {
    expect(summarize(events)).toEqual({
      clicks: 2,
      pages: 2,
      keystrokes: 1,
      minutes: 1,
      longestStillnessMs: 58_800,
    });
  });

  it('gives a stable seal that changes with the visit', async () => {
    const seal = await computeSeal(SEED_A, events);
    expect(await computeSeal(SEED_A, events)).toBe(seal);
    expect(await computeSeal(SEED_A, events.slice(0, -1))).not.toBe(seal);
    expect(displaySeal(seal)).toHaveLength(16);
  });
});

describe('color and quality ladder', () => {
  it('never returns saturated red', () => {
    for (let h = 0; h < 360; h += 5) {
      expect(isSaturatedRed(safeColor(h, 1, 0.5))).toBe(false);
    }
    expect(isSaturatedRed(hslToRgb(0, 1, 0.5))).toBe(true);
  });

  it('measures contrast as WCAG does', () => {
    const black = { r: 0, g: 0, b: 0 };
    const white = { r: 255, g: 255, b: 255 };
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
  });

  it('steps down when ticks are slow and up only after 10 s of fast ticks', () => {
    const slow = Array.from({ length: 60 }, () => 6);
    const fast = Array.from({ length: 60 }, () => 1);
    expect(nextQuality(slow, 0, 0, 2000)).toBe(1);
    expect(nextQuality(slow, 4, 0, 2000)).toBe(4);
    expect(nextQuality(fast, 2, 0, 9_999)).toBe(2);
    expect(nextQuality(fast, 2, 0, 10_000)).toBe(1);
    expect(nextQuality(slow.slice(0, 30), 0, 0, 2000)).toBe(0);
  });
});
