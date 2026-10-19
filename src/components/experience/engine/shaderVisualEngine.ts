// The WebGL shader image for the Goodbye piece (ADR-0008 Amendments 2–5), behind
// the same VisualEngine interface, with no library. Two passes:
//   pass A draws the scene, the Hydra-style op chain, the light, and the marks,
//   then mixes in the previous frame (feedback) into ping-pong framebuffers;
//   pass B draws that frame to the screen with the atmosphere (haze, dust, grain,
//   vignette), the dim, and the red guard. The atmosphere stays out of the loop,
//   so it cannot build up frame after frame.
// The scene (the key picks one) is the colour field: waves, tunnel, cells, marble,
// or rings. The chain (the key picks 1–3 ops, named after Hydra's functions) moves
// the coordinates or adds a layer. The mood is the treatment: psychedelic folds
// the field into a kaleidoscope and echoes it with zoom and rotation; glitchy
// slides rows of blocks, splits the channels, and smears the feedback in steps.
// The ethereal mood uses p5, and this shader only as its fallback.
//
// The GLSL is built from the chain at the Goodbye click, from the fixed op
// vocabulary only. That is shader compilation, not JS eval, so the CSP allows it.
//
// Flash safety (WCAG 2.3.1): every scene and op moves with the image clock, which
// advances at most about 2.3 units a second, so no pixel's brightness cycles near
// 3 times a second. The feedback is a weighted mix with decay below 1, so the
// brightness cannot build up. No op inverts, differences, or keys the image, and
// no hue rotation adds up in the loop. On localhost, a probe counts flashes.

import {
  BRIGHTNESS_RAMP_MIN_MS,
  type HydraOp,
  type ShaderScene,
  type VisualParams,
  type VisualSetup,
} from '../../../lib/experience/params';
import type { VisualEngine } from './visualEngine';

const MAX_RIPPLES = 6;
const MODE = { psychedelic: 0, glitchy: 1, ethereal: 2 } as const;
const SCENE: Readonly<Record<ShaderScene, number>> = {
  waves: 0,
  tunnel: 1,
  cells: 2,
  marble: 3,
  rings: 4,
};
const RIPPLE_MS = 1400;
const SMOOTH_MS = 400;
/** The image clock wraps here, so mediump GPUs never lose its precision. */
const TIME_WRAP = 2000;

const PRECISION = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

const VERTEX = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const COMMON = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
vec3 hsl(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h / 60.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}
mat2 rot(float a) { float c = cos(a); float s = sin(a); return mat2(c, -s, s, c); }
// No saturated red (WCAG 2.3.1), by the same test as color.ts isSaturatedRed:
// red's share of the sum, in gamma and in linear light, stays below 0.8.
vec3 safeRed(vec3 color) {
  color = clamp(color, 0.0, 0.9);
  vec3 lin = pow(color, vec3(2.2));
  float redShare = max(color.r / max(color.r + color.g + color.b, 0.0001),
                       lin.r / max(lin.r + lin.g + lin.b, 0.0001));
  float grey = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(color, vec3(grey), smoothstep(0.6, 0.75, redShare) * 0.85);
}
`;

/** Hydra-style ops. Coordinate ops move uv before the field; layer ops change f. */
const COORD_OPS: Partial<Record<HydraOp, string>> = {
  rotate: `{ vec2 c = (uv - 0.5) * vec2(aspect, 1.0); uv = 0.5 + rot(t * 2.0 + 0.6) * c / vec2(aspect, 1.0); }`,
  scale: `uv = 0.5 + (uv - 0.5) * (1.6 + 0.5 * sin(t * 3.0));`,
  repeat: `uv = 1.0 - abs(1.0 - mod(uv * 2.0, 2.0));`,
  modulate: `uv += (vec2(noise(uv * 3.0 + t), noise(uv * 3.0 - t + 5.0)) - 0.5) * (0.08 + u_turb * 0.25);`,
  pixelate: `{ vec2 n = vec2(48.0 * aspect, 48.0); uv = (floor(uv * n) + 0.5) / n; }`,
};
const LAYER_OPS: Partial<Record<HydraOp, string>> = {
  osc: `f = mix(f, 0.5 + 0.5 * sin((uv.x * aspect + uv.y * 0.3) * 9.0 + t * 8.0), 0.35);`,
  shape: `{ vec2 c = (uv - 0.5) * vec2(aspect, 1.0); float a = atan(c.y, c.x) + t; float r = 6.2831 / 5.0;
    float d = cos(floor(0.5 + a / r) * r - a) * length(c);
    f = mix(f, f * 0.4 + 0.6 * smoothstep(0.32, 0.28, d), 0.5); }`,
};

function passA(chain: readonly HydraOp[]): string {
  const coords = chain.map((op) => COORD_OPS[op] ?? '').join('\n  ');
  const layers = chain.map((op) => LAYER_OPS[op] ?? '').join('\n  ');
  return `${PRECISION}
