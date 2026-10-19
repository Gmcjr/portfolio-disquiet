// The Goodbye sequence (ADR-0008 §5, Amendment 1): the whole visit plays once as
// sound and image, with the user's messages. Then the record is deleted and the
// visitor returns to the home page. Only this module may import navigate.

import { navigate } from 'astro:transitions/client';
import { deriveBackdrop, SCALES } from '../../../lib/experience/backdrop';
import { safeColor } from '../../../lib/experience/color';
import { createPRNG } from '../../../lib/experience/key';
import { limitBright, neutralFrame } from '../../../lib/experience/params';
import { computeSeal, displaySeal } from '../../../lib/experience/provenance';
import {
  allText,
  buildCues,
  pickVariant,
  type Cue,
} from '../../../lib/experience/script';
import {
  replayStep,
  showcaseDurationMs,
  startCursor,
  visitTimeAt,
} from '../../../lib/experience/showcase';
import { summarize } from '../../../lib/experience/summary';
import type { VisitRecord } from '../record/recording';
import { createAudioEngine, type AudioEngine } from './audioEngine';
import { createVisualEngine, type VisualEngine } from './visualEngine';

const MAX_PIXELS = 2_000_000;
const MAX_DPR = 1.5;
const REMEMBER_DIM = 0.85;
const warn = (code: string): void => console.warn('[experience]', code);

function mountCanvas(host: HTMLElement | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  host?.replaceChildren(canvas);
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  let width = Math.round(window.innerWidth * ratio);
  let height = Math.round(window.innerHeight * ratio);
  const over = Math.sqrt((width * height) / MAX_PIXELS);
  if (over > 1) {
    width = Math.round(width / over);
    height = Math.round(height / over);
  }
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** An on-device voice only: a remote voice would send the text to a vendor. */
function localVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  return (
    speechSynthesis.getVoices().find((voice) => voice.localService) ?? null
  );
}

function summaryLines(visit: VisitRecord, seal: string): string[] {
  const s = summarize(visit.events);
  const seconds = Math.round(s.longestStillnessMs / 1000);
  return [
    `Your visit: ${s.minutes} minutes, ${s.pages} pages, ${s.clicks} clicks, ${s.keystrokes} key presses.`,
    `Your longest stillness: ${seconds} seconds.`,
    `Visit seal: ${displaySeal(seal)}. It comes from random numbers. It cannot identify you or your device.`,
  ];
}

