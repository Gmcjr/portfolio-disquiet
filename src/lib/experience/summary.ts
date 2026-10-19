// The visit record shown at Goodbye: the text equivalent of the showcase
// (ADR-0008 §5). Counts only; it never shows paths or times of single events.

import type { VisitEvent } from './events.js';
import { createFeatureState, fold, stillnessMs } from './features.js';

export interface VisitSummary {
  clicks: number;
  pages: number;
  keystrokes: number;
  minutes: number;
  longestStillnessMs: number;
}

export function summarize(events: readonly VisitEvent[]): VisitSummary {
  let state = createFeatureState();
  let clicks = 0;
  let keystrokes = 0;
  let longest = 0;
  const pages = new Set<string>();
  for (const event of events) {
    longest = Math.max(longest, stillnessMs(state, event.t));
    state = fold(state, event);
    if (event.kind === 'click') clicks += 1;
    if (event.kind === 'keystroke') keystrokes += 1;
    if (event.kind === 'page') pages.add(event.path);
  }
  const end = events[events.length - 1]?.t ?? 0;
  return {
    clicks,
    pages: pages.size,
    keystrokes,
    minutes: Math.round(end / 6000) / 10,
    longestStillnessMs: longest,
  };
}
