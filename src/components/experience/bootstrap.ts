// The startup code on every page (ADR-0008 Amendment 1, ADR-0009 Amendment 1).
// It records the visit from arrival and waits for the Goodbye click. At that
// click it creates the AudioContext (browsers unlock audio only inside a click),
// stops the recording, and loads the engine that plays the piece.

import type { EngineModule } from './contract';
import type { Recording } from './record/recording';

export type LayerState = 'recording' | 'goodbye';

export interface BootstrapDeps {
  doc: Document;
  startRecording: () => Recording;
  /** Deletes the record after the piece has played. */
  clearRecord: () => void;
  createAudioContext: () => AudioContext | null;
  loadEngine: () => Promise<EngineModule>;
  warn: (code: 'engine-load-failed') => void;
}

export function wireBootstrap(deps: BootstrapDeps): void {
  const layer = (): HTMLElement | null =>
    deps.doc.getElementById('experience-layer');
  const setState = (state: LayerState): void => {
    const element = layer();
    if (element !== null) element.dataset['state'] = state;
  };

  let recording = deps.startRecording();
  setState('recording');
  let busy = false;

  async function goodbye(button: HTMLElement): Promise<void> {
    const unlockAudio = (): AudioContext | null => {
      try {
        const context = deps.createAudioContext();
        void context?.resume();
        return context;
      } catch {
        return null;
      }
    };
    const audio = unlockAudio();
    button.setAttribute('aria-disabled', 'true');
    setState('goodbye');
    const visit = await recording.stop();
    const element = layer();
    try {
      const engine = await deps.loadEngine();
      if (element === null) throw new Error('no layer');
      await engine.playGoodbye(visit, audio, element);
    } catch {
      void audio?.close().catch(() => undefined);
      deps.warn('engine-load-failed');
    }
    // After playback the record is gone, and a new visit starts.
    deps.clearRecord();
    recording = deps.startRecording();
    setState('recording');
    button.removeAttribute('aria-disabled');
    busy = false;
  }

  deps.doc.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || busy) return;
    const button = target.closest<HTMLElement>('[data-exp-goodbye]');
    if (button === null) return;
    busy = true;
    void goodbye(button);
  });
}
