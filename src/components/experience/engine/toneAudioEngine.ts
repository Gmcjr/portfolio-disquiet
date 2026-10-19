// The Tone.js sound for the Goodbye piece (ADR-0008 Amendments 2 and 3), behind
// the same AudioEngine interface. Two things combine:
//   the sources (the key picks one of each bank): a lead voice for notes, a bed for
//   held chords, a percussion voice for key presses, and an air layer of noise;
//   the atmosphere: the air, a haze pad, and a texture that never stop;
//   the mood (the treatment): psychedelic sends the sources through a phaser, a
//   wide chorus, and a slow auto-pan; glitchy through a square stutter, distortion,
//   and short repeats, with short envelopes; ethereal through an octave shimmer and
//   a long reverb, with long envelopes.
// Safety stays at the last step: the output gain never goes above MASTER_GAIN_MAX,
// and a high-pass filter removes anything below 40 Hz.
//
// Tone is imported module by module, never from 'tone': its main entry creates a
// default context at import time, and that context starts a blob: worker that the
// CSP blocks. No module here uses an AudioWorklet (also blob:, also blocked):
// BitCrusher, Freeverb, JCReverb, the comb filters, and PluckSynth are excluded.

import { Panner } from 'tone/build/esm/component/channel/Panner.js';
import { Limiter } from 'tone/build/esm/component/dynamics/Limiter.js';
import { Filter } from 'tone/build/esm/component/filter/Filter.js';
import { Context } from 'tone/build/esm/core/context/Context.js';
import { Gain } from 'tone/build/esm/core/context/Gain.js';
import type { ToneAudioNode } from 'tone/build/esm/core/context/ToneAudioNode.js';
import { getContext, setContext } from 'tone/build/esm/core/Global.js';
import { AutoFilter } from 'tone/build/esm/effect/AutoFilter.js';
import { AutoPanner } from 'tone/build/esm/effect/AutoPanner.js';
import { Chorus } from 'tone/build/esm/effect/Chorus.js';
import { Distortion } from 'tone/build/esm/effect/Distortion.js';
import { FeedbackDelay } from 'tone/build/esm/effect/FeedbackDelay.js';
import { Phaser } from 'tone/build/esm/effect/Phaser.js';
import { PingPongDelay } from 'tone/build/esm/effect/PingPongDelay.js';
import { PitchShift } from 'tone/build/esm/effect/PitchShift.js';
import { Reverb } from 'tone/build/esm/effect/Reverb.js';
import { Tremolo } from 'tone/build/esm/effect/Tremolo.js';
import { Vibrato } from 'tone/build/esm/effect/Vibrato.js';
import { AMSynth } from 'tone/build/esm/instrument/AMSynth.js';
import { DuoSynth } from 'tone/build/esm/instrument/DuoSynth.js';
import { FMSynth } from 'tone/build/esm/instrument/FMSynth.js';
import { MembraneSynth } from 'tone/build/esm/instrument/MembraneSynth.js';
import { MetalSynth } from 'tone/build/esm/instrument/MetalSynth.js';
import { MonoSynth } from 'tone/build/esm/instrument/MonoSynth.js';
import { NoiseSynth } from 'tone/build/esm/instrument/NoiseSynth.js';
import { PolySynth } from 'tone/build/esm/instrument/PolySynth.js';
import { Synth } from 'tone/build/esm/instrument/Synth.js';
import { Noise } from 'tone/build/esm/source/Noise.js';
import { FatOscillator } from 'tone/build/esm/source/oscillator/FatOscillator.js';
import {
  MASTER_GAIN_MAX,
  MIN_FREQ_HZ,
  ONSET_RAMP_MIN_MS,
  PLUCK_PEAK_MAX,
  midiToHz,
  safeFrequency,
  safeMasterGain,
  type AudioParams,
  type AudioSetup,
  type Bed,
  type Lead,
  type Mood,
  type Percussion,
  type Trigger,
} from '../../../lib/experience/params';
import type { AudioEngine } from './audioEngine';

const LEAD_VOICES = 6;

