// Types shared by the startup code and the Goodbye engine. Types only, so the
// startup code can import it without pulling in engine code.

import type { VisitRecord } from './record/recording';

export interface EngineModule {
  /** Plays the visit once. Resolves when the sequence has ended or was skipped. */
  playGoodbye(
    visit: VisitRecord,
    audio: AudioContext | null,
    layer: HTMLElement,
  ): Promise<void>;
}
