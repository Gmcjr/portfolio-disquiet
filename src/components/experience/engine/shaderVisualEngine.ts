// The WebGL shader image for the Goodbye piece (ADR-0008 Amendments 2 and 3),
// behind the same VisualEngine interface, with no library. One full-screen
// fragment shader. The scene (the key picks one) is the colour field: waves (a
// warped flow), tunnel, cells, marble, or rings. Light, grain, ripples, a ghost,
// and the mark of a time away go on top. The mood is the treatment: it folds the
// field into a kaleidoscope (psychedelic) or breaks it into sliding blocks and
// split channels (glitchy). The ethereal mood uses p5, and this shader only as
// its fallback.
//
// Flash safety (WCAG 2.3.1): every scene moves with u_time, which advances at most
// about 2.3 units a second, so no pixel's brightness cycles near 3 times a second.
// The fields keep low spatial frequencies and a light range of 0.18–0.85. The
// atmosphere (haze, dust, grain) runs on the same clock; the dust fades over
// seconds, and the vignette never moves.

import {
  BRIGHTNESS_RAMP_MIN_MS,
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

const VERTEX = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time, u_hue, u_sat, u_dim, u_flow, u_turb, u_grain, u_ghost, u_absence;
uniform float u_layers, u_offset, u_mode, u_scene, u_trail;
uniform vec2 u_light;
uniform vec3 u_ripples[${MAX_RIPPLES}];

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}
vec3 hsl(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h / 60.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
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
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  float t = u_time * 0.05;
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
    float tick = floor(u_time * 2.5);
    float row = floor(uv.y * 24.0);
    float shift = (hash(vec2(row, tick)) - 0.5) * 0.25 * (0.3 + u_turb);
    if (hash(vec2(row * 1.7, tick + 3.0)) > 0.7) uv.x = fract(uv.x + shift);
  }
  vec2 p = uv * vec2(aspect, 1.0) * 2.5;
  float speed = u_mode > 1.5 ? 0.4 : 1.0;
  float f = field(p, t * speed);
  float bands = sin((uv.y + u_offset * 0.002) * u_layers * 6.2831) * 0.04 * step(0.5, u_layers);
  float cycle = u_mode < 0.5 ? u_time * 6.0 : 0.0;
  float hue = mod(u_hue + f * (u_mode < 0.5 ? 260.0 : 140.0) + cycle, 360.0);
  float sat = clamp(0.35 + u_sat * 0.55, 0.0, 1.0);
  if (u_mode > 1.5) sat *= 0.55;
  // Saturated red is avoided: hues near 0/360 lose saturation.
  if (hue < 15.0 || hue > 345.0) sat *= 0.6;
  float light = (u_mode > 1.5 ? 0.28 : 0.18) + f * 0.35 + bands;
  vec2 lp = uv - u_light;
  lp.x *= aspect;
  light += (u_mode > 1.5 ? 0.35 : 0.25) * exp(-dot(lp, lp) * (u_mode > 1.5 ? 3.0 : 6.0));
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec3 rp = u_ripples[i];
    if (rp.z <= 0.0) continue;
    vec2 d = uv - rp.xy; d.x *= aspect;
    float ring = abs(length(d) - (1.0 - rp.z) * 0.35);
    light += 0.12 * rp.z * smoothstep(0.02, 0.0, ring);
  }
  light += u_ghost * 0.08 * smoothstep(0.01, 0.0, abs(fract(length(uv - 0.5) * 6.0) - 0.5) - 0.48);
  vec2 ap = uv - vec2(0.78, 0.78); ap.x *= aspect;
  light -= u_absence * 0.2 * smoothstep(0.3, 0.0, length(ap));
  // Film grain: always a little, more with typing.
  light += (hash(uv * u_res + u_time) - 0.5) * 0.08 * (0.35 + u_grain + (u_mode > 0.5 && u_mode < 1.5 ? 0.5 : 0.0));
  light *= (1.0 - u_dim);
  vec3 color = hsl(hue, sat, clamp(light, 0.0, 0.85));
  if (u_mode > 0.5 && u_mode < 1.5) {
    // RGB split and scan lines.
    float off = 0.004 + u_turb * 0.01;
    float fr = field(p + vec2(off * 10.0, 0.0), t);
    float fb = field(p - vec2(off * 10.0, 0.0), t);
    color.r = hsl(hue, sat, clamp(light + (fr - f) * 0.3, 0.0, 0.85)).r;
    color.b = hsl(hue, sat, clamp(light + (fb - f) * 0.3, 0.0, 0.85)).b;
    color *= 0.88 + 0.12 * sin(gl_FragCoord.y * 3.1416);
  }
  // Atmosphere (ADR-0008 Amendment 4). Haze: two slow fog layers at different
  // depths; stillness (trail) thickens it, and scroll shifts the near layer.
  vec2 hp = uv * vec2(aspect, 1.0);
  float fogFar = noise(hp * 1.5 + vec2(u_time * 0.02, 0.0));
  float fogNear = noise(hp * 3.0 - vec2(u_time * 0.035, u_offset * 0.004) + 4.0);
  float fog = smoothstep(0.3, 0.9, fogFar * 0.65 + fogNear * 0.35) * (0.12 + u_trail * 0.35);
  color = mix(color, hsl(u_hue + 30.0, 0.25, 0.55), fog * (1.0 - u_dim));
  // Dust: at most one soft mote per cell, drifting up, fading in and out slowly.
  vec2 dg = hp * 18.0 + vec2(0.0, -u_time * 0.15);
  vec2 di = floor(dg);
  float dh = hash(di);
  vec2 dpos = 0.2 + 0.6 * vec2(hash(di + 1.7), hash(di + 4.1));
  float mote = smoothstep(0.08, 0.0, length(fract(dg) - dpos)) * step(0.6, dh);
  float twinkle = 0.5 + 0.5 * sin(u_time * 0.4 + dh * 6.2831);
  color += mote * twinkle * 0.25 * (0.4 + u_trail) * (1.0 - u_dim);
  // Vignette: fixed, never pulsing.
  vec2 vc = uv - 0.5;
  color *= 1.0 - dot(vc, vc) * 0.9;
  // No saturated red (WCAG 2.3.1), by the same test as color.ts isSaturatedRed:
  // red's share of the sum, in gamma and in linear light, stays below 0.8.
  color = min(color, vec3(0.9));
  vec3 lin = pow(color, vec3(2.2));
  float redShare = max(color.r / max(color.r + color.g + color.b, 0.0001),
                       lin.r / max(lin.r + lin.g + lin.b, 0.0001));
  float grey = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(color, vec3(grey), smoothstep(0.6, 0.75, redShare) * 0.85);
  gl_FragColor = vec4(color, 1.0);
}
`;

export function createShaderVisualEngine(
  canvas: HTMLCanvasElement,
  setup: VisualSetup,
): VisualEngine | null {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
  if (gl === null) return null;
  const compile = (type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (shader === null) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (vs === null || fs === null || program === null) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const u = (name: string) => gl.getUniformLocation(program, name);

  let shown: VisualParams | null = null;
  let time = 0;
  const ripples: { x: number; y: number; age: number }[] = [];

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
      time += still ? 0 : (dtMs / 1000) * (0.3 + v.particleSpeed * 2);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u('u_res'), canvas.width, canvas.height);
      gl.uniform1f(u('u_time'), time);
      gl.uniform1f(u('u_hue'), setup.paletteHue + v.hueShift);
      gl.uniform1f(u('u_sat'), v.saturation);
      gl.uniform1f(u('u_dim'), v.dim);
      gl.uniform1f(u('u_flow'), v.flow);
      gl.uniform1f(u('u_turb'), v.turbulence);
      gl.uniform1f(u('u_grain'), v.grain);
      gl.uniform1f(u('u_trail'), v.trailLength);
      gl.uniform1f(u('u_ghost'), v.ghost);
      gl.uniform1f(u('u_absence'), v.absenceMark);
      gl.uniform1f(u('u_layers'), v.layerCount);
      gl.uniform1f(u('u_offset'), v.layerOffset);
      gl.uniform1f(u('u_mode'), MODE[setup.mood]);
      gl.uniform1f(u('u_scene'), SCENE[setup.shaderScene]);
      gl.uniform2f(u('u_light'), v.lightX, 1 - v.lightY);
      const packed = new Float32Array(MAX_RIPPLES * 3);
      ripples.forEach((r, i) => {
        r.age += dtMs;
        packed.set([r.x, r.y, Math.max(0, 1 - r.age / RIPPLE_MS)], i * 3);
      });
      gl.uniform3fv(u('u_ripples'), packed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