export async function playGoodbye(
  visit: VisitRecord,
  audioContext: AudioContext | null,
  layer: HTMLElement,
): Promise<void> {
  const dialog = layer.querySelector<HTMLDialogElement>('dialog.exp-stage');
  const log = layer.querySelector<HTMLElement>('[data-exp-log]');
  const allTextBox = layer.querySelector<HTMLElement>('[data-exp-all-text]');
  const cover = layer.querySelector<HTMLElement>('[data-exp-cover]');
  const status = layer.querySelector<HTMLElement>('[data-exp-status]');
  if (
    dialog === null ||
    log === null ||
    allTextBox === null ||
    cover === null
  ) {
    throw new Error('missing stage');
  }
  const button = (action: string) =>
    layer.querySelector<HTMLElement>(
      `.exp-stage [data-exp-action="${action}"]`,
    );

  const backdrop = deriveBackdrop(visit.key);
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const visitMs = visit.events[visit.events.length - 1]?.t ?? 0;
  const showcaseMs = showcaseDurationMs(visitMs);
  const variant = pickVariant(visit.key);
  const cues = buildCues(backdrop, calm, showcaseMs, variant);
  const seal = await computeSeal(visit.key, visit.events);

  // Engines.
  const canvas = mountCanvas(
    layer.querySelector<HTMLElement>('[data-exp-canvas-host]'),
  );
  const ctx2d = canvas.getContext('2d', { alpha: false });
  if (ctx2d === null) warn('canvas-unavailable');
  const visual: VisualEngine | null =
    ctx2d === null
      ? null
      : createVisualEngine({
          ctx: ctx2d,
          size: () => ({ width: canvas.width, height: canvas.height }),
          setup: { paletteHue: backdrop.paletteHue, texture: backdrop.texture },
          rand: createPRNG(visit.key.slice(16)),
          safeColor,
        });
  let audio: AudioEngine | null = null;
  if (audioContext !== null) {
    audio = createAudioEngine(
      audioContext,
      {
        rootMidi: backdrop.rootMidi,
        scale: SCALES[backdrop.scale],
        waveform: backdrop.waveform,
        reverbSeconds: backdrop.reverbSeconds,
      },
      createPRNG(visit.key.slice(48)),
    );
  } else {
    warn('audio-unavailable');
  }
  const voice = localVoice();
  if (voice === null) warn('speech-unavailable');

  // State of the sequence clock.
  let elapsed = 0;
  let last = performance.now();
  let paused = false;
  let muted = false;
  let finished = false;
  let cueIndex = 0;
  let cursor = startCursor();
  let current: HTMLParagraphElement | null = null;
  let lastStill = -Infinity;
  const bright: number[] = [];
  const endingCue = cues.find((cue) => cue.kind === 'ending');
  const showcase = cues.find((cue) => cue.kind === 'showcase');
  const stage: { cover: HTMLDivElement | null } = { cover: null };

  const say = (text: string): void => {
    if (status !== null) status.textContent = text;
  };

  function showMessage(text: string): void {
    if (current !== null) current.dataset['current'] = 'false';
    const line = document.createElement('p');
    line.textContent = text;
    log?.append(line);
    current = line;
    requestAnimationFrame(() => {
      line.dataset['current'] = 'true';
    });
    if (voice !== null && !muted) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }

  function hideMessage(): void {
    if (current !== null) current.dataset['current'] = 'false';
  }

  function startEnding(cue: Extract<Cue, { kind: 'ending' }>): void {
    hideMessage();
    const stageCover = document.createElement('div');
    stage.cover = stageCover;
    stageCover.style.cssText =
      'position:absolute;inset:0;opacity:0;pointer-events:none;' +
      `background:${cue.ending === 'whiteout' ? '#faf9f6' : '#000'};`;
    dialog?.append(stageCover);
    const fadeIn = cue.ending === 'whiteout' ? 3000 : cue.durationMs;
    stageCover.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: fadeIn,
      easing: 'cubic-bezier(0.37, 0, 0.63, 1)',
      fill: 'forwards',
    });
    if (cue.ending === 'whiteout') {
      // Swell to white, hold, then to black: one slow pair, never a flash.
      stageCover.animate(
        [{ backgroundColor: '#faf9f6' }, { backgroundColor: '#000000' }],
        {
          delay: 3800,
          duration: 2000,
          easing: 'ease-in-out',
          fill: 'forwards',
        },
      );
    }
  }

  function applyShowcase(dt: number): void {
    if (showcase === undefined || showcase.kind !== 'showcase') return;
    const into = elapsed - showcase.atMs;
    if (into < 0) return;
    const visitT = visitTimeAt(into, visitMs, showcase.durationMs);
    const step = replayStep(cursor, visit.events, backdrop, visitT);
    cursor = step.cursor;
    const triggers = limitBright(step.triggers, bright, elapsed);
    audio?.apply(step.frame.audio, triggers, dt);
    const ramp = Math.min(1, into / showcase.rampMs);
    const rememberAt =
      cues.find((cue) => cue.kind === 'remember')?.atMs ?? Infinity;
    const dim = Math.max(
      step.frame.visual.dim,
      1 - ramp,
      elapsed >= rememberAt ? REMEMBER_DIM : 0,
    );
    const redraw = !calm || elapsed - lastStill >= 4000;
    if (visual !== null && redraw) {
      visual.apply({ ...step.frame.visual, dim }, triggers, dt, calm, 1);
      if (calm) lastStill = elapsed;
    }
  }

  // Controls.
  const onControl = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action =
      target.closest<HTMLElement>('[data-exp-action]')?.dataset['expAction'];
    if (action === 'pause') {
      paused = !paused;
      button('pause')?.setAttribute('aria-pressed', String(paused));
      if (paused) {
        void audioContext?.suspend();
        if (voice !== null) speechSynthesis.pause();
      } else {
        void audioContext?.resume();
        if (voice !== null) speechSynthesis.resume();
        last = performance.now();
      }
      say(paused ? 'Paused.' : 'Playing.');
    } else if (action === 'mute') {
      muted = !muted;
      button('mute')?.setAttribute('aria-pressed', String(muted));
      audio?.setMuted(muted);
      if (muted && voice !== null) speechSynthesis.cancel();
      say(muted ? 'Sound muted.' : 'Sound on.');
    } else if (action === 'text') {
      const open = allTextBox.hidden;
      allTextBox.hidden = !open;
      button('text')?.setAttribute('aria-pressed', String(open));
      if (open) {
        const lines = [...allText(variant), '', ...summaryLines(visit, seal)];
        allTextBox.replaceChildren(
          ...lines.map((text) => {
            const p = document.createElement('p');
            p.textContent = text;
            return p;
          }),
        );
      }
    } else if (action === 'skip') {
      skip();
    }
  };

  function skip(): void {
    if (endingCue === undefined || elapsed >= endingCue.atMs) return;
    elapsed = endingCue.atMs;
    cueIndex = cues.indexOf(endingCue);
    if (voice !== null) speechSynthesis.cancel();
  }

  const onCancel = (event: Event): void => {
    event.preventDefault();
    skip();
  };
  // A page change during Goodbye (the Back button): end at once, before the swap.
  let ownNavigation = false;
  const onBeforePreparation = (): void => {
    if (!ownNavigation) finish();
  };

  dialog.addEventListener('click', onControl);
  dialog.addEventListener('cancel', onCancel);
  document.addEventListener('astro:before-preparation', onBeforePreparation);
  log.replaceChildren();
  allTextBox.hidden = true;
  for (const action of ['pause', 'mute', 'text'])
    button(action)?.setAttribute('aria-pressed', 'false');
  dialog.showModal();
  layer.querySelector<HTMLElement>('#exp-stage-title')?.focus();
  requestAnimationFrame(() => {
    dialog.dataset['visible'] = 'true';
  });
  visual?.apply({ ...neutralFrame().visual, dim: 1 }, [], 16, true, 1);

  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  function finish(): void {
    if (finished) return;
    finished = true;
    if (voice !== null) speechSynthesis.cancel();
    audio?.close();
    dialog?.removeEventListener('click', onControl);
    dialog?.removeEventListener('cancel', onCancel);
    document.removeEventListener(
      'astro:before-preparation',
      onBeforePreparation,
    );
    resolveDone();
  }

  function tick(): void {
    if (finished) return;
    const now = performance.now();
    const dt = Math.min(250, now - last);
    last = now;
    if (!paused) {
      elapsed += dt;
      while (
        cueIndex < cues.length &&
        (cues[cueIndex]?.atMs ?? Infinity) <= elapsed
      ) {
        const cue = cues[cueIndex];
        cueIndex += 1;
        if (cue === undefined) continue;
        if (cue.kind === 'message') {
          showMessage(cue.text);
          const hideAt = cue.atMs + 1200 + cue.holdMs;
          window.setTimeout(() => {
            if (current?.textContent === cue.text && elapsed >= hideAt - 50)
              hideMessage();
          }, cue.holdMs + 1200);
        } else if (cue.kind === 'remember') {
          showMessage(cue.text);
        } else if (cue.kind === 'ending') {
          startEnding(cue);
        } else if (cue.kind === 'fade-in') {
          void end();
          return;
        }
      }
      applyShowcase(dt);
    }
    if (calm) window.setTimeout(tick, 100);
    else requestAnimationFrame(tick);
  }

  async function end(): Promise<void> {
    // Under full black: a separate cover, close the dialog, go home, fade in.
    cover?.removeAttribute('hidden');
    cover?.removeAttribute('data-fading');
    if (current !== null) current.dataset['current'] = 'false';
    dialog?.close();
    if (dialog !== null) dialog.dataset['visible'] = 'false';
    stage.cover?.remove();
    ownNavigation = true;
    finish();
    try {
      await navigate('/');
    } catch {
      window.location.assign('/');
    }
    requestAnimationFrame(() => {
      cover?.setAttribute('data-fading', 'true');
    });
    window.setTimeout(() => {
      cover?.setAttribute('hidden', '');
      cover?.removeAttribute('data-fading');
      const heading = document.querySelector<HTMLElement>('main h1');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus();
      say('The piece has ended. The record of your visit is deleted.');
    }, 2100);
  }

  tick();
  await done;
  if (dialog.open) {
    // Ended by a page change: no fade, just close.
    dialog.close();
    dialog.dataset['visible'] = 'false';
    stage.cover?.remove();
  }
}
