---
status: accepted
date: 2026-10-18
---

# ADR-0009: Experience runtime structure

**Status:** Accepted — 2026-10-18, from the Step 6 planning run. It amends ADR-0003 (a
fourth layer). PR-A builds the core and the checks; PR-B builds the shell.
**Reversibility:** Cheap until Phase A ships. After that, two parts are expensive to change:
the event-to-parameter seam (§3) and the stored record format (§5).

## Amendment 1 (2026-10-18) — accepted, follows ADR-0008 Amendment 1

ADR-0008 Amendment 1 removes the live layer and records every visit from arrival. The user
approved these runtime changes on 2026-10-18:

- **Startup code records.** The recorder, the storage adapter, and the parts of the core they
  need (`events`, `envelope`, `timeline`, `key`) load on every page and start at once. No
  sound, no canvas, no animation frame at startup. The startup script grows past 2 KB; it must
  stay ≤5 KB, and every page stays ≤12 KB at startup.
- **The piece loads at Goodbye.** The audio and visual engines, the mapping, the showcase, and
  the Goodbye sequence load by one dynamic import at the Goodbye click (≤40 KB). The click
  also creates the AudioContext.
- **No live tick.** While the visitor browses, the session only drains events into the
  timeline and flushes them. The fold, sample, and map run only in the showcase replay.
- **States:** `recording → goodbye → ended → recording` (a new visit), plus `failed`. The
  `resumable` and `live` states go away. A reload continues the recording at once.
- **The bar** holds Time to Say Goodbye (and an optional "What is this?" link). Mute and Pause
  live in the Goodbye dialog.
- **The dependency rules** change to match: the startup entry may import `recorder.ts` and
  `storage.ts` and their core modules; the engines and the mapping stay lazy.

## Amendment 2 (2026-10-19) — follows ADR-0008 Amendment 2

- The Goodbye engine picks the audio and visual engines by mood. Tone.js is imported module by
  module, never from `tone` (its main entry starts a `blob:` worker at import time).
- The p5 engine loads by a second dynamic import from `engine/goodbye.ts`, only for the ethereal
  image. `check:size` allows this one nested download with its own budget (≤512 KB); the base
  Goodbye download stays ≤100 KB. A dependency rule keeps p5 out of the base download.
- On localhost only, `?mood=psychedelic|glitchy|ethereal` overrides the key, for testing.

## Context

ADR-0008 sets what the experience does. This ADR sets how the code is built. The forces:

- Every page pays for the startup script, and nothing may run before Enter.
- The user must be able to change the mapping table without changes to the engines.
- The Goodbye showcase must replay the visit through the same mapping as the live layer.
- The layer must survive `ClientRouter` page changes. Logic in `.astro` `<script>` blocks is
  invisible to dependency-cruiser.

## Decision

### 1. Layers

- **Experience core** (`src/lib/experience/`), a fourth layer. Pure TypeScript. No DOM, no
  storage, no audio, no timers, no `Date`, no `Math.random`, no network. `crypto.subtle` and
  `crypto.getRandomValues` are allowed. The caller passes in the clock, randomness, and
  storage. Core imports nothing outside core.
  - Modules: `events`, `envelope`, `timeline`, `key`, `params` (also all safety limits as named
    constants), `features` (also stillness), `mapping`, `backdrop`, `showcase`, `script`
    (Goodbye texts from the note), `provenance`, `summary`, `color`, and the quality-ladder
    function.
- **Shell** (`src/components/experience/`):
  - `ExperienceLayer.astro`: one element in `BaseLayout.astro`. Its `<script>` holds one import
    of `bootstrap.ts`.
  - `bootstrap.ts`: the only experience code at startup. Target ≤2 KB gzip, ceiling 5 KB.
  - `engine/`: loaded by one dynamic import after Enter or Continue. Modules: `index`,
    `session`, `recorder`, `audioEngine`, `visualEngine`, `goodbye`, `controls`, `storage`,
    `ports` (types only).
  - `detour/`: reserved for Phase B. Only `engine/session.ts` may load it, and only by dynamic
    import.
- **Allowed imports:**
  - `bootstrap.ts` → core `events` and `envelope` only.
  - `engine/recorder.ts` → core `events` only.
  - `engine/audioEngine.ts` and `engine/visualEngine.ts` → core `params` only.
  - `engine/goodbye.ts` → core `showcase`, `script`, `params`, and `navigate` from
    `astro:transitions/client`. No other file imports `navigate`.
  - `timeline.ts` → `events` and `envelope` only.
  - No other UI file imports experience code.

### 2. Startup script

