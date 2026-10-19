// The input-to-sound-and-image rows that the user decided on 2026-10-18 (plan §3).
// Each row is one record with a stable id. Continuous rows shape the frame from
// sampled features; event rows turn single events into triggers. The live layer
// and the Goodbye showcase both call map(), so a replay sounds like the visit.

import { scaleNote, type Backdrop } from './backdrop.js';
import type { VisitEvent } from './events.js';
import type { Features } from './features.js';
import {
  DETUNE_MAX_CENTS,
  MAX_VOICES,
  PARALLAX_MAX_PX,
  clampFrame,
  neutralFrame,
  type ParameterFrame,
  type Trigger,
} from './params.js';

export const MAPPING_ROW_IDS = [
  'pointer-position',
  'pointer-speed',
  'order-chaos',
  'stillness',
  'long-stillness',
  'click',
  'scroll',
  'keystroke',
  'page-new',
  'page-revisit',
  'page-back',
  'page-dwell',
  'visit-time',
  'tab-hidden',
  'theme',
  'controls-unmapped',
] as const;

export type MappingRowId = (typeof MAPPING_ROW_IDS)[number];

interface ContinuousRow {
  id: MappingRowId;
  apply(features: Features, backdrop: Backdrop, frame: ParameterFrame): void;
}

interface EventRow {
  id: MappingRowId;
  onEvent(event: VisitEvent, features: Features, backdrop: Backdrop): Trigger[];
}

/** The echo and ghost of a revisit fade over this time. */
const REVISIT_FADE_MS = 8000;
/** The mark of a time away fades over this time. */
const ABSENCE_FADE_MS = 10000;
/** Order above this locks plucks to the pulse. */
const ORDER_LOCK = 0.6;

const fade = (ageMs: number, lengthMs: number): number =>
  ageMs >= lengthMs ? 0 : 1 - ageMs / lengthMs;

export const CONTINUOUS_ROWS: readonly ContinuousRow[] = [
  {
    id: 'pointer-position',
    apply(f, _b, frame) {
      frame.audio.pan = f.pointerX * 2 - 1;
      frame.audio.filterCutoff = 1 - f.pointerY;
      frame.visual.lightX = f.pointerX;
      frame.visual.lightY = f.pointerY;
    },
  },
  {
    id: 'pointer-speed',
    apply(f, _b, frame) {
      frame.audio.noteDensity += f.pointerSpeed * 0.6;
      frame.audio.detuneCents += f.pointerSpeed * DETUNE_MAX_CENTS * 0.4;
      frame.visual.particleSpeed += f.pointerSpeed * 0.7;
      frame.visual.turbulence += f.pointerSpeed * 0.4;
    },
  },
  {
    id: 'order-chaos',
    apply(f, _b, frame) {
      const chaos = 1 - f.order;
      frame.audio.detuneCents += chaos * DETUNE_MAX_CENTS * 0.6;
      frame.audio.noteDensity += f.order * 0.2;
      frame.visual.flow = f.order;
      frame.visual.turbulence += chaos * 0.5;
      frame.visual.saturation += chaos * 0.3;
    },
  },
  {
    id: 'stillness',
    apply(f, _b, frame) {
      const s = f.stillness;
      frame.audio.noteDensity *= 1 - s;
      frame.audio.droneLevel += s * 0.4;
      frame.audio.reverbMix += s * 0.4;
      frame.visual.particleSpeed *= 1 - s * 0.8;
      frame.visual.saturation *= 1 - s * 0.7;
      frame.visual.trailLength += s * 0.7;
    },
  },
  {
    id: 'long-stillness',
    apply(f, b, frame) {
      if (!f.longStill) return;
      const breath =
        0.5 + 0.5 * Math.sin((2 * Math.PI * f.visitMs) / b.breathMs);
      frame.audio.droneLevel += breath * 0.3;
      frame.visual.dim += (1 - breath) * 0.3;
    },
  },
  {
    id: 'scroll',
    apply(f, _b, frame) {
      frame.visual.layerOffset = f.scrollMomentum * PARALLAX_MAX_PX;
      frame.audio.filterCutoff += Math.abs(f.scrollMomentum) * 0.1;
    },
  },
  {
    id: 'keystroke',
    apply(f, _b, frame) {
      frame.visual.grain = f.typingRate;
      frame.audio.noteDensity += f.typingRate * 0.2;
    },
  },
  {
    id: 'page-new',
    apply(f, _b, frame) {
      frame.audio.chord = f.chordStep;
      frame.visual.hueShift += f.chordStep * 30;
    },
  },
  {
    id: 'page-revisit',
    apply(f, _b, frame) {
      const echo = fade(f.revisitAgeMs, REVISIT_FADE_MS);
      if (echo === 0) return;
      frame.audio.chord = f.revisitChord;
      frame.audio.delayFeedback = 0.6 * echo;
      frame.visual.ghost = echo;
    },
  },
  {
    id: 'page-dwell',
    apply(f, b, frame) {
      const voices = Math.min(
        MAX_VOICES,
        Math.floor(f.dwellMs / b.voiceJoinMs),
      );
      frame.audio.voiceCount = voices;
      frame.visual.layerCount = voices;
    },
  },
  {
    id: 'visit-time',
    apply(f, b, frame) {
      // Spring opens the filter, summer brings voices, autumn closes the filter,
      // winter is sparse with long reverb. Time away counts: the piece moves on.
      const season = Math.floor(f.visitMs / b.seasonMs) % 4;
      const filter = [0.15, 0.1, -0.15, -0.1][season] ?? 0;
      frame.audio.filterCutoff += filter;
      frame.audio.voiceCount += season === 1 ? 1 : 0;
      frame.audio.noteDensity *= season === 3 ? 0.5 : 1;
      frame.audio.reverbMix += season === 3 ? 0.3 : 0;
      frame.visual.hueShift += season * 90;
      frame.visual.saturation *= [1, 1.1, 0.85, 0.6][season] ?? 1;
    },
  },
  {
    id: 'tab-hidden',
    apply(f, _b, frame) {
      if (f.hidden) {
        frame.audio.masterLevel = 0;
        frame.visual.dim = 1;
        return;
      }
      const mark = fade(f.returnAgeMs, ABSENCE_FADE_MS);
      frame.visual.absenceMark =
        mark * Math.min(1, f.lastAbsenceMs / 60000 + 0.3);
      frame.audio.droneLevel += mark * 0.2;
    },
  },
];

