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
        (still ? 1 : 0.08 + (1 - v.trailLength) * 0.25) * 255,
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
      glow.fillStyle = gradient;
      glow.fillRect(0, 0, w, h);

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
        // Curtains: thin vertical lines of low alpha whose tops sway with noise.
        const curtains = 2 + Math.round(v.flow * 3);
        const gap = Math.max(3, Math.round(8 - share * 4));
        for (let k = 0; k < curtains; k += 1) {
          for (let x = 0; x < w; x += gap) {
            const top =
              h * (0.15 + k * 0.08) +
              p.noise(x * 0.002, k * 3, time * 0.15) * h * 0.35 +
              Math.sin(x * 0.004 + time * 0.3 * (k + 1)) *
                h *
                0.05 *
                (0.3 + v.turbulence);
            // Folds: the curtain is bright in some places and faint in others.
            const fold = p.noise(x * 0.003, k * 7, time * 0.1);
            rgb(
              hue + k * 25 - 20,
              v.saturation,
              0.65,
              0.45 * fold * fold * (1 - v.dim),
            );
            p.line(x, top, x, top + h * (0.12 + v.trailLength * 0.25));
          }
        }
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
    },
  };
}
