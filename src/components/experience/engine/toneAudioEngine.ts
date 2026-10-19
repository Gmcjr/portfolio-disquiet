// The Tone.js sound for the Goodbye piece (ADR-0008 Amendment 2), behind the same
// AudioEngine interface. The mood sets the instruments and effects:
//   psychedelic: FM pads through a phaser and a wide chorus, slow auto-pan;
//   glitchy: square plucks, distortion, short repeats, stutter, noise bursts;
//   ethereal: soft duo-voice pads, an octave shimmer, and a long reverb.
// Safety stays at the last step: the output gain never goes above MASTER_GAIN_MAX,
// and a high-pass filter removes anything below 40 Hz.
//
// Tone is imported module by module, never from 'tone': its main entry creates a
// default context at import time, and that context starts a blob: worker that the
// CSP blocks. No module here uses an AudioWorklet (also blob:, also blocked).

import { Panner } from 'tone/build/esm/component/channel/Panner.js';
import { Limiter } from 'tone/build/esm/component/dynamics/Limiter.js';
import { Filter } from 'tone/build/esm/component/filter/Filter.js';
import { Context } from 'tone/build/esm/core/context/Context.js';
import { Gain } from 'tone/build/esm/core/context/Gain.js';
import type { ToneAudioNode } from 'tone/build/esm/core/context/ToneAudioNode.js';
import { getContext, setContext } from 'tone/build/esm/core/Global.js';
import { AutoPanner } from 'tone/build/esm/effect/AutoPanner.js';
import { Chorus } from 'tone/build/esm/effect/Chorus.js';
import { Distortion } from 'tone/build/esm/effect/Distortion.js';
import { FeedbackDelay } from 'tone/build/esm/effect/FeedbackDelay.js';
import { Phaser } from 'tone/build/esm/effect/Phaser.js';
import { PingPongDelay } from 'tone/build/esm/effect/PingPongDelay.js';
import { PitchShift } from 'tone/build/esm/effect/PitchShift.js';
import { Reverb } from 'tone/build/esm/effect/Reverb.js';
import { Tremolo } from 'tone/build/esm/effect/Tremolo.js';
import { DuoSynth } from 'tone/build/esm/instrument/DuoSynth.js';
import { FMSynth } from 'tone/build/esm/instrument/FMSynth.js';
import { MonoSynth } from 'tone/build/esm/instrument/MonoSynth.js';
import { NoiseSynth } from 'tone/build/esm/instrument/NoiseSynth.js';
import { PolySynth } from 'tone/build/esm/instrument/PolySynth.js';
import { Synth } from 'tone/build/esm/instrument/Synth.js';
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
  type Trigger,
} from '../../../lib/experience/params';
import type { AudioEngine } from './audioEngine';

const PLUCK_VOICES = 6;

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

  // The mood's colour on the pads and drone.
  const nodes: ToneAudioNode[] = [reverb, delay];
  let padIn: ToneAudioNode;
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
    padIn = phaser;
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
    padIn = stutter;
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
    padIn = shimmer;
  }

  const pad =
    mood === 'ethereal'
      ? new PolySynth(DuoSynth, {
          vibratoAmount: 0.2,
          harmonicity: 1.5,
          volume: -24,
          voice0: { envelope: { attack: 3, release: 6 } },
          voice1: { envelope: { attack: 3, release: 6 } },
        })
      : new PolySynth(FMSynth, {
          harmonicity: mood === 'psychedelic' ? 2.5 : 1,
          modulationIndex: mood === 'psychedelic' ? 6 : 12,
          oscillator: { type: mood === 'glitchy' ? 'square' : 'sine' },
          envelope:
            mood === 'glitchy'
              ? { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3 }
              : { attack: 2, decay: 1, sustain: 0.7, release: 4 },
          volume: -22,
        });
  pad.connect(padIn);

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
  drone.connect(padIn);
  drone.start();

  const plucks = Array.from({ length: PLUCK_VOICES }, () => {
    const voice = new Synth({
      oscillator: {
        type:
          mood === 'glitchy'
            ? 'square'
            : mood === 'ethereal'
              ? 'sine'
              : 'triangle',
      },
      envelope:
        mood === 'ethereal'
          ? { attack: 0.02, decay: 1.6, sustain: 0, release: 2.5 }
          : mood === 'glitchy'
            ? { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
            : { attack: 0.005, decay: 0.6, sustain: 0, release: 0.8 },
    });
    voice.connect(panner);
    return voice;
  });
  let nextPluck = 0;

  const ticks = new NoiseSynth({
    noise: { type: mood === 'glitchy' ? 'white' : 'pink' },
    envelope: {
      attack: 0.001,
      decay: mood === 'glitchy' ? 0.02 : 0.04,
      sustain: 0,
    },
    volume: mood === 'glitchy' ? -24 : -30,
  });
  const tickFilter = new Filter(mood === 'glitchy' ? 3000 : 5000, 'bandpass');
  ticks.chain(tickFilter, tone);

  const glider = new MonoSynth({
    oscillator: { type: mood === 'glitchy' ? 'square' : 'sine' },
    portamento: mood === 'glitchy' ? 0.05 : 0.8,
    envelope: { attack: 0.2, release: 1.2 },
    volume: -22,
  });
  glider.connect(tone);

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

  function pluck(midi: number, velocity: number): void {
    const voice = plucks[nextPluck % PLUCK_VOICES];
    nextPluck += 1;
    // Glitchy plucks jump an octave at random.
    const jump =
      mood === 'glitchy' && rand() < 0.3 ? 12 * (rand() < 0.5 ? -1 : 1) : 0;
    const length = mood === 'ethereal' ? 1.6 : 0.6;
    voice?.triggerAttackRelease(
      hz(midi + jump),
      length,
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
    if (release.length > 0) pad.triggerRelease(release, at);
    if (attack.length > 0) pad.triggerAttack(attack, at, 0.5);
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
        Math.max(params.reverbMix, mood === 'ethereal' ? 0.4 : 0),
        0.6,
      );
      if (delay instanceof PingPongDelay) {
        delay.feedback.rampTo(Math.min(0.7, params.delayFeedback), 0.4);
      }
      drone.volume.rampTo(-40 + params.droneLevel * 22, 0.8);
      drone.detune.rampTo(params.detuneCents, 0.8);
      pad.set({ detune: params.detuneCents });
      setChord(params.chord, params.voiceCount);
      if (rand() < params.noteDensity * (tickMs / 1000) * 2) {
        pluck(note(Math.floor(rand() * 10), 1), 0.3);
      }
      for (const trigger of triggers) {
        if (trigger.kind === 'pluck') pluck(trigger.pitchMidi, PLUCK_PEAK_MAX);
        else if (trigger.kind === 'tick') ticks.triggerAttackRelease(0.03);
        else if (trigger.kind === 'glide') {
          const from = note(trigger.direction === 'up' ? 2 : 6, 0);
          const to = trigger.direction === 'up' ? from + 7 : from - 7;
          glider.triggerAttack(hz(from));
          glider.setNote(hz(to), `+${trigger.lengthMs / 1000}`);
          glider.triggerRelease(`+${trigger.lengthMs / 1000 + 0.2}`);
        } else if (trigger.kind === 'swell') {
          pad.triggerAttackRelease(hz(note(0, -1)), 2.5, now(), 0.6);
        }
      }
    },
    setMuted(next: boolean) {
      muted = next;
      setOutput();
    },
    close() {
      out.gain.rampTo(0, 0.05);
      for (const node of [pad, drone, glider, ticks, ...plucks, ...nodes])
        node.dispose();
      void context.close().catch(() => undefined);
    },
  };
}
