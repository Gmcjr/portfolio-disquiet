import { describe, expect, it } from 'vitest';
import {
  MASTER_GAIN_MAX,
  MIN_FREQ_HZ,
  neutralFrame,
  type AudioParams,
} from '../../../lib/experience/params';
import { createAudioEngine } from './audioEngine';
import type { AudioContextLike, ParamLike } from '../record/ports';

/** A fake context that records every value set on every parameter. */
function fakeContext() {
  const gains: number[] = [];
  const frequencies: number[] = [];
  const param = (log: number[]): ParamLike => ({
    value: 0,
    setValueAtTime: (v: number) => log.push(v),
    setTargetAtTime: (v: number) => log.push(v),
    linearRampToValueAtTime: (v: number) => log.push(v),
    cancelScheduledValues: () => undefined,
  });
  const node = () => ({
    connect: () => undefined,
    disconnect: () => undefined,
  });
  const masters: number[] = [];
  let firstGain = true;
  const ctx: AudioContextLike = {
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    createGain: () => {
      const log = firstGain ? masters : gains;
      firstGain = false;
      return { ...node(), gain: param(log) };
    },
    createOscillator: () => ({
      ...node(),
      type: 'sine',
      frequency: param(frequencies),
      start: () => undefined,
      stop: () => undefined,
    }),
    createBiquadFilter: () => ({
      ...node(),
      type: 'lowpass',
      frequency: param(frequencies),
    }),
    createStereoPanner: () => ({ ...node(), pan: param([]) }),
    createDelay: () => ({ ...node(), delayTime: param([]) }),
    createConvolver: () => ({ ...node(), buffer: null }),
    createDynamicsCompressor: () => node(),
    createBuffer: (_channels, length) => ({
      getChannelData: () => new Float32Array(length),
    }),
    resume: () => Promise.resolve(),
    suspend: () => Promise.resolve(),
    close: () => Promise.resolve(),
  };
  return { ctx, masters, frequencies };
}

const SETUP = {
  rootMidi: 21, // A0, very low on purpose: the floor must lift it
  scale: [0, 3, 5, 7, 10],
  waveform: 'sine' as const,
  mood: 'ethereal' as const,
  lead: 'bells' as const,
  bed: 'fm' as const,
  percussion: 'noise' as const,
  air: 'none' as const,
  reverbSeconds: 0.1,
};

describe('audio engine safety', () => {
  it('never sets the master gain above the limit or a frequency below 40 Hz', () => {
    const { ctx, masters, frequencies } = fakeContext();
    let i = 0;
    const engine = createAudioEngine(ctx, SETUP, () => (i++ % 10) / 10);
    const extreme: AudioParams = {
      ...neutralFrame().audio,
      masterLevel: 50,
      filterCutoff: -5,
      noteDensity: 1,
      detuneCents: -10_000,
      voiceCount: 4,
    };
    for (let tick = 0; tick < 50; tick += 1) {
      engine.apply(
        extreme,
        [{ kind: 'pluck', pitchMidi: 0, pan: 0, quantized: false }],
        100,
      );
    }
    engine.setMuted(false);
    expect(Math.max(...masters)).toBeLessThanOrEqual(MASTER_GAIN_MAX);
    expect(Math.min(...frequencies)).toBeGreaterThanOrEqual(MIN_FREQ_HZ);
  });
});