export const EVENT_ROWS: readonly EventRow[] = [
  {
    id: 'click',
    onEvent(event, f, b) {
      if (event.kind !== 'click') return [];
      const x = (event.gx + 0.5) / 64;
      const y = (event.gy + 0.5) / 64;
      return [
        {
          kind: 'pluck',
          pitchMidi: scaleNote(b, 1 - y),
          pan: x * 2 - 1,
          quantized: f.order > ORDER_LOCK,
        },
        { kind: 'ripple', x, y, inverse: false },
      ];
    },
  },
  {
    id: 'scroll',
    onEvent(event) {
      if (event.kind !== 'scroll' || event.dy === 0) return [];
      return [
        {
          kind: 'glide',
          direction: event.dy > 0 ? 'down' : 'up',
          lengthMs: Math.min(2000, 200 + Math.abs(event.dy) * 20),
        },
      ];
    },
  },
  {
    id: 'keystroke',
    onEvent(event) {
      return event.kind === 'keystroke' ? [{ kind: 'tick' }] : [];
    },
  },
  {
    id: 'page-back',
    onEvent(event) {
      if (event.kind !== 'page' || event.nav !== 'traverse') return [];
      return [
        { kind: 'glide', direction: 'back', lengthMs: 1200 },
        { kind: 'swell', reason: 'reverse' },
        { kind: 'ripple', x: 0.5, y: 0.5, inverse: true },
      ];
    },
  },
  {
    id: 'tab-hidden',
    onEvent(event) {
      return event.kind === 'visibility' && !event.hidden
        ? [{ kind: 'swell', reason: 'absence' }]
        : [];
    },
  },
  {
    id: 'theme',
    onEvent(event) {
      return event.kind === 'theme' ? [{ kind: 'swell', reason: 'theme' }] : [];
    },
  },
  {
    // Mute and Pause motion are access controls: no trace in the piece.
    id: 'controls-unmapped',
    onEvent() {
      return [];
    },
  },
];

/**
 * The frame at visit time `t`, plus the triggers for `events` (the events folded
 * since the previous call). Pure: the same input always gives the same output.
 */
export function map(
  features: Features,
  backdrop: Backdrop,
  events: readonly VisitEvent[],
): { frame: ParameterFrame; triggers: Trigger[] } {
  const frame = neutralFrame();
  for (const row of CONTINUOUS_ROWS) row.apply(features, backdrop, frame);
  const triggers: Trigger[] = [];
  for (const event of events) {
    for (const row of EVENT_ROWS) {
      triggers.push(...row.onEvent(event, features, backdrop));
    }
  }
  return { frame: clampFrame(frame), triggers };
}
