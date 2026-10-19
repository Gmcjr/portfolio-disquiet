---
status: accepted
date: 2026-10-18
---

# ADR-0008: Visitor-made audiovisual experience

**Status:** Accepted — 2026-10-18 (draft 4, from the Step 6 planning run). Replaces drafts 2 and 3. The runtime structure is in ADR-0009. The build steps are in
`docs/plans/2026-10-18-experience-phase-a.md`.
**Reversibility:** Cheap. The experience is an opt-in layer. Remove the layer component, its
startup script, `src/lib/experience/`, and `src/pages/experience/`. The rest of the site does
not depend on them.

## Source spec

The user's raw note, `docs/notes/experience-raw-note.md`, is the spec. Read it in full before
you change this ADR or the code. All Goodbye message texts come from the note, in the user's
words. Do not rewrite them.

## Context

- **The note asks for:**
  1. A welcome and an Enter button. The Enter click makes a hash key that sets the start
     environment (the backdrop).
  2. During the visit, the visitor's input and inaction shape sound and image in real time,
     while the visitor uses the normal site.
  3. A "Time to Say Goodbye" button. The screen goes dark, messages fade in one sentence at a
     time, and a showcase replays the visit. Then more messages, "Remember?", a whiteout or
     blackout, and a fade back in.
  4. A detour ("Micro to the macro"). This is Phase B.
- **Constraints:** CONTEXT §2 (the work is one click away), §5 (no unnecessary tracking),
  ADR-0007 (static, no server state), ARCHITECTURE §8 (WCAG 2.2 AA, Lighthouse, size budgets).
- **Earlier drafts:** draft 2 used a random seed as the main driver and ignored the visitor's
  input. The user rejected it on 2026-10-18.

## Governing rule

**Nothing from the experience runs for a visitor who has not pressed Enter.** Without Enter,
the site is the normal portfolio. Enter is also the visitor's agreement to the recording of
their input, so the welcome page states the facts before the button.

## Decisions made by the user (2026-10-18)

1. **Scope:** a layer on the whole site, opt-in. After Enter, the backdrop and the sound stay
   active while the visitor uses the normal site.
2. **Phases:** Phase A first (Enter → live layer → Goodbye). Phase B (the detour) gets its own
   ADR later.
3. **Seed:** made in the browser. No IP address, no cookie, no server.
4. **Media:** the Web Audio API and Canvas 2D. No Tone.js, no p5.
5. **Budget:** ≤12 KB gzip of JS at startup on each page; ≤40 KB gzip loaded after Enter.
6. **Reload:** after a reload, nothing runs until the visitor clicks Continue.
7. **Release:** 3 PRs (core and tooling; the layer, not linked; the link). The checks after
   Enter are a scripted checklist on each preview, not a CI gate.
8. **Name:** the visit's final hash is the "visit seal".
9. **Mapping:** the input-to-sound-and-image rows, decided row by row (see the plan file, §3).
10. **Color (provisional; the user reassesses later):** the live art uses full color. Page text
    gets reading plates (solid panels behind the text) so that it stays readable.
11. **Voice (provisional; the user reassesses later):** the Goodbye messages are also spoken,
    and the text always shows with the voice.

## Decision

### 1. Entry

- `/experience` is the welcome page. It has the consent facts (§6), a link to `/privacy`, the
  link "Skip it and go to the work", and the Enter button.
- **DECISION NEEDED (user):** where the link to `/experience` goes. Planner default: one line
  in the home-page intro.

### 2. Hash key and backdrop

- At Enter, the browser hashes each start value on its own, shuffles the hashes with a seeded
  generator, and hashes the list into one key. Start values: random bytes, the time, the
  timezone, the theme, the viewport size, and the referrer category (`none`, `internal`,
  `external`).
- The site stores only the key. It never stores, shows, or sends the raw start values.
- The key sets the backdrop: palette anchor, texture, musical key and mode, waveform, reverb,
  how the showcase emerges, and the ending.
- The key is an artistic device. It adds no security on a static site. No code or copy calls it
  a lock, a security feature, or an ID.

### 3. Input to sound and image

- The mapping table is in the plan file, §3, with stable row ids. It has 16 live rows and 8
  backdrop rows. The user decided the 16 live rows on 2026-10-18 (11 kept, 5 changed). The 8
  backdrop rows keep the design planner's proposal.
- Location means the timezone only. The visitor counter and the music metrics are deferred.

### 4. Recording the visit

- The site records input only after Enter, and only until Goodbye.
- It records: clicks and pointer position on a coarse grid (64 × 64 at most), scroll amount,
  the time of each key press rounded to 0.1 s (never the key, never the key release), the page
  path (no query, no fragment), tab hidden or shown, theme changes, mute, and pause motion.
