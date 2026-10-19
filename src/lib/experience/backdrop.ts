// The start environment that the key sets: the "things beyond your control"
// (ADR-0008 §2; plan §3, backdrop rows). The key is 64 hex characters; each
// backdrop value comes from its own generator stream, so values do not correlate.

import { createPRNG } from './key.js';
import {
  AIRS,
  BEDS,
  HYDRA_OPS,
  LEADS,
  MAX_CHAIN,
  MOODS,
  P5_SCENES,
  PERCUSSION,
  SHADER_SCENES,
  type Air,
  type Bed,
  type HydraOp,
  type Lead,
  type Mood,
  type P5Scene,
  type Percussion,
  type ShaderScene,
} from './params.js';

export { MOODS, type Mood };

export type Texture = 'grain' | 'flow' | 'strata';
export type Waveform = 'sine' | 'triangle' | 'sawtooth';
export type ScaleName =
  'minor-pentatonic' | 'major-pentatonic' | 'dorian' | 'aeolian';
export type Emergence = 'gradual' | 'sudden';
export type Ending = 'whiteout' | 'blackout';
/** About 1 visit in 4 gets a sound mood that differs from its image mood. */
export const CROSSED_MOOD_SHARE = 0.25;

export const SCALES: Readonly<Record<ScaleName, readonly number[]>> = {
  'minor-pentatonic': [0, 3, 5, 7, 10],
  'major-pentatonic': [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
};

export interface Backdrop {
  /** backdrop-palette: anchor hue in degrees. */
  paletteHue: number;
  /** backdrop-texture. */
  texture: Texture;
  /** backdrop-key: the root note, MIDI 45 (A2) – 56 (G#3). */
  rootMidi: number;
  scale: ScaleName;
  /** backdrop-waveform. */
  waveform: Waveform;
  /** backdrop-reverb: seconds. */
  reverbSeconds: number;
  /** backdrop-emergence: how the Goodbye showcase starts. */
  emergence: Emergence;
  /** backdrop-ending: how Goodbye ends. */
  ending: Ending;
  /** backdrop-mood: the style of the image (ADR-0008 Amendment 2). */
  visualMood: Mood;
  /** backdrop-mood: the style of the sound; mostly the same as the image. */
  audioMood: Mood;
  /** backdrop-sources: the sound and image banks (ADR-0008 Amendment 3). */
  lead: Lead;
  bed: Bed;
  percussion: Percussion;
  air: Air;
  shaderScene: ShaderScene;
  p5Scene: P5Scene;
  /** backdrop-chain: the Hydra-style ops on the shader image (Amendment 5). */
  chain: readonly HydraOp[];
  /** Row long-stillness: one breath cycle, 6–10 s (user decision). */
  breathMs: number;
  /** Row page-dwell: time between new voices, 15–30 s (user decision). */
  voiceJoinMs: number;
  /** Row visit-time: one season, 1–4 min (user decision; default range). */
  seasonMs: number;
}

const pick = <T>(items: readonly T[], rand: () => number, fallback: T): T =>
  items[Math.floor(rand() * items.length)] ?? fallback;

const between = (rand: () => number, min: number, max: number): number =>
  Math.round(min + rand() * (max - min));

/** 1 – MAX_CHAIN distinct ops, from their own stream of the key. */
function pickChain(rand: () => number): HydraOp[] {
  const length = 1 + Math.floor(rand() * MAX_CHAIN);
  const left = [...HYDRA_OPS];
  const chain: HydraOp[] = [];
  while (chain.length < length && left.length > 0) {
    const [op] = left.splice(Math.floor(rand() * left.length), 1);
    if (op !== undefined) chain.push(op);
  }
  return chain;
}

export function deriveBackdrop(key: string): Backdrop {
  const a = createPRNG(key.slice(0, 16));
  const b = createPRNG(key.slice(16, 32));
  const c = createPRNG(key.slice(32, 48));
  const d = createPRNG(key.slice(48, 64));
  const m = createPRNG(key.slice(4, 20));
  const visualMood = pick(MOODS, m, 'ethereal');
  const others = MOODS.filter((mood) => mood !== visualMood);
  const audioMood =
    m() < CROSSED_MOOD_SHARE ? pick(others, m, visualMood) : visualMood;
  // Its own stream, so the earlier backdrop values do not change.
  const banks = createPRNG(key.slice(24, 40));
  const scales = Object.keys(SCALES) as ScaleName[];
  return {
    paletteHue: Math.floor(a() * 360),
    texture: pick<Texture>(['grain', 'flow', 'strata'], a, 'grain'),
    rootMidi: 45 + Math.floor(b() * 12),
    scale: pick(scales, b, 'minor-pentatonic'),
    waveform: pick<Waveform>(['sine', 'triangle', 'sawtooth'], b, 'sine'),
    reverbSeconds: Math.round((0.8 + c() * 2.2) * 10) / 10,
    emergence: pick<Emergence>(['gradual', 'sudden'], c, 'gradual'),
    ending: pick<Ending>(['whiteout', 'blackout'], c, 'blackout'),
    breathMs: between(d, 6000, 10000),
    voiceJoinMs: between(d, 15000, 30000),
    seasonMs: between(d, 60000, 240000),
    visualMood,
    audioMood,
    lead: pick(LEADS, banks, 'bells'),
    bed: pick(BEDS, banks, 'fm'),
    percussion: pick(PERCUSSION, banks, 'noise'),
    air: pick(AIRS, banks, 'hush'),
    shaderScene: pick(SHADER_SCENES, banks, 'waves'),
    p5Scene: pick(P5_SCENES, banks, 'strokes'),
    chain: pickChain(createPRNG(key.slice(40, 56))),
  };
}

/** A note of the backdrop's scale. `position` is 0 (low) – 1 (high), two octaves. */
export function scaleNote(backdrop: Backdrop, position: number): number {
  const steps = SCALES[backdrop.scale];
  const span = steps.length * 2;
  const index = Math.min(span - 1, Math.max(0, Math.floor(position * span)));
  const octave = Math.floor(index / steps.length);
  const step = steps[index % steps.length] ?? 0;
  return backdrop.rootMidi + 12 + octave * 12 + step;
}
