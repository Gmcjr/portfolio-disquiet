// Colour helpers for flash safety (WCAG 2.3.1). The Goodbye art is full colour
// (ADR-0008 Amendment 1), with no brightness band; the visual engine still avoids
// saturated red, which the red-flash rule singles out.

import { SATURATED_RED_RATIO } from './params.js';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const channel = (value: number): number => {
  const c = Math.min(255, Math.max(0, value)) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.2 relative luminance, 0–1. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** True when red makes up 80% or more of the colour (gamma or linear values). */
export function isSaturatedRed({ r, g, b }: Rgb): boolean {
  const gamma = r + g + b;
  const lr = channel(r);
  const linear = lr + channel(g) + channel(b);
  return (
    (gamma > 0 && r / gamma >= SATURATED_RED_RATIO) ||
    (linear > 0 && lr / linear >= SATURATED_RED_RATIO)
  );
}

/** HSL (h in degrees, s and l in 0–1) to RGB in 0–255. */
export function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/**
 * A palette colour that is never saturated red: it lowers the saturation in
 * steps until the colour passes. Pure grey always passes.
 */
export function safeColor(h: number, s: number, l: number): Rgb {
  for (let sat = s; sat > 0; sat -= 0.1) {
    const rgb = hslToRgb(h, sat, l);
    if (!isSaturatedRed(rgb)) return rgb;
  }
  return hslToRgb(h, 0, l);
}