- It records nothing inside form fields.
- The record lives in one `sessionStorage` key in the tab. It goes to no server.
- Goodbye deletes the record. A stored record expires after 30 minutes idle or 24 hours in
  total. **DECISION NEEDED (user):** the expiry values. Planner default: 30 min and 24 h.
- A new tab is outside the experience. A copied tab is its own visit.
  **DECISION NEEDED (user):** confirm this tab behavior.

### 5. Time to Say Goodbye

- The control bar has a "Time to Say Goodbye" button while the layer runs.
- Sequence: dark → first messages → showcase → second messages → "Remember?" → whiteout or
  blackout → fade back in. The showcase replays the record through the same mapping as the live
  layer.
- The visitor can pause or skip at any time. "Show all text" gives every message and a visit
  record (counts of clicks, pages, key presses, minutes, and the longest stillness).
- Each message is also spoken (user decision 11). The text shows at the same time as the voice,
  so the text is the alternative for the audio (WCAG 1.2.1). Mute also silences the voice.
- **DECISION NEEDED (user):** the voice source. Planner default until the user records a
  voice: the browser's speech synthesis, with on-device voices only (`localService`), because a
  remote voice sends the text to a vendor. If no on-device voice exists, the text shows alone.
- **DECISION NEEDED (user):**
  - where Goodbye ends (planner default: `/experience`);
  - the final message sentences, cut from the note;
  - whiteout or blackout, or the key picks (planner default: the key picks; reduced motion
    always gets blackout);
  - whether the visit seal shows (planner default: yes, with the line "It comes from random
    numbers. It cannot identify you or your device.");
  - whether Escape skips (planner default: yes);
  - Pause inside Goodbye (planner default: yes).

### 6. Consent and privacy

- The welcome page lists the facts in §4 before the Enter button.
- The privacy page gets a section `#experience` with the same facts.
- **DECISION NEEDED (user):** the welcome and privacy copy (the security planner wrote a draft;
  the user edits the voice); whether the footer goes on every page.

### 7. Accessibility (WCAG 2.2 AA)

- Sound starts only after a click. Mute and "Pause motion" are always in the control bar.
- The live art uses full color (user decision 10). Text keeps its contrast because it sits on
  reading plates: solid panels in the page background color behind text blocks, the header,
  and controls. The art shows around and between the plates.
- Nothing flashes more than 3 times a second. Full color removes the brightness band that made
  flashes impossible by construction, so the flash limits now apply to the live layer too: at
  most 3 bright changes per second, and slow ramps for large brightness changes. The whiteout
  and blackout are slow fades.
- Reduced motion gives a slowly changing still image.
- There is no live transcript. The canvas has a static description. The visit record is the
  text equivalent of the showcase.
- **DECISION NEEDED (user):** the control bar first in the tab order (planner default) or last.

## Consequences

- The visitor makes the piece. Two visitors with the same actions still get different pieces,
  because their keys differ.
- A visitor who never presses Enter gets the same site as before, plus one small script.
- The live art is in full color. Reading plates cover the art where text is, so every page
  template needs plates behind its text blocks.

## Exit criteria (Phase A)

1. CI passes on every PR, with the new rules and checks (ADR-0009).
2. Axe reports no violations before Enter, while the layer runs, and during Goodbye.
3. The browser checklist B-1 to B-13 in the plan file passes on the preview. It covers: no
   audio and no recording before Enter; each approved row changes sound and image; mute and
   pause motion; survival across a page change; Continue after a reload; Goodbye plays and can
   be skipped; no record after Goodbye.
4. After Enter, the experience makes no request except same-origin GET requests for pages and
   static files, with no query and no body. **DECISION NEEDED (user):** approve this wording.
5. The user tests the first Enter on an iPhone, listens to the whole piece, and approves it.

## Alternatives rejected

- **Draft 2, seed-driven.** It ignored the visitor's input.
- **IP address and cookie as the seed.** It conflicts with CONTEXT §5.
- **A landing gate in front of the whole site.** It conflicts with CONTEXT §2.
- **The `/experience` page only.** "Which page" and "time on a page" would have no meaning.
- **Tone.js and p5.** About 330 KB gzip together (measured 2026-10-18).
- **A live transcript of the sound.** It floods screen readers. The visit record replaces it.

## Sources

- `docs/notes/experience-raw-note.md`
- `docs/plans/2026-10-18-experience-phase-a.md`
- ADR-0009, ADR-0007, ADR-0003, `CONTEXT.md` §2, §5
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [MDN: Window.sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)
