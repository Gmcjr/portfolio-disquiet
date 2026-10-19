import { describe, expect, it } from 'vitest';
import { createFlashCounter } from './shaderVisualEngine';

const frame = (value: number): Uint8Array =>
  new Uint8Array(8 * 6 * 4).fill(value);

describe('flash counter (localhost probe)', () => {
  it('counts a 10 Hz black and white flicker as more than 3 flashes a second', () => {
    const counter = createFlashCounter();
    let flashes = 0;
    for (let ms = 0; ms <= 1000; ms += 50) {
      flashes = counter.add(frame(ms % 100 === 0 ? 0 : 255), 8, 6, ms);
    }
    expect(flashes).toBeGreaterThan(3);
  });

  it('counts a slow fade as no flash, and reports the mean luminance', () => {
    const counter = createFlashCounter();
    let flashes = 0;
    for (let ms = 0; ms <= 2000; ms += 16) {
      flashes = counter.add(frame(Math.round((ms / 2000) * 255)), 8, 6, ms);
    }
    expect(flashes).toBe(0);
    expect(counter.mean()).toBeGreaterThan(0.9);
  });
});
