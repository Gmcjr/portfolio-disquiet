export interface SeedInfo {
  seed: string;
}

export interface DerivedTokens {
  hue: number; // 0-359
  opacity: number; // 0-1
  fontIdx: number; // 0-2 → selects from predefined font tokens
  synth: {
    oscType: 'sine' | 'square' | 'triangle' | 'sawtooth';
    detune: number; // cents, range approx -1200-1200
    reverb: number; // seconds
  };
  sketch: {
    shapeCount: number;
    bgHue: number;
  };
}

export type Metric =
  | { type: 'click'; element: string; timestamp: number }
  | { type: 'time'; durationMs: number }
  | { type: 'sketch'; action: string; timestamp: number };