uniform vec2 u_res;
uniform float u_time, u_hue, u_sat, u_flow, u_turb, u_ghost, u_absence;
uniform float u_layers, u_offset, u_mode, u_scene, u_fb, u_decay, u_dts, u_tick;
uniform vec2 u_light;
uniform vec3 u_ripples[${MAX_RIPPLES}];
uniform sampler2D u_prev;
${COMMON}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}
float waves(vec2 p, float t) {
  // Domain warp: order keeps the field calm, turbulence folds it.
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + (4.0 * (0.4 + u_turb)) * q + vec2(1.7, 9.2) + t * 0.5),
                fbm(p + 4.0 * q + vec2(8.3, 2.8)));
  return mix(fbm(p + 4.0 * r), fbm(p + vec2(0.0, t * 2.0)), u_flow * 0.6);
}
float tunnel(vec2 p, float t) {
  // Fly forward through a noise tube. The centre fades out, so its fine detail
  // never shimmers.
  vec2 c = p - vec2(1.25 * u_res.x / u_res.y, 1.25);
  float r = length(c);
  float depth = 0.6 / (r + 0.25) + t * 2.0;
  vec2 dir = c / max(r, 0.001);
  float v = fbm(dir * (1.2 + u_turb) + vec2(depth, -depth * 0.5));
  return mix(0.5, v, smoothstep(0.05, 0.5, r));
}
float cells(vec2 p, float t) {
  // Slow stained glass: each cell is one flat colour with soft edges.
  vec2 g = p * (1.2 + u_turb * 0.8);
  vec2 i = floor(g);
  float best = 9.0; float id = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 h = vec2(hash(i + o), hash(i + o + 7.3));
      vec2 pt = o + 0.5 + 0.4 * sin(t * 3.0 + 6.2831 * h);
      float d = length(g - i - pt);
      if (d < best) { best = d; id = hash(i + o + 3.1); }
    }
  }
  return mix(id, fbm(p + t), 0.25 + u_flow * 0.3) - smoothstep(0.35, 0.0, best) * 0.08;
}
float marble(vec2 p, float t) {
  // Wide veins of colour, bent by noise.
  float n = fbm(p * 0.8 + vec2(t, -t * 0.7));
  return 0.5 + 0.5 * sin(p.x * (1.0 + u_flow) + p.y * 0.6 + n * (4.0 + u_turb * 6.0));
}
float rings(vec2 p, float t) {
  // Ripples from three drifting centres; where they meet, they interfere.
  float v = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec2 centre = vec2(1.2 + sin(t * (1.0 + fk) + fk * 2.1), 1.2 + cos(t * (1.3 + fk * 0.4) + fk));
    v += sin(length(p - centre) * (5.0 + u_turb * 4.0) - t * 20.0);
  }
  return 0.5 + v / 6.0 + (fbm(p + t) - 0.5) * 0.3;
}
float field(vec2 p, float t) {
  if (u_scene < 0.5) return waves(p, t);
  if (u_scene < 1.5) return tunnel(p, t);
  if (u_scene < 2.5) return cells(p, t);
  if (u_scene < 3.5) return marble(p, t);
  return rings(p, t);
}
void main() {
  vec2 screen = gl_FragCoord.xy / u_res;
  vec2 uv = screen;
  float aspect = u_res.x / u_res.y;
  float t = u_time * 0.05;
  // The chain: coordinate ops.
  ${coords}
  // u_mode 0: psychedelic, 1: glitchy, 2: ethereal (soft, slow).
  if (u_mode < 0.5) {
    // Kaleidoscope: fold the plane into six mirrored slices around the centre.
    vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
    float a = atan(c.y, c.x);
    float seg = 6.2831 / 6.0;
    a = abs(mod(a + u_time * 0.02, seg) - seg * 0.5);
    uv = 0.5 + vec2(cos(a), sin(a)) * length(c) / vec2(aspect, 1.0);
  } else if (u_mode < 1.5) {
    // Glitch: rows of blocks slide sideways. The pattern changes at most
    // 2.5 times a second, and moves position only, never brightness.
    float row = floor(uv.y * 24.0);
    float shift = (hash(vec2(row, u_tick)) - 0.5) * 0.25 * (0.3 + u_turb);
    if (hash(vec2(row * 1.7, u_tick + 3.0)) > 0.7) uv.x = fract(uv.x + shift);
  }
  vec2 p = uv * vec2(aspect, 1.0) * 2.5;
  float f = field(p, t * (u_mode > 1.5 ? 0.4 : 1.0));
  // The chain: layer ops.
  ${layers}
  float bands = sin((uv.y + u_offset * 0.002) * u_layers * 6.2831) * 0.04 * step(0.5, u_layers);
  float cycle = u_mode < 0.5 ? u_time * 6.0 : 0.0;
  float hue = mod(u_hue + f * (u_mode < 0.5 ? 260.0 : 140.0) + cycle, 360.0);
  float sat = clamp(0.35 + u_sat * 0.55, 0.0, 1.0);
  if (u_mode > 1.5) sat *= 0.55;
  if (hue < 15.0 || hue > 345.0) sat *= 0.6;
  float light = (u_mode > 1.5 ? 0.28 : 0.18) + f * 0.35 + bands;
  vec2 lp = screen - u_light;
  lp.x *= aspect;
  light += (u_mode > 1.5 ? 0.35 : 0.25) * exp(-dot(lp, lp) * (u_mode > 1.5 ? 3.0 : 6.0));
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec3 rp = u_ripples[i];
    if (rp.z <= 0.0) continue;
    vec2 d = screen - rp.xy; d.x *= aspect;
    float ring = abs(length(d) - (1.0 - rp.z) * 0.35);
    light += 0.12 * rp.z * smoothstep(0.02, 0.0, ring);
  }
  light += u_ghost * 0.08 * smoothstep(0.01, 0.0, abs(fract(length(screen - 0.5) * 6.0) - 0.5) - 0.48);
  vec2 ap = screen - vec2(0.78, 0.78); ap.x *= aspect;
  light -= u_absence * 0.2 * smoothstep(0.3, 0.0, length(ap));
  vec3 color = hsl(hue, sat, clamp(light, 0.0, 0.85));
  // Feedback: the previous frame, moved a little, decays under the new one.
  // Psychedelic echoes zoom in and turn; glitchy smears in stepped rows; scroll
  // shifts the echoes. Every move scales with the frame time.
  vec2 fb = screen;
  if (u_mode < 0.5) {
    vec2 c = (fb - 0.5) * vec2(aspect, 1.0);
    fb = 0.5 + rot(0.003 * u_dts) * c * (1.0 - 0.006 * u_dts) / vec2(aspect, 1.0);
  } else if (u_mode < 1.5) {
    float row = floor(fb.y * 24.0);
    fb.x += (hash(vec2(row, u_tick)) - 0.5) * 0.004 * u_dts * step(0.75, hash(vec2(row * 1.3, u_tick)));
    fb.y -= 0.0015 * u_dts;
  }
  fb.y += u_offset * 0.00004 * u_dts;
  // 8-bit textures: subtract one step, so dark echoes still fade to nothing.
  vec3 prev = max(texture2D(u_prev, fb).rgb * u_decay - 1.0 / 255.0, 0.0);
  gl_FragColor = vec4(safeRed(mix(color, prev, u_fb)), 1.0);
}
`;
}

const PASS_B = `${PRECISION}
uniform vec2 u_res;
uniform float u_time, u_seed, u_hue, u_dim, u_turb, u_grain, u_trail, u_offset, u_mode;
uniform sampler2D u_frame;
${COMMON}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec3 color = texture2D(u_frame, uv).rgb;
  if (u_mode > 0.5 && u_mode < 1.5) {
    // Glitchy: split the channels from the drawn frame, and add scan lines.
    float off = 0.004 + u_turb * 0.01;
    color.r = texture2D(u_frame, uv + vec2(off, 0.0)).r;
    color.b = texture2D(u_frame, uv - vec2(off, 0.0)).b;
    color *= 0.88 + 0.12 * sin(gl_FragCoord.y * 3.1416);
  }
  // Film grain: always a little, more with typing.
  float grain = 0.35 + u_grain + (u_mode > 0.5 && u_mode < 1.5 ? 0.5 : 0.0);
  color += (hash(uv * u_res + u_seed * 100.0) - 0.5) * 0.08 * grain;
  // Atmosphere (ADR-0008 Amendment 4). Haze: two slow fog layers at different
  // depths; stillness (trail) thickens it, and scroll shifts the near layer.
  vec2 hp = uv * vec2(aspect, 1.0);
  float fogFar = noise(hp * 1.5 + vec2(u_time * 0.02, 0.0));
  float fogNear = noise(hp * 3.0 - vec2(u_time * 0.035, u_offset * 0.004) + 4.0);
  float fog = smoothstep(0.3, 0.9, fogFar * 0.65 + fogNear * 0.35) * (0.12 + u_trail * 0.35);
  color = mix(color, hsl(u_hue + 30.0, 0.25, 0.55), fog);
  // Dust: at most one soft mote per cell, drifting up, fading in and out slowly.
  vec2 dg = hp * 18.0 + vec2(0.0, -u_time * 0.15);
  vec2 di = floor(dg);
  float dh = hash(di);
  vec2 dpos = 0.2 + 0.6 * vec2(hash(di + 1.7), hash(di + 4.1));
  float mote = smoothstep(0.08, 0.0, length(fract(dg) - dpos)) * step(0.6, dh);
  color += mote * (0.5 + 0.5 * sin(u_time * 0.4 + dh * 6.2831)) * 0.25 * (0.4 + u_trail);
  // Vignette: fixed, never pulsing.
  vec2 vc = uv - 0.5;
  color *= 1.0 - dot(vc, vc) * 0.9;
  color *= 1.0 - u_dim;
  gl_FragColor = vec4(safeRed(color), 1.0);
}
`;

interface Pass {
  program: WebGLProgram;
  u: (name: string) => WebGLUniformLocation | null;
}

interface Target {
  texture: WebGLTexture;
  buffer: WebGLFramebuffer;
}

export interface ShaderEngineDeps {
  canvas: HTMLCanvasElement;
  setup: VisualSetup;
  /** Called with the compile or link log when the shader cannot be built. */
  onError: (log: string) => void;
  /** On localhost only: called with the highest flash count in any 1 s window. */
  probe: ((flashes: number, mean: number) => void) | null;
}

export function createShaderVisualEngine(
  deps: ShaderEngineDeps,
): VisualEngine | null {
  const { canvas, setup, onError, probe } = deps;
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
  if (gl === null) return null;

  const compile = (type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (shader === null) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    onError(gl.getShaderInfoLog(shader) ?? 'compile failed');
    return null;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const link = (fragmentSource: string): Pass | null => {
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (vertex === null || fragment === null || program === null) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, 'a');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      onError(gl.getProgramInfoLog(program) ?? 'link failed');
      return null;
    }
    return { program, u: (name) => gl.getUniformLocation(program, name) };
  };
  const drawPass = link(passA(setup.chain));
  const screenPass = link(PASS_B);
  if (drawPass === null || screenPass === null) return null;

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // Two frames for the feedback. The canvas size is not a power of two, so
  // WebGL1 needs clamped edges, linear filtering, and no mipmaps.
  const makeTarget = (): Target | null => {
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (texture === null || framebuffer === null) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      canvas.width,
      canvas.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    for (const [name, value] of [
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
      [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
    ] as const) {
      gl.texParameteri(gl.TEXTURE_2D, name, value);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture, buffer: framebuffer };
  };
  const first = makeTarget();
  const second = makeTarget();
  if (first === null || second === null) {
    onError('framebuffer unavailable');
    return null;
  }
  let [read, write] = [first, second];

  let shown: VisualParams | null = null;
  let time = 0;
  let clock = 0;
  const ripples: { x: number; y: number; age: number }[] = [];
  const flashes = probe === null ? null : createFlashCounter();

  return {
    apply(target, triggers, dtMs, still) {
      const v: VisualParams = { ...target };
      if (shown !== null) {
        for (const key of Object.keys(target) as (keyof VisualParams)[]) {
          const tau = key === 'dim' ? BRIGHTNESS_RAMP_MIN_MS : SMOOTH_MS;
          v[key] =
            shown[key] + (target[key] - shown[key]) * Math.min(1, dtMs / tau);
        }
      }
      shown = v;
      for (const trigger of triggers) {
        if (trigger.kind === 'ripple')
          ripples.push({ x: trigger.x, y: 1 - trigger.y, age: 0 });
      }
      while (ripples.length > MAX_RIPPLES) ripples.shift();
      time =
        (time + (still ? 0 : (dtMs / 1000) * (0.3 + v.particleSpeed * 2))) %
        TIME_WRAP;
      clock += dtMs;
      const dts = Math.min(3, dtMs / 16.7);
      const tick = Math.floor(time * 2.5) % 1000;

      // Pass A: the scene, the chain, and the feedback, into the write frame.
      // No feedback while the image is still: each reduced-motion redraw would
      // otherwise zoom one more step.
      gl.useProgram(drawPass.program);
      gl.bindFramebuffer(gl.FRAMEBUFFER, write.buffer);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, read.texture);
      const a = drawPass.u;
      gl.uniform1i(a('u_prev'), 0);
      gl.uniform2f(a('u_res'), canvas.width, canvas.height);
      gl.uniform1f(a('u_time'), time);
      gl.uniform1f(a('u_hue'), setup.paletteHue + v.hueShift);
      gl.uniform1f(a('u_sat'), v.saturation);
      gl.uniform1f(a('u_flow'), v.flow);
      gl.uniform1f(a('u_turb'), v.turbulence);
      gl.uniform1f(a('u_ghost'), v.ghost);
      gl.uniform1f(a('u_absence'), v.absenceMark);
      gl.uniform1f(a('u_layers'), v.layerCount);
      gl.uniform1f(a('u_offset'), v.layerOffset);
      gl.uniform1f(a('u_mode'), MODE[setup.mood]);
      gl.uniform1f(a('u_scene'), SCENE[setup.shaderScene]);
      gl.uniform1f(a('u_tick'), tick);
      gl.uniform1f(a('u_dts'), dts);
      // Stillness (trail) holds more of the echo. The weight and the decay
      // scale with the frame time, so a slow phone gets the same trail.
      gl.uniform1f(a('u_fb'), still ? 0 : (0.35 + v.trailLength * 0.5) ** dts);
      gl.uniform1f(a('u_decay'), 0.97 ** dts);
      gl.uniform2f(a('u_light'), v.lightX, 1 - v.lightY);
      const packed = new Float32Array(MAX_RIPPLES * 3);
      ripples.forEach((r, i) => {
        r.age += dtMs;
        packed.set([r.x, r.y, Math.max(0, 1 - r.age / RIPPLE_MS)], i * 3);
      });
      gl.uniform3fv(a('u_ripples'), packed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Pass B: the write frame to the screen, with the atmosphere.
      gl.useProgram(screenPass.program);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, write.texture);
      const b = screenPass.u;
      gl.uniform1i(b('u_frame'), 0);
      gl.uniform2f(b('u_res'), canvas.width, canvas.height);
      gl.uniform1f(b('u_time'), time);
      gl.uniform1f(b('u_seed'), (time * 7.13) % 1);
      gl.uniform1f(b('u_hue'), setup.paletteHue + v.hueShift);
      gl.uniform1f(b('u_dim'), v.dim);
      gl.uniform1f(b('u_turb'), v.turbulence);
      gl.uniform1f(b('u_grain'), v.grain);
      gl.uniform1f(b('u_trail'), v.trailLength);
      gl.uniform1f(b('u_offset'), v.layerOffset);
      gl.uniform1f(b('u_mode'), MODE[setup.mood]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      [read, write] = [write, read];

      if (flashes !== null && probe !== null) {
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(
          0,
          0,
          canvas.width,
          canvas.height,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        const count = flashes.add(pixels, canvas.width, canvas.height, clock);
        probe(count, flashes.mean());
      }
    },
    dispose() {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

/**
 * Localhost test aid. Splits the frame into 4 × 3 regions and tracks each one's
 * mean relative luminance. A flash is a pair of opposing changes of at least 0.1
 * where the darker state is below 0.8 (WCAG 2.3.1). Returns the highest count in
 * any 1 s window so far.
 */
export function createFlashCounter(): {
  add: (
    pixels: Uint8Array,
    width: number,
    height: number,
    ms: number,
  ) => number;
  /** The mean relative luminance of the last frame, to show the read worked. */
  mean: () => number;
} {
  const COLS = 4;
  const ROWS = 3;
  const linear = (value: number): number => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const regions = Array.from({ length: COLS * ROWS }, () => ({
    extreme: -1,
    direction: 0,
    changes: [] as number[],
  }));
  let highest = 0;
  let lastMean = 0;
  return {
    mean: () => lastMean,
    add(pixels, width, height, ms) {
      const sums = new Float64Array(COLS * ROWS);
      const counts = new Float64Array(COLS * ROWS);
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const i = (y * width + x) * 4;
          const lum =
            0.2126 * linear(pixels[i] ?? 0) +
            0.7152 * linear(pixels[i + 1] ?? 0) +
            0.0722 * linear(pixels[i + 2] ?? 0);
          const region =
            Math.min(ROWS - 1, Math.floor((y / height) * ROWS)) * COLS +
            Math.min(COLS - 1, Math.floor((x / width) * COLS));
          sums[region] = (sums[region] ?? 0) + lum;
          counts[region] = (counts[region] ?? 0) + 1;
        }
      }
      let total = 0;
      for (const sum of sums) total += sum;
      let count = 0;
      for (const n of counts) count += n;
      lastMean = total / Math.max(1, count);
      regions.forEach((region, index) => {
        const lum = (sums[index] ?? 0) / Math.max(1, counts[index] ?? 0);
        if (region.extreme < 0) {
          region.extreme = lum;
          return;
        }
        const delta = lum - region.extreme;
        const direction = Math.sign(delta);
        if (
          Math.abs(delta) >= 0.1 &&
          Math.min(lum, region.extreme) < 0.8 &&
          direction !== region.direction
        ) {
          region.changes.push(ms);
          region.direction = direction;
          region.extreme = lum;
        } else if (direction === region.direction && direction !== 0) {
          region.extreme = lum;
        }
        region.changes = region.changes.filter((at) => ms - at < 1000);
        highest = Math.max(highest, Math.floor(region.changes.length / 2));
      });
      return highest;
    },
  };
}