/** How the mood stretches envelopes: glitchy cuts them, ethereal draws them out. */
const STRETCH: Readonly<Record<Mood, number>> = {
  psychedelic: 1,
  glitchy: 0.3,
  ethereal: 2.2,
};

function createLead(lead: Lead, stretch: number): PolySynth {
  const decay = (seconds: number): number => seconds * stretch;
  const options = { maxPolyphony: LEAD_VOICES };
  switch (lead) {
    case 'bells':
      return new PolySynth(FMSynth, {
        ...options,
        harmonicity: 3.01,
        modulationIndex: 12,
        envelope: { attack: 0.001, decay: decay(1.4), sustain: 0, release: 1 },
        modulationEnvelope: { attack: 0.002, decay: decay(0.6), sustain: 0 },
        volume: -8,
      });
    case 'strings':
      // A plucked string: a bright saw whose filter closes fast.
      return new PolySynth(MonoSynth, {
        ...options,
        oscillator: { type: 'sawtooth' },
        filter: { Q: 2, type: 'lowpass', rolloff: -24 },
        envelope: {
          attack: 0.002,
          decay: decay(0.9),
          sustain: 0,
          release: 0.4,
        },
        filterEnvelope: {
          attack: 0.001,
          decay: decay(0.25),
          sustain: 0,
          baseFrequency: 180,
          octaves: 4,
        },
        volume: -10,
      });
    case 'glass':
      return new PolySynth(AMSynth, {
        ...options,
        harmonicity: 2.5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: decay(2), sustain: 0, release: 1.5 },
        volume: -6,
      });
    case 'marimba':
      return new PolySynth(FMSynth, {
        ...options,
        harmonicity: 4,
        modulationIndex: 2,
        envelope: {
          attack: 0.001,
          decay: decay(0.5),
          sustain: 0,
          release: 0.3,
        },
        modulationEnvelope: { attack: 0.001, decay: decay(0.1), sustain: 0 },
        volume: -6,
      });
  }
}

type BedSynth =
  | PolySynth<FMSynth>
  | PolySynth<DuoSynth>
  | PolySynth<AMSynth>
  | PolySynth<Synth>;

function createBed(bed: Bed, mood: Mood): BedSynth {
  const envelope =
    mood === 'glitchy'
      ? { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3 }
      : { attack: 2 * STRETCH[mood], decay: 1, sustain: 0.7, release: 4 };
  switch (bed) {
    case 'fm':
      return new PolySynth(FMSynth, {
        harmonicity: mood === 'psychedelic' ? 2.5 : 1,
        modulationIndex: mood === 'glitchy' ? 12 : 6,
        envelope,
        volume: -22,
      });
    case 'duo':
      return new PolySynth(DuoSynth, {
        vibratoAmount: 0.2,
        harmonicity: 1.5,
        volume: -24,
        voice0: { envelope },
        voice1: { envelope },
      });
    case 'am':
      return new PolySynth(AMSynth, {
        harmonicity: 1.5,
        oscillator: { type: 'triangle' },
        envelope,
        volume: -20,
      });
    case 'fat':
      return new PolySynth(Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 30 },
        envelope,
        volume: -28,
      });
  }
}

interface Hitter {
  hit(at: number): void;
  node: ToneAudioNode;
}

function createPercussion(
  kind: Percussion,
  mood: Mood,
  pitchHz: number,
): Hitter {
  const short = mood === 'glitchy';
  switch (kind) {
    case 'noise': {
      const synth = new NoiseSynth({
        noise: { type: short ? 'white' : 'pink' },
        envelope: { attack: 0.001, decay: short ? 0.02 : 0.04, sustain: 0 },
        volume: short ? -24 : -30,
      });
      return { node: synth, hit: (at) => synth.triggerAttackRelease(0.03, at) };
    }
    case 'metal': {
      const synth = new MetalSynth({
        harmonicity: 5.1,
        modulationIndex: 16,
        resonance: 3000,
        octaves: 1.5,
        envelope: { attack: 0.001, decay: short ? 0.05 : 0.15, release: 0.05 },
        volume: -38,
      });
      synth.frequency.value = 250;
      return { node: synth, hit: (at) => synth.triggerAttackRelease(0.05, at) };
    }
    case 'membrane': {
      const synth = new MembraneSynth({
        pitchDecay: short ? 0.02 : 0.06,
        octaves: 3,
        envelope: { attack: 0.001, decay: short ? 0.12 : 0.35, sustain: 0 },
        volume: -16,
      });
      return {
        node: synth,
        hit: (at) => synth.triggerAttackRelease(pitchHz, 0.1, at),
      };
    }
  }
}

