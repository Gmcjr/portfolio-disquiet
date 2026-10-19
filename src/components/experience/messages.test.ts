// Every Goodbye message phrase must come word for word from the user's raw note,
// so no sentence or feeling is invented for them (ADR-0008, source spec).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MESSAGE_VARIANTS, REMEMBER } from '../../lib/experience/script';

const note = readFileSync(
  new URL('../../../docs/notes/experience-raw-note.md', import.meta.url),
  'utf8',
);

describe('Goodbye messages', () => {
  const phrases = [
    ...MESSAGE_VARIANTS.flatMap((v) => [...v.opening, ...v.closing]),
    REMEMBER,
  ];

  it.each(phrases)('"%s" is verbatim in the raw note', (phrase) => {
    expect(note.includes(phrase)).toBe(true);
  });

  it('every variant is short: one opening line and at most three closing lines', () => {
    for (const variant of MESSAGE_VARIANTS) {
      expect(variant.opening.length).toBe(1);
      expect(variant.closing.length).toBeLessThanOrEqual(3);
    }
  });
});