The bootstrap does 3 things:

1. It reads the stored record and checks its header and expiry (`envelope.ts`).
2. It adds one delegated `click` listener on `document`, for `[data-exp-enter]`,
   `[data-exp-continue]`, and `[data-exp-reload]`.
3. On Enter or Continue, in the click task, it captures the start values, creates and resumes
   an `AudioContext`, and then imports the engine. If the import fails, it closes the
   `AudioContext` and shows the failed state.

A guard, `window[Symbol.for('exp.bootstrap')]`, makes a second bootstrap (for example after a
deploy) do nothing.

### 3. Data flow (the core contract)

recorder → `VisitEvent` → timeline → `features.fold` / `features.sample` →
`mapping.map(features, backdrop, events)` (the visit time `t` is `features.visitMs`;
`events` are the events folded since the last call, for the triggers) → `{ frame: ParameterFrame, triggers }` → audio and visual
engines.

- `VisitEvent` names what the visitor did, never a sound or an image.
- `ParameterFrame` has `audio` and `visual` sub-objects with engine controls. Field names are
  never input names.
- `map()` never reads a clock. Mapping rows are typed records with stable string ids.
- Engines clamp and smooth. The audio engine enforces the master gain limit and the 40 Hz floor
  again at the output. The visual engine rate-limits bright triggers.

### 4. Time and state

- One visit clock: milliseconds since Enter. It never goes backward, and a gap is capped at the
  idle expiry.
- One tick in `session.ts`: animation frames while visible and motion is on; a 100 ms timer
  while motion is paused or reduced; nothing while the tab is hidden.
- One state machine in `session.ts`: `idle → starting → live → goodbye → ended → idle`, plus
  `failed`. Sound sub-state: `on`, `muted`, `blocked`.
- The DOM shows the state on `#experience-layer` as `data-state` and `data-sound`. Nothing is
  set on `<html>`, because `ClientRouter` replaces its attributes on every page change.
- The layer element has `transition:persist="experience-layer"` and
  `view-transition-name: none`.

### 5. Storage

- One `sessionStorage` key, `experience:visit`. Envelope:
  `{ v: 1, state, enteredAtEpochMs, savedAtEpochMs, key, events }`.
- Events are delta-encoded tuples, capped at 12,000. Only pointer and scroll events are thinned.
- Writes: at most every 5 s in idle time, at once on a state change, and synchronously when the
  tab hides or the page unloads (`pagehide`).
- Reads are validated strictly. A bad record is discarded. Text from a record reaches the DOM
  only through `textContent`.
- A committed v:1 sample record guards the format. Any format change raises `v`.

### 6. Ports and failure

- Shell modules take injected ports, with no default values: clock, scheduler, audio context
  factory, engine loader, storage, warning logger, dialog, navigate, motion reader, speech.
- A failure falls back to the normal site and logs `console.warn('[experience]', code)` with a
  code only. Codes: `engine-load-failed`, `audio-unavailable`, `canvas-unavailable`,
  `storage-unavailable`, `crypto-unavailable`, `record-discarded`, `record-expired`,
  `timeline-full`, `speech-unavailable`.
- (2026-10-18) Full-color art with reading plates replaced the brightness band, so the band
  reader and its warning code are gone. The speech port and `speech-unavailable` serve the
  spoken Goodbye messages (ADR-0008, user decision 11).
- The experience sends no telemetry and has no network code.

### 7. Checks that enforce this

- dependency-cruiser rules for each import limit in §1.
- ESLint: core purity; no network or HTML-sink APIs in experience code; the recorder cannot read
  key identity or field content; experience `<script>` blocks hold one import only.
- `check:size`: the after-Enter budget on every route; the startup script size on its own line;
  a failure on a nested dynamic import in Phase A.
- Unit tests: the core in Node; the shell in jsdom with fake ports.

## Consequences

- The mapping can change with no change to the recorder or the engines.
- The showcase and the live layer share one mapping.
- All logic can be tested without a browser. The checks after Enter still need a browser.

## Alternatives rejected

- **One module for everything** (draft 2). The mapping and the engines were fused.
- **Audio and canvas code in `src/lib/`.** The core could not be tested in Node.
- **State on `<html>`.** `ClientRouter` erases it on every page change.
- **Storing parameter frames.** A mapping change would corrupt stored visits.

## Sources

- ADR-0003, ADR-0007, ADR-0008
- `docs/plans/2026-10-18-experience-phase-a.md`
- [Astro: View transitions](https://docs.astro.build/en/guides/view-transitions/)
- [dependency-cruiser: rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)
