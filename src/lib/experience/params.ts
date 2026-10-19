// What the engines play and draw (ADR-0009 §3), and every safety limit as one
// named constant. The mapping clamps to these limits; the engines enforce the
// audio ones again at the output, so no mapping can override them.

// Sound safety (design D-12).
export const MASTER_GAIN_MAX = 0.15;
export const PLUCK_PEAK_MAX = 0.6;
export const ONSET_RAMP_MIN_MS = 2000;
export const MIN_FREQ_HZ = 40;
export const DETUNE_MAX_CENTS = 25;

// Image safety (design D-3, D-4; WCAG 2.3.1, 2.2.2).
export const MAX_BRIGHT_TRIGGERS_PER_S = 3;
export const BRIGHTNESS_RAMP_MIN_MS = 800;
export const WHITEOUT_BLACKOUT_MIN_MS = 5000;
export const SATURATED_RED_RATIO = 0.8;
export const PARALLAX_MAX_PX = 24;
export const REDUCED_REDRAW_MIN_MS = 4000;

// Goodbye message timing (design D-8).
export const MESSAGE_FADE_MS = 1200;
export const MESSAGE_GAP_MS = 400;
export const MESSAGE_HOLD_MIN_MS = 2500;
export const MESSAGE_HOLD_BASE_MS = 1000;
export const MESSAGE_MS_PER_WORD = 300;

export const MAX_VOICES = 4;

/** The master gain the engine may set: never above MASTER_GAIN_MAX. */
export function safeMasterGain(level: number): number {
  return Number.isFinite(level)
    ? Math.min(MASTER_GAIN_MAX, Math.max(0, level))
    : 0;
}

/** A frequency the engine may play: never below MIN_FREQ_HZ. */
export function safeFrequency(hz: number): number {
  return Number.isFinite(hz) ? Math.max(MIN_FREQ_HZ, hz) : MIN_FREQ_HZ;
}

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

// The mood sets the treatment (effects, timing, palette). The banks set the
// sources (instruments and scenes). The key picks one of each per visit
// (ADR-0008 Amendment 3).
export const MOODS = ['psychedelic', 'glitchy', 'ethereal'] as const;
export type Mood = (typeof MOODS)[number];
/** The melodic voice: clicks, keys, and the random notes. */
export const LEADS = ['bells', 'strings', 'glass', 'marimba'] as const;
export type Lead = (typeof LEADS)[number];
/** The held chords. */
export const BEDS = ['fm', 'duo', 'am', 'fat'] as const;
export type Bed = (typeof BEDS)[number];
/** The short hits: key presses. */
export const PERCUSSION = ['noise', 'metal', 'membrane'] as const;
export type Percussion = (typeof PERCUSSION)[number];
/** A noise layer under everything; every visit has one (ADR-0008 Amendment 4). */
export const AIRS = ['wind', 'surf', 'hush'] as const;
export type Air = (typeof AIRS)[number];
/** The shader image (psychedelic and glitchy moods). */
export const SHADER_SCENES = [
  'waves',
  'tunnel',
  'cells',
  'marble',
  'rings',
] as const;
export type ShaderScene = (typeof SHADER_SCENES)[number];
/**
 * Hydra-style ops on the shader image (ADR-0008 Amendment 5), named after Hydra's
 * functions. osc and shape add a layer; the others move the image coordinates.
 */
export const HYDRA_OPS = [
  'osc',
  'shape',
  'rotate',
  'scale',
  'repeat',
  'modulate',
  'pixelate',
] as const;
export type HydraOp = (typeof HYDRA_OPS)[number];
export const MAX_CHAIN = 3;
/** The p5 image (ethereal mood). */
export const P5_SCENES = ['strokes', 'orbits', 'aurora'] as const;
export type P5Scene = (typeof P5_SCENES)[number];

/** What the audio engine needs from the backdrop, so it never imports backdrop.ts. */
export interface AudioSetup {
  rootMidi: number;
  /** Semitone steps of the scale above the root. */
  scale: readonly number[];
  waveform: 'sine' | 'triangle' | 'sawtooth';
  reverbSeconds: number;
  mood: Mood;
  lead: Lead;
  bed: Bed;
  percussion: Percussion;
  air: Air;
}

/** What the visual engine needs from the backdrop. */
export interface VisualSetup {
  paletteHue: number;
  texture: 'grain' | 'flow' | 'strata';
  mood: Mood;
  shaderScene: ShaderScene;
  p5Scene: P5Scene;
  /** 1 – MAX_CHAIN distinct ops, in the order they apply. */
  chain: readonly HydraOp[];
}

export type Motion = 'full' | 'reduced' | 'paused';

/** Every field is a normalized engine control; no field is named after an input. */
export interface AudioParams {
  /** 0–1; the engine scales it by MASTER_GAIN_MAX. */
  masterLevel: number;
  /** 0 (dark) – 1 (bright). */
  filterCutoff: number;
  /** -1 (left) – 1 (right). */
  pan: number;
  noteDensity: number;
  detuneCents: number;
  droneLevel: number;
  reverbMix: number;
  delayFeedback: number;
  /** 0 – MAX_VOICES. */
  voiceCount: number;
  /** Step in the chord progression; an integer ≥ 0. */
  chord: number;
}

