// Types only: everything the shell gets from the browser comes in through these
// ports, so tests can pass fakes (ADR-0009 §6). No default values anywhere.

export type WarnCode =
  | 'engine-load-failed'
  | 'audio-unavailable'
  | 'canvas-unavailable'
  | 'storage-unavailable'
  | 'crypto-unavailable'
  | 'record-discarded'
  | 'record-expired'
  | 'timeline-full'
  | 'speech-unavailable';

/** Logs a code only, never data (security review D-10). */
export type Warn = (code: WarnCode) => void;

export interface Clock {
  /** Monotonic milliseconds, for durations inside one page load. */
  now(): number;
  /** Epoch milliseconds, for the stored record. */
  epochNow(): number;
}

export interface Scheduler {
  frame(callback: (ms: number) => void): number;
  cancelFrame(id: number): void;
  interval(callback: () => void, ms: number): number;
  clearInterval(id: number): void;
  /** Runs when the browser is idle, or after timeoutMs at the latest. */
  idle(callback: () => void, timeoutMs: number): void;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// The parts of the Web Audio API that the audio engine uses. A real AudioContext
// fits these types; tests pass a fake that records every value set.
export interface ParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  setTargetAtTime(value: number, time: number, timeConstant: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  cancelScheduledValues(time: number): unknown;
}
export interface NodeLike {
  connect(destination: NodeLike): unknown;
  disconnect(): void;
}
export interface GainLike extends NodeLike {
  gain: ParamLike;
}
export interface OscillatorLike extends NodeLike {
  type: OscillatorType;
  frequency: ParamLike;
  start(when: number): void;
  stop(when: number): void;
}
export interface FilterLike extends NodeLike {
  type: BiquadFilterType;
  frequency: ParamLike;
}
export interface PannerLike extends NodeLike {
  pan: ParamLike;
}
export interface DelayLike extends NodeLike {
  delayTime: ParamLike;
}
export interface BufferLike {
  getChannelData(channel: number): Float32Array;
}
export interface ConvolverLike extends NodeLike {
  buffer: BufferLike | null;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: NodeLike;
  createGain(): GainLike;
  createOscillator(): OscillatorLike;
  createBiquadFilter(): FilterLike;
  createStereoPanner(): PannerLike;
  createDelay(maxDelayTime: number): DelayLike;
  createConvolver(): ConvolverLike;
  createDynamicsCompressor(): NodeLike;
  createBuffer(
    channels: number,
    length: number,
    sampleRate: number,
  ): BufferLike;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
}

export interface DialogPort {
  open(): void;
  close(): void;
  onCancel(callback: () => void): void;
}