export function createToneAudioEngine(
  context: AudioContext,
  setup: AudioSetup,
  rand: () => number,
): AudioEngine {
  // Use the context that the Goodbye click created: Safari unlocks audio only there.
  // The clock runs on timers, not a blob: worker: the CSP has worker-src 'none'.
  setContext(new Context({ context, clockSource: 'timeout' }));
  const now = (): number => getContext().now();
  const mood = setup.mood;
  let muted = false;
  let level = 1;

  // Output: gain limit → 40 Hz floor → limiter → speakers.
  const out = new Gain(0);
  out.chain(
    new Filter(MIN_FREQ_HZ, 'highpass'),
    new Limiter(-6),
    getContext().destination,
  );

  // Shared space: reverb and delay, set per mood.
  const reverb = new Reverb({
    decay:
      mood === 'ethereal'
        ? 8 + setup.reverbSeconds * 2
        : 2 + setup.reverbSeconds,
    wet: mood === 'ethereal' ? 0.55 : 0.3,
  });
  reverb.connect(out);
  const delay =
    mood === 'glitchy'
      ? new FeedbackDelay({ delayTime: '32n', feedback: 0.2, wet: 0.35 })
      : new PingPongDelay({ delayTime: '8n', feedback: 0, wet: 0.3 });
  delay.connect(reverb);
  const tone = new Filter(1800, 'lowpass');
  tone.connect(delay);
  tone.connect(reverb);
  const panner = new Panner(0);
  panner.connect(tone);

  // The mood's treatment. Every source goes through it.
  const nodes: ToneAudioNode[] = [reverb, delay, tone, panner];
  let treatment: ToneAudioNode;
  if (mood === 'psychedelic') {
    const phaser = new Phaser({
      frequency: 0.3,
      octaves: 4,
      baseFrequency: 400,
      wet: 0.6,
    });
    const chorus = new Chorus({
      frequency: 1.2,
      delayTime: 4,
      depth: 0.8,
      wet: 0.7,
    });
    chorus.start();
    const autoPan = new AutoPanner({ frequency: 0.08, depth: 0.8 });
    autoPan.start();
    phaser.chain(chorus, autoPan, panner);
    nodes.push(phaser, chorus, autoPan);
    treatment = phaser;
  } else if (mood === 'glitchy') {
    const stutter = new Tremolo({
      frequency: 8,
      type: 'square',
      depth: 0.6,
      spread: 0,
    });
    stutter.start();
    const crunch = new Distortion({ distortion: 0.5, wet: 0.4 });
    stutter.chain(crunch, panner);
    nodes.push(stutter, crunch);
    treatment = stutter;
  } else {
    const shimmer = new PitchShift({ pitch: 12, wet: 0.25, feedback: 0.3 });
    const chorus = new Chorus({
      frequency: 0.3,
      delayTime: 6,
      depth: 0.4,
      wet: 0.5,
    });
    chorus.start();
    shimmer.chain(chorus, panner);
    nodes.push(shimmer, chorus);
    treatment = shimmer;
  }

  const note = (step: number, octave: number): number => {
    const steps = setup.scale.length > 0 ? setup.scale : [0];
    const index = ((step % steps.length) + steps.length) % steps.length;
    return (
      setup.rootMidi +
      12 * (octave + Math.floor(step / steps.length)) +
      (steps[index] ?? 0)
    );
  };
  const hz = (midi: number): number => safeFrequency(midiToHz(midi));

  // The sources.
  const bed = createBed(setup.bed, mood);
  bed.connect(treatment);
  const lead = createLead(setup.lead, STRETCH[mood]);
  lead.connect(treatment);
  const percussion = createPercussion(setup.percussion, mood, hz(note(0, 0)));
  const percussionFilter = new Filter(
    setup.percussion === 'membrane' ? 4000 : mood === 'glitchy' ? 3000 : 5000,
    setup.percussion === 'membrane' ? 'lowpass' : 'bandpass',
  );
  percussion.node.chain(percussionFilter, tone);
  nodes.push(bed, lead, percussion.node, percussionFilter);

  const drone = new FatOscillator({
    frequency: safeFrequency(midiToHz(setup.rootMidi - 12)),
    type:
      mood === 'glitchy'
        ? 'square'
        : setup.waveform === 'sine'
          ? 'sine'
          : 'triangle',
    spread: mood === 'psychedelic' ? 40 : 18,
    count: 3,
    volume: -60,
  });
  drone.connect(treatment);
  drone.start();
  nodes.push(drone);

  // Atmosphere (ADR-0008 Amendment 4): three layers that never stop, so the space
  // is never empty. Stillness (droneLevel) makes all three rise.
  // 1. The air: slow filtered noise. Wind sweeps a band; surf rolls low waves;
  //    hush is a soft room tone.
  const AIR = {
    wind: { noise: 'pink', rate: 0.07, base: 400, octaves: 3, band: true },
    surf: { noise: 'brown', rate: 0.12, base: 120, octaves: 4, band: false },
    hush: { noise: 'pink', rate: 0.03, base: 200, octaves: 2, band: false },
  } as const;
  const airShape = AIR[setup.air];
  const air = new Noise({ type: airShape.noise, volume: -60 });
  const sweep = new AutoFilter({
    frequency: airShape.rate,
    baseFrequency: airShape.base,
    octaves: airShape.octaves,
    depth: 0.9,
    filter: {
      type: airShape.band ? 'bandpass' : 'lowpass',
      Q: 1,
      rolloff: -12,
    },
  });
  sweep.start();
  air.chain(sweep, reverb);
  air.start();
  nodes.push(air, sweep);

  // 2. The haze pad: root and fifth, held for the whole piece, breathing through a
  //    slow filter. Psychedelic adds a tape wobble.
  const haze = new PolySynth(Synth, {
    oscillator: { type: 'fattriangle', count: 3, spread: 20 },
    envelope: { attack: 6, decay: 2, sustain: 1, release: 8 },
    volume: -60,
  });
  const breath = new AutoFilter({
    frequency: 0.04,
    baseFrequency: 250,
    octaves: 3,
    depth: 0.8,
    filter: { type: 'lowpass', Q: 1, rolloff: -12 },
  });
  breath.start();
  haze.connect(breath);
  nodes.push(haze, breath);
  if (mood === 'psychedelic') {
    const wobble = new Vibrato({ frequency: 0.4, depth: 0.12 });
    breath.chain(wobble, tone);
    nodes.push(wobble);
  } else {
    breath.connect(tone);
  }
  haze.triggerAttack([hz(setup.rootMidi + 12), hz(setup.rootMidi + 19)], now());

  // 3. The texture, by mood: bright hiss (ethereal), tape hiss (psychedelic), or
  //    hiss with crackle (glitchy). The crackle follows the note density.
  const hiss = new Noise({ type: 'white', volume: -60 });
  const hissFilter = new Filter(
    mood === 'ethereal' ? 6000 : 3500,
    mood === 'psychedelic' ? 'bandpass' : 'highpass',
  );
  hiss.chain(hissFilter, reverb);
  hiss.start();
  nodes.push(hiss, hissFilter);
  let crackle: NoiseSynth | null = null;
  if (mood === 'glitchy') {
    crackle = new NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.006, sustain: 0 },
      volume: -30,
    });
    const crackleFilter = new Filter(2000, 'highpass');
    crackle.chain(crackleFilter, tone);
    nodes.push(crackle, crackleFilter);
  }

  const glider = new MonoSynth({
    oscillator: {
      type:
        mood === 'glitchy'
          ? 'square'
          : setup.waveform === 'sawtooth'
            ? 'triangle'
            : setup.waveform,
    },
    portamento: mood === 'glitchy' ? 0.05 : 0.8,
    envelope: { attack: 0.2, release: 1.2 },
    volume: -22,
  });
  glider.connect(tone);
  nodes.push(glider);

  function play(midi: number, velocity: number): void {
    // Glitchy notes jump an octave at random.
    const jump =
      mood === 'glitchy' && rand() < 0.3 ? 12 * (rand() < 0.5 ? -1 : 1) : 0;
    lead.triggerAttackRelease(
      hz(midi + jump),
      0.4 * STRETCH[mood],
      now(),
      Math.min(PLUCK_PEAK_MAX, velocity),
    );
  }

  let held: number[] = [];
  function setChord(chord: number, voices: number): void {
    const want = Array.from({ length: voices }, (_, i) =>
      hz(note(chord * 2 + i * 2, 0)),
    );
    const at = now();
    const release = held.filter((f) => !want.includes(f));
    const attack = want.filter((f) => !held.includes(f));
    if (release.length > 0) bed.triggerRelease(release, at);
    if (attack.length > 0) bed.triggerAttack(attack, at, 0.5);
    held = want;
  }

  function setOutput(): void {
    const target = muted ? 0 : safeMasterGain(level * MASTER_GAIN_MAX);
    out.gain.rampTo(target, muted ? 0.05 : ONSET_RAMP_MIN_MS / 1000);
  }

  return {
    apply(params: AudioParams, triggers: readonly Trigger[], tickMs: number) {
      level = params.masterLevel;
      setOutput();
      tone.frequency.rampTo(
        safeFrequency(200 * 30 ** params.filterCutoff),
        0.2,
      );
      panner.pan.rampTo(params.pan, 0.2);
      reverb.wet.rampTo(
        Math.max(params.reverbMix, mood === 'ethereal' ? 0.45 : 0.3),
        0.6,
      );
      if (delay instanceof PingPongDelay) {
        delay.feedback.rampTo(Math.min(0.7, params.delayFeedback), 0.4);
      }
      drone.volume.rampTo(-40 + params.droneLevel * 22, 0.8);
      drone.detune.rampTo(params.detuneCents, 0.8);
      // The atmosphere follows the drone: it rises in stillness and long dwells.
      air.volume.rampTo(-38 + params.droneLevel * 16, 1.5);
      haze.volume.rampTo(-34 + params.droneLevel * 12, 1.5);
      hiss.volume.rampTo(-56 + params.droneLevel * 8, 1.5);
      if (
        crackle !== null &&
        rand() < (0.6 + params.noteDensity * 2) * (tickMs / 1000)
      ) {
        crackle.triggerAttackRelease(0.01, now());
      }
      bed.set({ detune: params.detuneCents });
      setChord(params.chord, params.voiceCount);
      if (rand() < params.noteDensity * (tickMs / 1000) * 2) {
        play(note(Math.floor(rand() * 10), 1), 0.3);
      }
      for (const trigger of triggers) {
        if (trigger.kind === 'pluck') play(trigger.pitchMidi, PLUCK_PEAK_MAX);
        else if (trigger.kind === 'tick') percussion.hit(now());
        else if (trigger.kind === 'glide') {
          const from = note(trigger.direction === 'up' ? 2 : 6, 0);
          const to = trigger.direction === 'up' ? from + 7 : from - 7;
          glider.triggerAttack(hz(from));
          glider.setNote(hz(to), `+${trigger.lengthMs / 1000}`);
          glider.triggerRelease(`+${trigger.lengthMs / 1000 + 0.2}`);
        } else if (trigger.kind === 'swell') {
          bed.triggerAttackRelease(hz(note(0, -1)), 2.5, now(), 0.6);
        }
      }
    },
    setMuted(next: boolean) {
      muted = next;
      setOutput();
    },
    close() {
      out.gain.rampTo(0, 0.05);
      for (const node of nodes) node.dispose();
      void context.close().catch(() => undefined);
    },
  };
}