export interface VisualParams {
  lightX: number;
  lightY: number;
  particleSpeed: number;
  turbulence: number;
  /** 0 (scattered) – 1 (aligned into flow lines). */
  flow: number;
  saturation: number;
  trailLength: number;
  /** 0 (full) – 1 (dark). */
  dim: number;
  /** Degrees added to the palette anchor. */
  hueShift: number;
  grain: number;
  /** Pixels, at most PARALLAX_MAX_PX in either direction. */
  layerOffset: number;
  /** 0 – MAX_VOICES. */
  layerCount: number;
  /** 0–1 strength of the faint image from a page's first visit. */
  ghost: number;
  /** 0–1 strength of the mark that records a time away. */
  absenceMark: number;
}

export interface ParameterFrame {
  audio: AudioParams;
  visual: VisualParams;
}

export type Trigger =
  | { kind: 'pluck'; pitchMidi: number; pan: number; quantized: boolean }
  | { kind: 'ripple'; x: number; y: number; inverse: boolean }
  | { kind: 'glide'; direction: 'up' | 'down' | 'back'; lengthMs: number }
  | { kind: 'tick' }
  | { kind: 'swell'; reason: 'theme' | 'absence' | 'reverse' };

export function neutralFrame(): ParameterFrame {
  return {
    audio: {
      masterLevel: 1,
      filterCutoff: 0.5,
      pan: 0,
      noteDensity: 0.2,
      detuneCents: 0,
      droneLevel: 0.4,
      reverbMix: 0.3,
      delayFeedback: 0,
      voiceCount: 0,
      chord: 0,
    },
    visual: {
      lightX: 0.5,
      lightY: 0.5,
      particleSpeed: 0.2,
      turbulence: 0.1,
      flow: 0.5,
      saturation: 0.6,
      trailLength: 0.2,
      dim: 0,
      hueShift: 0,
      grain: 0,
      layerOffset: 0,
      layerCount: 0,
      ghost: 0,
      absenceMark: 0,
    },
  };
}

export const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

const unit = (value: number): number => clamp(value, 0, 1);

/** Clamps every field to its range. Non-finite values become the minimum. */
export function clampFrame(frame: ParameterFrame): ParameterFrame {
  const { audio: a, visual: v } = frame;
  return {
    audio: {
      masterLevel: unit(a.masterLevel),
      filterCutoff: unit(a.filterCutoff),
      pan: clamp(a.pan, -1, 1),
      noteDensity: unit(a.noteDensity),
      detuneCents: clamp(a.detuneCents, -DETUNE_MAX_CENTS, DETUNE_MAX_CENTS),
      droneLevel: unit(a.droneLevel),
      reverbMix: unit(a.reverbMix),
      delayFeedback: clamp(a.delayFeedback, 0, 0.7),
      voiceCount: Math.round(clamp(a.voiceCount, 0, MAX_VOICES)),
      chord: Math.max(0, Math.floor(Number.isFinite(a.chord) ? a.chord : 0)),
    },
    visual: {
      lightX: unit(v.lightX),
      lightY: unit(v.lightY),
      particleSpeed: unit(v.particleSpeed),
      turbulence: unit(v.turbulence),
      flow: unit(v.flow),
      saturation: unit(v.saturation),
      trailLength: unit(v.trailLength),
      dim: unit(v.dim),
      hueShift:
        (((Number.isFinite(v.hueShift) ? v.hueShift : 0) % 360) + 360) % 360,
      grain: unit(v.grain),
      layerOffset: clamp(v.layerOffset, -PARALLAX_MAX_PX, PARALLAX_MAX_PX),
      layerCount: Math.round(clamp(v.layerCount, 0, MAX_VOICES)),
      ghost: unit(v.ghost),
      absenceMark: unit(v.absenceMark),
    },
  };
}

/** Ripples and swells change brightness, so they count against the flash limit. */
export function isBright(trigger: Trigger): boolean {
  return trigger.kind === 'ripple' || trigger.kind === 'swell';
}

/**
 * Keeps at most MAX_BRIGHT_TRIGGERS_PER_S bright triggers in any 1 s window.
 * `recent` holds the times of bright triggers already let through; it is updated
 * in place and pruned. Non-bright triggers always pass.
 */
export function limitBright(
  triggers: readonly Trigger[],
  recent: number[],
  nowMs: number,
): Trigger[] {
  while (recent.length > 0 && nowMs - (recent[0] ?? nowMs) >= 1000) {
    recent.shift();
  }
  const allowed: Trigger[] = [];
  for (const trigger of triggers) {
    if (!isBright(trigger)) {
      allowed.push(trigger);
    } else if (recent.length < MAX_BRIGHT_TRIGGERS_PER_S) {
      recent.push(nowMs);
      allowed.push(trigger);
    }
  }
  return allowed;
}
