// The p5.js image for the ethereal mood (ADR-0008 Amendments 2 and 3), behind the
// same VisualEngine interface. The scene (the key picks one):
//   strokes: painterly strokes that follow a noise flow field;
//   orbits: particles that circle the light, in rings that order keeps round;
//   aurora: soft curtains of light that sway across the sky.
// The visit's input steers their speed, order, colour, and density. Instance
// mode, so nothing leaks into the page, and dispose() removes the sketch.

import p5 from 'p5';
import {
  BRIGHTNESS_RAMP_MIN_MS,
  type VisualParams,
  type VisualSetup,
} from '../../../lib/experience/params';
import type { Rgb, VisualEngine } from './visualEngine';

export interface P5EngineDeps {
  host: HTMLElement;
  setup: VisualSetup;
  rand: () => number;
  safeColor: (h: number, s: number, l: number) => Rgb;
}

const STROKES = 600;
const SMOOTH_MS = 400;
const RIPPLE_MS = 1400;

interface Stroke {
  x: number;
  y: number;
  hue: number;
}

export function createP5VisualEngine(deps: P5EngineDeps): VisualEngine {
  const { host, setup, rand, safeColor } = deps;
  let shown: VisualParams | null = null;
  let target: VisualParams | null = null;
  let dt = 16;
  let still = false;
  let share = 1;
  let time = 0;
  const strokes: Stroke[] = Array.from({ length: STROKES }, () => ({
    x: rand(),
    y: rand(),
    hue: (rand() - 0.5) * 90,
  }));
  const ripples: { x: number; y: number; age: number; inverse: boolean }[] = [];
  const seed = Math.floor(rand() * 1_000_000);

  // Atmosphere (ADR-0008 Amendment 4): haze, dust, grain, and a fixed vignette, on
  // an overlay canvas that is cleared every frame, so the layers never build up
  // on the trails below. They move only with `time`, so they stop when the image
  // stops.
  const overlay = document.createElement('canvas');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  overlay.width = host.clientWidth || window.innerWidth;
  overlay.height = host.clientHeight || window.innerHeight;
  host.append(overlay);
  const octx = overlay.getContext('2d');
  const tile = (
    size: number,
    fill: (i: number) => number,
  ): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    if (ctx !== null) {
      const data = ctx.createImageData(size, size);
      for (let i = 0; i < size * size; i += 1) {
        const value = fill(i);
        data.data.set([value, value, value, 255], i * 4);
      }
      ctx.putImageData(data, 0, 0);
    }
    return c;
  };
  const grainTile = tile(128, () => Math.floor(rand() * 256));
  // Soft fog: a few large blurred blobs, drawn once at a low resolution.
  const fogTile = document.createElement('canvas');
  fogTile.width = 64;
  fogTile.height = 64;
  const fctx = fogTile.getContext('2d');
  if (fctx !== null) {
    for (let i = 0; i < 14; i += 1) {
      const x = rand() * 64;
      const y = rand() * 64;
      const r = 8 + rand() * 18;
      const g = fctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      fctx.fillStyle = g;
      for (const dx of [-64, 0, 64]) {
        for (const dy of [-64, 0, 64]) {
          fctx.setTransform(1, 0, 0, 1, dx, dy);
          fctx.fillRect(0, 0, 64, 64);
        }
      }
    }
    fctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  const motes = Array.from({ length: 60 }, () => ({
    x: rand(),
    y: rand(),
    phase: rand() * Math.PI * 2,
    speed: 0.004 + rand() * 0.01,
  }));

  function drawAtmosphere(v: VisualParams, hue: number): void {
    if (octx === null) return;
    const w = overlay.width;
    const h = overlay.height;
    octx.clearRect(0, 0, w, h);
    const fade = 1 - v.dim;
    // Haze: the fog tile, tinted and stretched, in two drifting layers.
    const fog = safeColor(hue + 30, 0.25, 0.7);
    octx.globalCompositeOperation = 'source-over';
    for (const [scale, drift, alpha] of [
      [1.2, 0.02, 0.55],
      [0.7, 0.035, 0.45],
    ] as const) {
      const size = Math.max(w, h) * scale;
      const ox = -((time * drift * size) % size);
      octx.globalAlpha = alpha * (0.15 + v.trailLength * 0.35) * fade;
      for (const x of [ox, ox + size]) {
        for (let y = 0; y < h; y += size)
          // Skip the 1 px border, so smoothing at the tile edge leaves no seam.
          octx.drawImage(fogTile, 1, 1, 62, 62, x, y, size, size);
      }
    }
    octx.globalCompositeOperation = 'source-atop';
    octx.globalAlpha = 1;
    octx.fillStyle = `rgb(${fog.r},${fog.g},${fog.b})`;
    octx.fillRect(0, 0, w, h);
    octx.globalCompositeOperation = 'source-over';
    // Dust: motes that rise and fade in and out over several seconds.
    const dust = safeColor(hue + 60, 0.2, 0.85);
    octx.fillStyle = `rgb(${dust.r},${dust.g},${dust.b})`;
    for (const mote of motes) {
      const y = (((mote.y - time * mote.speed) % 1) + 1) % 1;
      octx.globalAlpha =
        (0.5 + 0.5 * Math.sin(time * 0.4 + mote.phase)) *
        0.5 *
        (0.4 + v.trailLength) *
        fade;
      octx.beginPath();
      octx.arc(mote.x * w, y * h, 1.5, 0, Math.PI * 2);
      octx.fill();
    }
    // Grain: always a little, more with typing. It moves with time only.
    const pattern = octx.createPattern(grainTile, 'repeat');
    if (pattern !== null) {
      const shift = Math.floor(time * 97) % 128;
      octx.globalAlpha = 0.05 * (0.35 + v.grain);
      octx.globalCompositeOperation = 'overlay';
      octx.translate(shift, shift);
      octx.fillStyle = pattern;
      octx.fillRect(-shift, -shift, w, h);
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.globalCompositeOperation = 'source-over';
    }
    // Vignette: fixed, never pulsing.
    const vignette = octx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.35,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.75,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    octx.globalAlpha = 1;
    octx.fillStyle = vignette;
    octx.fillRect(0, 0, w, h);
  }

  const ease = (from: number, to: number, tau: number): number =>
    from + (to - from) * Math.min(1, dt / tau);

  const instance = new p5((p: p5) => {
    p.setup = () => {
      p.createCanvas(
        host.clientWidth || window.innerWidth,
        host.clientHeight || window.innerHeight,
      );
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 1.5));
      p.noiseSeed(seed);
      p.noLoop();
      p.background(0);
    };
    p.draw = () => {
      if (target === null) return;
      const next: VisualParams = { ...target };
      if (shown !== null) {
        for (const key of Object.keys(target) as (keyof VisualParams)[]) {
          next[key] = ease(
            shown[key],
            target[key],
            key === 'dim' ? BRIGHTNESS_RAMP_MIN_MS : SMOOTH_MS,
          );
        }
      }
      shown = next;
      const v = next;
      const w = p.width;
      const h = p.height;
      const hue = setup.paletteHue + v.hueShift;
      const rgb = (hh: number, s: number, l: number, a: number): void => {
        const c = safeColor(hh, s, l);
        p.stroke(c.r, c.g, c.b, a * 255);
        p.fill(c.r, c.g, c.b, a * 255);
      };

      // Fade the canvas toward the backdrop: long trails when still, short when busy.
      const base = safeColor(
        hue,
        0.35 + v.saturation * 0.3,
        0.08 + (1 - v.dim) * 0.1,
      );
      p.noStroke();
      p.fill(
        base.r,
        base.g,
        base.b,
        // Aurora has no trails: its soft fills would build up into a wash.
        (still || setup.p5Scene === 'aurora'
          ? 1
          : 0.08 + (1 - v.trailLength) * 0.25) * 255,
      );
      p.rect(0, 0, w, h);

      // The light that follows the pointer.
      const glow = p.drawingContext as CanvasRenderingContext2D;
      const lx = v.lightX * w;
      const ly = v.lightY * h;
      const gradient = glow.createRadialGradient(
        lx,
        ly,
        0,
        lx,
        ly,
        Math.max(w, h) * 0.5,
      );
      const light = safeColor(hue + 40, v.saturation, 0.6);
      gradient.addColorStop(
        0,
        `rgba(${light.r},${light.g},${light.b},${0.04 * (1 - v.dim)})`,
      );
      gradient.addColorStop(1, `rgba(${light.r},${light.g},${light.b},0)`);
      // Direct canvas drawing goes inside save() and restore(): p5 caches its
      // fill colour, and a changed fillStyle would leak into its next fill.
      glow.save();
      glow.fillStyle = gradient;
      glow.fillRect(0, 0, w, h);
      glow.restore();

      function drawStrokes(count: number, step: number): void {
        for (let i = 0; i < count; i += 1) {
          const s = strokes[i];
          if (s === undefined) continue;
          const field =
            p.noise(s.x * 2.5, s.y * 2.5, time * 0.3) *
            Math.PI *
            4 *
            (1 - v.flow * 0.7);
          const angle =
            field + (p.noise(i, time) - 0.5) * Math.PI * 2 * v.turbulence;
          const nx = s.x + Math.cos(angle) * step;
          const ny = s.y + Math.sin(angle) * step;
          rgb(hue + s.hue, v.saturation, 0.7, 0.6 * (1 - v.dim));
          p.line(s.x * w, s.y * h, nx * w, ny * h);
          s.x = (nx + 1) % 1;
          s.y = (ny + 1) % 1;
        }
      }

      time += still ? 0 : (dt / 1000) * (0.1 + v.particleSpeed);
      const count = Math.round(STROKES * Math.max(0.25, Math.min(1, share)));
      const step = still ? 0 : 0.0015 + v.particleSpeed * 0.006;
      p.strokeWeight(1 + v.grain * 2);
      if (setup.p5Scene === 'orbits') {
        // Each particle keeps its ring around the light. Turbulence makes the
        // rings wobble; order keeps them round.
        const reach = Math.min(w, h) * 0.45;
        for (let i = 0; i < count; i += 1) {
          const s = strokes[i];
          if (s === undefined) continue;
          const ring = 0.08 + s.y * 0.92;
          const wobble =
            (p.noise(i * 0.1, time * 0.5) - 0.5) * (1 - v.flow) * 0.4;
          const radius = reach * ring * (1 + wobble * (0.3 + v.turbulence));
          const from = s.x * Math.PI * 2;
          s.x = (s.x + (step * 2) / ring + 1) % 1;
          const to = s.x * Math.PI * 2;
          rgb(hue + s.hue, v.saturation, 0.75, 0.7 * (1 - v.dim));
          p.line(
            lx + Math.cos(from) * radius,
            ly + Math.sin(from) * radius,
            lx + Math.cos(to) * radius,
            ly + Math.sin(to) * radius,
          );
        }
      } else if (setup.p5Scene === 'aurora') {
        // Curtains: soft bands whose tops sway with noise. Each curtain is one
        // filled shape; a horizontal gradient gives its folds (bright in some
        // places, faint in others). No lines, so no fine stripes.
        const curtains = 2 + Math.round(v.flow * 3);
        const length = h * (0.12 + v.trailLength * 0.25);
        const step = 24;
        const ctx = p.drawingContext as CanvasRenderingContext2D;
        ctx.save();
        for (let k = 0; k < curtains; k += 1) {
          const c = safeColor(hue + k * 25 - 20, v.saturation, 0.65);
          const folds = ctx.createLinearGradient(0, 0, w, 0);
          for (let i = 0; i <= 16; i += 1) {
            const fold = p.noise(i * 0.4, k * 7, time * 0.1);
            const alpha = 0.5 * fold * fold * (1 - v.dim);
            folds.addColorStop(i / 16, `rgba(${c.r},${c.g},${c.b},${alpha})`);
          }
          const tops: number[] = [];
          for (let x = 0; x <= w + step; x += step) {
            tops.push(
              h * (0.15 + k * 0.08) +
                p.noise(x * 0.002, k * 3, time * 0.15) * h * 0.35 +
                Math.sin(x * 0.004 + time * 0.3 * (k + 1)) *
                  h *
                  0.05 *
                  (0.3 + v.turbulence),
            );
          }
          // Two passes, full and half length, so the bottom edge fades out.
          for (const reach of [1, 0.5]) {
            ctx.beginPath();
            tops.forEach((top, i) => ctx.lineTo(i * step, top));
            for (let i = tops.length - 1; i >= 0; i -= 1) {
              ctx.lineTo(i * step, (tops[i] ?? 0) + length * reach);
            }
            ctx.closePath();
            ctx.fillStyle = folds;
            ctx.fill();
          }
        }
        ctx.restore();
      } else {
        // Strokes along the flow field. Order straightens them; turbulence bends them.
        drawStrokes(count, step);
      }
      // Layers from time on a page, shifted by scroll.
      p.noStroke();
      for (let i = 0; i < v.layerCount; i += 1) {
        rgb(hue + 30 * (i + 1), v.saturation * 0.6, 0.45, 0.015);
        p.rect(
          0,
          ((i + 1) / (v.layerCount + 1)) * h + v.layerOffset * (i + 1) - 20,
          w,
          40,
        );
      }

      // Ripples from clicks; they contract once on Back.
      p.noFill();
      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        const r = ripples[i];
        if (r === undefined) continue;
        r.age += dt;
        const k = Math.min(1, r.age / RIPPLE_MS);
        const size =
          10 + (still ? 0.5 : r.inverse ? 1 - k : k) * Math.min(w, h) * 0.3;
        const c = safeColor(hue + 170, v.saturation, 0.7);
        p.stroke(c.r, c.g, c.b, (1 - k) * 200);
        p.circle(r.x * w, r.y * h, size);
        if (k >= 1) ripples.splice(i, 1);
      }

      // A revisited page leaves a ghost; a time away leaves a dark mark.
      if (v.ghost > 0.01) {
        const c = safeColor(hue - 40, 0.3, 0.8);
        p.stroke(c.r, c.g, c.b, v.ghost * 60);
        for (const ring of [0.2, 0.3, 0.4])
          p.circle(w / 2, h / 2, Math.min(w, h) * ring * 2);
      }
      if (v.absenceMark > 0.01) {
        const c = safeColor(hue + 200, 0.4, 0.12);
        p.noStroke();
        p.fill(c.r, c.g, c.b, v.absenceMark * 120);
        p.circle(w * 0.78, h * 0.22, Math.min(w, h) * 0.5);
      }
      drawAtmosphere(v, hue);
    };
  }, host);

  return {
    apply(params, triggers, dtMs, isStill, particleShare) {
      target = params;
      dt = dtMs;
      still = isStill;
      share = particleShare;
      for (const trigger of triggers) {
        if (trigger.kind === 'ripple') {
          ripples.push({
            x: trigger.x,
            y: trigger.y,
            age: 0,
            inverse: trigger.inverse,
          });
        }
      }
      void instance.redraw();
    },
    dispose() {
      instance.remove();
      overlay.remove();
    },
  };
}
