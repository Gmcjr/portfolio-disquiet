// Web Audio engine (ADR-0009 §3). It plays parameter frames and triggers; it
// never reads events or the mapping. The master gain limit and the 40 Hz floor
// are enforced here again, at the last step before the output.

import {
  MAX_VOICES,
  ONSET_RAMP_MIN_MS,
  PLUCK_PEAK_MAX,
  midiToHz,
  safeFrequency,
  safeMasterGain,
  MASTER_GAIN_MAX,
  type AudioParams,
  type AudioSetup,
  type Trigger,
} from '../../../lib/experience/params';
import type {
  AudioContextLike,
  GainLike,
  OscillatorLike,
} from '../record/ports';

const SMOOTH_S = 0.15;
const FILTER_MIN_HZ = 180;
const FILTER_MAX_HZ = 6000;

export interface AudioEngine {
  apply(
    params: AudioParams,
    triggers: readonly Trigger[],
    tickMs: number,
  ): void;
  setMuted(muted: boolean): void;
  close(): void;
}

export function createAudioEngine(
  ctx: AudioContextLike,
  setup: AudioSetup,
  rand: () => number,
): AudioEngine {
  const at = (): number => ctx.currentTime;
  let muted = false;
  let level = 1;

  const master = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  master.gain.setValueAtTime(0, at());
  master.connect(limiter);
  limiter.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const panner = ctx.createStereoPanner();
  filter.connect(panner);
  panner.connect(master);

  // Reverb from seeded noise, and a feedback delay for echoes.
  const reverb = ctx.createConvolver();
  const length = Math.max(1, Math.round(setup.reverbSeconds * ctx.sampleRate));
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (const channel of [0, 1]) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      data[i] = (rand() * 2 - 1) * (1 - i / length) ** 2;
    }
  }
  reverb.buffer = impulse;
  const reverbSend = ctx.createGain();
  filter.connect(reverbSend);
  reverbSend.connect(reverb);
  reverb.connect(master);
  const delay = ctx.createDelay(1);
  delay.delayTime.setValueAtTime(0.38, at());
  const feedback = ctx.createGain();
  feedback.gain.setValueAtTime(0, at());
  filter.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  feedback.connect(master);

  const note = (step: number, octave: number): number => {
    const steps = setup.scale.length > 0 ? setup.scale : [0];
    const index = ((step % steps.length) + steps.length) % steps.length;
    const extra = Math.floor(step / steps.length);
    return setup.rootMidi + 12 * (octave + extra) + (steps[index] ?? 0);
  };

  function oscillator(midi: number, gain: GainLike): OscillatorLike {
    const osc = ctx.createOscillator();
    osc.type = setup.waveform;
    osc.frequency.setValueAtTime(safeFrequency(midiToHz(midi)), at());
    osc.connect(gain);
    return osc;
  }

  // Drone: the root and the fifth, an octave down.
  const droneGain = ctx.createGain();
  droneGain.gain.setValueAtTime(0, at());
  droneGain.connect(filter);
  const drone = [note(0, -1), setup.rootMidi - 5].map((midi) => {
    const osc = oscillator(midi, droneGain);
    osc.start(at());
    return { osc, midi };
  });

  // Voices: chord tones that join with time on a page.
  const voices = Array.from({ length: MAX_VOICES }, (_, i) => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at());
    gain.connect(filter);
    const osc = oscillator(note(i * 2, 0), gain);
    osc.start(at());
    return { osc, gain };
  });

  function pluck(midi: number, pan: number, peak: number): void {
    const now = at();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(
      Math.min(PLUCK_PEAK_MAX, peak),
      now + 0.01,
    );
    gain.gain.setTargetAtTime(0, now + 0.02, 0.35);
    const panNode = ctx.createStereoPanner();
    panNode.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
    gain.connect(panNode);
    panNode.connect(filter);
    const osc = oscillator(midi, gain);
    osc.start(now);
    osc.stop(now + 2);
  }

  function glide(direction: 'up' | 'down' | 'back', lengthMs: number): void {
    const now = at();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain.gain.linearRampToValueAtTime(0, now + lengthMs / 1000);
    gain.connect(filter);
    const start = note(direction === 'up' ? 2 : 6, 0);
    const end = direction === 'up' ? start + 7 : start - 7;
    const osc = oscillator(start, gain);
    osc.frequency.linearRampToValueAtTime(
      safeFrequency(midiToHz(end)),
      now + lengthMs / 1000,
    );
    osc.start(now);
    osc.stop(now + lengthMs / 1000 + 0.1);
  }

  function swell(): void {
    const now = at();
    const target = Math.min(1, droneGain.gain.value + 0.3);
    droneGain.gain.cancelScheduledValues(now);
    droneGain.gain.linearRampToValueAtTime(target, now + 1.2);
  }

  function setMaster(): void {
    const target = muted ? 0 : safeMasterGain(level * MASTER_GAIN_MAX);
    master.gain.setTargetAtTime(
      target,
      at(),
      muted ? 0.05 : ONSET_RAMP_MIN_MS / 3000,
    );
  }

  return {
    apply(params, triggers, tickMs) {
      const now = at();
      level = params.masterLevel;
      setMaster();
      const cutoff =
        FILTER_MIN_HZ * (FILTER_MAX_HZ / FILTER_MIN_HZ) ** params.filterCutoff;
      filter.frequency.setTargetAtTime(safeFrequency(cutoff), now, SMOOTH_S);
      panner.pan.setTargetAtTime(params.pan, now, SMOOTH_S);
      droneGain.gain.setTargetAtTime(params.droneLevel * 0.35, now, 0.6);
      reverbSend.gain.setTargetAtTime(params.reverbMix, now, 0.6);
      feedback.gain.setTargetAtTime(params.delayFeedback, now, 0.4);
      const detune = 2 ** (params.detuneCents / 1200);
      for (const { osc, midi } of drone) {
        osc.frequency.setTargetAtTime(
          safeFrequency(midiToHz(midi) * detune),
          now,
          0.8,
        );
      }
      const chordRoot = params.chord * 2;
      voices.forEach(({ osc, gain }, i) => {
        const on = i < params.voiceCount;
        gain.gain.setTargetAtTime(on ? 0.08 : 0, now, 1.5);
        const hz = safeFrequency(midiToHz(note(chordRoot + i * 2, 0)) * detune);
        osc.frequency.setTargetAtTime(hz, now, 0.8);
      });
      // Notes from density: the chance of a note in this tick.
      if (rand() < params.noteDensity * (tickMs / 1000) * 2) {
        pluck(note(Math.floor(rand() * 10), 1), params.pan, 0.25);
      }
      for (const trigger of triggers) {
        if (trigger.kind === 'pluck')
          pluck(trigger.pitchMidi, trigger.pan, PLUCK_PEAK_MAX);
        else if (trigger.kind === 'glide')
          glide(trigger.direction, trigger.lengthMs);
        else if (trigger.kind === 'tick') pluck(note(4, 2), 0, 0.08);
        else if (trigger.kind === 'swell') swell();
      }
    },
    setMuted(next) {
      muted = next;
      setMaster();
    },
    close() {
      for (const { osc } of [...drone, ...voices]) osc.stop(at());
      master.disconnect();
      void ctx.close().catch(() => undefined);
    },
  };
}
