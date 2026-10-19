// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { VisitEvent } from '../../../lib/experience/events';
import { createRecorder, type Recorder, type RecorderView } from './recorder';

let now = 0;
let events: VisitEvent[] = [];
let recorder: Recorder;
let view: RecorderView & { scrollX: number; scrollY: number };

function pointer(
  type: string,
  x: number,
  y: number,
  target: EventTarget,
): void {
  const event = new MouseEvent(type, {
    clientX: x,
    clientY: y,
    bubbles: true,
    detail: 1,
  });
  target.dispatchEvent(event);
}

function element(tag: string, id: string, parent: Element): HTMLElement {
  const node = document.createElement(tag);
  node.id = id;
  parent.append(node);
  return node;
}

beforeEach(() => {
  document.body.replaceChildren();
  element('p', 'text', document.body);
  const form = element('form', 'form', document.body);
  element('input', 'field', form);
  element('textarea', 'area', form);
  element('button', 'mute', element('div', 'experience-layer', document.body));
  document.documentElement.dataset['theme'] = 'dark';
  now = 1000;
  events = [];
  view = {
    scrollX: 0,
    scrollY: 0,
    innerWidth: 640,
    innerHeight: 640,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
  };
  recorder = createRecorder({
    doc: document,
    view,
    visitNow: () => now,
    emit: (event) => events.push(event),
    createObserver: (callback) => new MutationObserver(callback),
  });
  recorder.start();
});

afterEach(() => recorder.stop());

const text = () => document.getElementById('text') as HTMLElement;

describe('recorder', () => {
  it('records pointer cells at most every 100 ms and only on a cell change', () => {
    pointer('pointermove', 100, 100, text());
    now += 50;
    pointer('pointermove', 300, 300, text());
    now += 100;
    pointer('pointermove', 300, 300, text());
    now += 100;
    pointer('pointermove', 301, 301, text());
    expect(events).toEqual([
      { kind: 'pointer', t: 1000, gx: 10, gy: 10 },
      { kind: 'pointer', t: 1150, gx: 30, gy: 30 },
    ]);
  });

  it('records clicks on the grid', () => {
    pointer('click', 320, 0, text());
    expect(events).toEqual([{ kind: 'click', t: 1000, gx: 32, gy: 0 }]);
  });

  it('records nothing inside form fields or the experience controls', () => {
    for (const id of ['field', 'area', 'mute']) {
      const target = document.getElementById(id) as HTMLElement;
      pointer('click', 10, 10, target);
      pointer('pointermove', 400, 400, target);
      target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    }
    expect(events).toEqual([]);
  });

  it('counts a key press without reading which key', () => {
    // Only reads while the recorder's listener runs count: jsdom itself reads
    // some of these after dispatch.
    const reads: string[] = [];
    let armed = false;
    const arm = () => {
      armed = true;
    };
    const disarm = () => {
      armed = false;
    };
    window.addEventListener('keydown', arm, { capture: true });
    document.addEventListener('keydown', disarm);
    const event = new KeyboardEvent('keydown', { bubbles: true });
    for (const name of [
      'key',
      'code',
      'keyCode',
      'which',
      'shiftKey',
      'altKey',
    ]) {
      Object.defineProperty(event, name, {
        get() {
          if (armed) reads.push(name);
          return '';
        },
      });
    }
    text().dispatchEvent(event);
    window.removeEventListener('keydown', arm, { capture: true });
    document.removeEventListener('keydown', disarm);
    expect(reads).toEqual([]);
    expect(events).toEqual([{ kind: 'keystroke', t: 1000 }]);
  });

  it('skips repeated and composing key presses', () => {
    text().dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, repeat: true }),
    );
    text().dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, isComposing: true }),
    );
    expect(events).toEqual([]);
  });

  it('records scroll as a share of the viewport, at most every 250 ms', () => {
    view.scrollY = 320;
    window.dispatchEvent(new Event('scroll'));
    now += 100;
    view.scrollY = 640;
    window.dispatchEvent(new Event('scroll'));
    now += 200;
    window.dispatchEvent(new Event('scroll'));
    expect(events).toEqual([
      { kind: 'scroll', t: 1000, dy: 50, dx: 0 },
      { kind: 'scroll', t: 1300, dy: 50, dx: 0 },
    ]);
  });

  it('ignores the scroll that a page change makes', () => {
    recorder.suspend(true);
    view.scrollY = 900;
    window.dispatchEvent(new Event('scroll'));
    recorder.suspend(false);
    expect(events).toEqual([]);
  });

  it('records tab hide and theme changes, but not a rewrite of the same theme', async () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    document.documentElement.dataset['theme'] = 'dark';
    await Promise.resolve();
    document.documentElement.dataset['theme'] = 'light';
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual([
      { kind: 'visibility', t: 1000, hidden: true },
      { kind: 'theme', t: 1000, light: true },
    ]);
  });

  it('stops listening when stopped', () => {
    recorder.stop();
    pointer('click', 10, 10, text());
    expect(events).toEqual([]);
    recorder.start();
  });
});
