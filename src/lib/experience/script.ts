// The Goodbye sequence: message texts and the cue timeline (ADR-0008 §5).
//
// The texts are the user's own words: every phrase is copied verbatim from
// docs/notes/experience-raw-note.md (a test checks this). Do not rewrite them.
// Each visit plays one short variant, which its key picks (user decision,
// 2026-10-19). These variants are drafts; the user edits the words later.

import type { Backdrop, Emergence, Ending } from './backdrop.js';
import { createPRNG } from './key.js';
import {
  MESSAGE_FADE_MS,
  MESSAGE_GAP_MS,
  MESSAGE_HOLD_BASE_MS,
  MESSAGE_HOLD_MIN_MS,
  MESSAGE_MS_PER_WORD,
} from './params.js';

/** One message set: a line before the showcase, and lines over it. */
export interface MessageVariant {
  opening: readonly string[];
  closing: readonly string[];
}

export const MESSAGE_VARIANTS: readonly MessageVariant[] = [
  {
    opening: ['thank you for taking the ride.'],
    closing: [
      'Your relatively brief visit was a collaboration from the start.',
      "it's a memory.",
    ],
  },
  {
    opening: ["Without you, this wouldn't exist..."],
    closing: [
      'Every action and every inaction meant something, whether you were aware of it or not.',
      "It's the evidence, the proof that it happened.",
    ],
  },
  {
    opening: ["It's an artistic, or stylized expression of a moment."],
    closing: [
      'the impermanent echo of your effort and attention',
      'the ghost of your curiosity',
    ],
  },
  {
    opening: ['thank you for taking the ride.'],
    closing: [
      'We were co-creators throughout that cycle and this is what we created together.',
      "it's your life flashing before your eyes.",
    ],
  },
  {
    opening: ['Inhale, exhale, take it all in, and then let it go'],
    closing: [
      'chaos, turned to order, back to chaos, back to order',
      "it's a memory.",
    ],
  },
  {
    opening: ["Without you, this wouldn't exist..."],
    closing: [
      'something uniquely yours, or unique to this moment.',
      "It's the evidence, the proof that it happened.",
    ],
  },
];

/** The visit's variant: its own stream of the key, so a replay gets the same one. */
export function pickVariant(key: string): MessageVariant {
  const index = Math.floor(
    createPRNG(key.slice(8, 24))() * MESSAGE_VARIANTS.length,
  );
  return (
    MESSAGE_VARIANTS[index] ??
    MESSAGE_VARIANTS[0] ?? { opening: [], closing: [] }
  );
}

export const REMEMBER = 'Remember?';

export const DARK_IN_MS = 2000;
export const SECOND_MESSAGES_DELAY_MS = 5000;
export const REMEMBER_FADE_MS = 2000;
export const REMEMBER_HOLD_MS = 4000;
export const FADE_BACK_IN_MS = 2000;
export const EMERGENCE_MS: Readonly<Record<Emergence, number>> = {
  gradual: 6000,
  sudden: 800,
};
export const WHITEOUT_SWELL_MS = 3000;
export const WHITEOUT_HOLD_MS = 800;
export const WHITEOUT_TO_BLACK_MS = 2000;
export const BLACKOUT_MS = 3000;

/** How long a sentence stays on screen: 200 words a minute, at least 2.5 s. */
export function holdMs(text: string): number {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  return Math.max(
    MESSAGE_HOLD_MIN_MS,
    MESSAGE_HOLD_BASE_MS + MESSAGE_MS_PER_WORD * words,
  );
}

export type Cue =
  | { kind: 'dark'; atMs: number; durationMs: number }
  | { kind: 'message'; atMs: number; text: string; holdMs: number }
  | { kind: 'showcase'; atMs: number; rampMs: number; durationMs: number }
  | { kind: 'remember'; atMs: number; text: string }
  | { kind: 'ending'; atMs: number; ending: Ending; durationMs: number }
  | { kind: 'fade-in'; atMs: number; durationMs: number };

const messageSpan = (text: string): number =>
  MESSAGE_FADE_MS + holdMs(text) + MESSAGE_FADE_MS + MESSAGE_GAP_MS;

/**
 * The full cue timeline. With reduced or paused motion, the showcase always
 * emerges gradually and the ending is always a blackout.
 */
export function buildCues(
  backdrop: Backdrop,
  calmMotion: boolean,
  showcaseMs: number,
  variant: MessageVariant,
): Cue[] {
  const cues: Cue[] = [{ kind: 'dark', atMs: 0, durationMs: DARK_IN_MS }];
  let at = DARK_IN_MS;
  for (const text of variant.opening) {
    cues.push({ kind: 'message', atMs: at, text, holdMs: holdMs(text) });
    at += messageSpan(text);
  }
  const showcaseAt = at;
  const emergence: Emergence = calmMotion ? 'gradual' : backdrop.emergence;
  cues.push({
    kind: 'showcase',
    atMs: showcaseAt,
    rampMs: EMERGENCE_MS[emergence],
    durationMs: showcaseMs,
  });
  at = showcaseAt + SECOND_MESSAGES_DELAY_MS;
  for (const text of variant.closing) {
    cues.push({ kind: 'message', atMs: at, text, holdMs: holdMs(text) });
    at += messageSpan(text);
  }
  at = Math.max(at, showcaseAt + showcaseMs);
  cues.push({ kind: 'remember', atMs: at, text: REMEMBER });
  at += REMEMBER_FADE_MS + REMEMBER_HOLD_MS;
  const ending: Ending = calmMotion ? 'blackout' : backdrop.ending;
  const endingMs =
    ending === 'whiteout'
      ? WHITEOUT_SWELL_MS + WHITEOUT_HOLD_MS + WHITEOUT_TO_BLACK_MS
      : BLACKOUT_MS;
  cues.push({ kind: 'ending', atMs: at, ending, durationMs: endingMs });
  at += endingMs;
  cues.push({ kind: 'fade-in', atMs: at, durationMs: FADE_BACK_IN_MS });
  return cues;
}

/** The visit's messages, in order, for "Show all text". */
export function allText(variant: MessageVariant): string[] {
  return [...variant.opening, ...variant.closing, REMEMBER];
}
