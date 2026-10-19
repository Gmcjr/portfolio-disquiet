// Canvas 2D engine (ADR-0009 §3). It draws parameter frames and triggers in full
// colour on the Goodbye stage (ADR-0008 Amendment 1). Brightness moves slowly:
// large changes ramp over at least BRIGHTNESS_RAMP_MIN_MS (WCAG 2.3.1), and the
// caller passes only flash-limited triggers.

import {
  BRIGHTNESS_RAMP_MIN_MS,
  type Trigger,
  type VisualParams,
  type VisualSetup,
} from '../../../lib/experience/params';

export type Rgb = { r: number; g: number; b: number };

export interface VisualEngineDeps {
  ctx: Pick<
    CanvasRenderingContext2D,
    | 'fillStyle'
    | 'strokeStyle'
    | 'lineWidth'
    | 'globalAlpha'
    | 'fillRect'
    | 'beginPath'
    | 'arc'
    | 'fill'
    | 'stroke'
    | 'createRadialGradient'
  >;
  size: () => { width: number; height: number };
  setup: VisualSetup;
  rand: () => number;
  /** A colour that is never saturated red (passed in, so this engine imports only params). */
  safeColor: (h: number, s: number, l: number) => Rgb;
}

export interface VisualEngine {
  /** `still`: reduced or paused motion; the image changes but does not move. */
  apply(
    params: VisualParams,
    triggers: readonly Trigger[],
    dtMs: number,
    still: boolean,
    particleShare: number,
  ): void;
}

const MAX_PARTICLES = 140;
const RIPPLE_MS = 1000;
const SMOOTH_MS = 300;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
}

interface Ripple {
  x: number;
  y: number;
  age: number;
  inverse: boolean;
}

const css = ({ r, g, b }: Rgb, alpha: number): string =>
  `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;

export function createVisualEngine(deps: VisualEngineDeps): VisualEngine {
  const { ctx, rand, setup, safeColor } = deps;
  const particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    x: rand(),
    y: rand(),
    vx: 0,
    vy: 0,
    hue: (rand() - 0.5) * 80,
  }));
  const ripples: Ripple[] = [];
  let shown: VisualParams | null = null;
  let glow = 0;

  const ease = (
    from: number,
    to: number,
    dtMs: number,
    tauMs: number,
  ): number => from + (to - from) * Math.min(1, dtMs / tauMs);

  function smooth(target: VisualParams, dtMs: number): VisualParams {
    if (shown === null) return { ...target };
    const next = { ...target };
    for (const key of Object.keys(target) as (keyof VisualParams)[]) {
      const tau = key === 'dim' ? BRIGHTNESS_RAMP_MIN_MS : SMOOTH_MS;
      next[key] = ease(shown[key], target[key], dtMs, tau);
    }
    return next;
  }

  return {
    apply(target, triggers, dtMs, still, particleShare) {
      const p = smooth(target, dtMs);
      shown = p;
      const { width, height } = deps.size();
      const hue = setup.paletteHue + p.hueShift;
      for (const trigger of triggers) {
        if (trigger.kind === 'ripple') {
          ripples.push({
            x: trigger.x,
            y: trigger.y,
            age: 0,
            inverse: trigger.inverse,
          });
        } else if (trigger.kind === 'swell') {
          glow = Math.min(1, glow + 0.5);
        }
      }
      glow = ease(glow, 0, dtMs, BRIGHTNESS_RAMP_MIN_MS * 2);
      const light = 28 + glow * 8 - p.dim * 22;

      // Background; trails come from a partly transparent repaint.
      ctx.globalAlpha = still ? 1 : 1 - p.trailLength * 0.85;
      ctx.fillStyle = css(
        safeColor(hue, 0.25 + p.saturation * 0.45, light / 100),
        1,
      );
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;

      // Layers that build with time on a page, shifted by scroll.
      for (let i = 0; i < p.layerCount; i += 1) {
        const y =
          ((i + 1) / (p.layerCount + 1)) * height + p.layerOffset * (i + 1);
        ctx.fillStyle = css(
          safeColor(hue + 25 * (i + 1), p.saturation * 0.6, 0.4),
          0.12,
        );
        ctx.fillRect(0, y - height * 0.06, width, height * 0.12);
      }

      // The light that follows the pointer.
      const radius = Math.max(width, height) * 0.45;
      const gradient = ctx.createRadialGradient(
        p.lightX * width,
        p.lightY * height,
        0,
        p.lightX * width,
        p.lightY * height,
        radius,
      );
      gradient.addColorStop(
        0,
        css(safeColor(hue + 40, p.saturation, 0.62), 0.45),
      );
      gradient.addColorStop(1, css(safeColor(hue + 40, p.saturation, 0.62), 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Particles: aligned by order, scattered by turbulence.
      const count = Math.round(
        MAX_PARTICLES * Math.max(0.25, Math.min(1, particleShare)),
      );
      const speed = still ? 0 : (0.02 + p.particleSpeed * 0.25) * (dtMs / 1000);
      for (let i = 0; i < count; i += 1) {
        const particle = particles[i];
        if (particle === undefined) continue;
        const angle =
          (setup.texture === 'strata' ? 0 : particle.y * Math.PI * 2) * p.flow +
          (rand() - 0.5) * Math.PI * 2 * p.turbulence;
        particle.vx = ease(particle.vx, Math.cos(angle), dtMs, 400);
        particle.vy = ease(particle.vy, Math.sin(angle), dtMs, 400);
        particle.x = (particle.x + particle.vx * speed + 1) % 1;
        particle.y = (particle.y + particle.vy * speed + 1) % 1;
        ctx.fillStyle = css(
          safeColor(hue + particle.hue, p.saturation, 0.6),
          0.75,
        );
        ctx.beginPath();
        ctx.arc(
          particle.x * width,
          particle.y * height,
          2 + p.grain * 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      // Grain from typing.
      const grains = Math.round(p.grain * 160);
      for (let i = 0; i < grains; i += 1) {
        ctx.fillStyle = css(safeColor(hue + 180, 0.2, rand() * 0.8), 0.25);
        ctx.fillRect(rand() * width, rand() * height, 1.5, 1.5);
      }

      // Ripples from clicks; they contract once on Back.
      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        const ripple = ripples[i];
        if (ripple === undefined) continue;
        ripple.age += dtMs;
        const share = Math.min(1, ripple.age / RIPPLE_MS);
        const grow = still ? 0.5 : ripple.inverse ? 1 - share : share;
        ctx.strokeStyle = css(
          safeColor(hue + 160, p.saturation, 0.7),
          1 - share,
        );
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          ripple.x * width,
          ripple.y * height,
          8 + grow * 90,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        if (share >= 1) ripples.splice(i, 1);
      }

      // A revisited page: a faint ghost of rings.
      if (p.ghost > 0.01) {
        ctx.strokeStyle = css(safeColor(hue - 30, 0.3, 0.8), p.ghost * 0.3);
        for (const ring of [0.15, 0.25, 0.35]) {
          ctx.beginPath();
          ctx.arc(
            width / 2,
            height / 2,
            Math.min(width, height) * ring,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
      }

      // The mark of a time away: a darker diagonal band.
      if (p.absenceMark > 0.01) {
        ctx.fillStyle = css(
          safeColor(hue + 200, 0.4, 0.15),
          p.absenceMark * 0.5,
        );
        ctx.beginPath();
        ctx.arc(
          width * 0.8,
          height * 0.2,
          Math.min(width, height) * 0.3,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    },
  };
}
