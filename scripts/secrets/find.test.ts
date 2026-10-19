import { describe, expect, it } from 'vitest';
import { findSecrets } from './find';

// Built at run time, so this file itself never holds a key-like string.
const fakeKey = ['re', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ12'].join('_');

describe('findSecrets', () => {
  it('finds a key-like string and reports its line', () => {
    expect(findSecrets(`one\nconst k = "${fakeKey}";\nthree`)).toEqual([2]);
  });

  it('ignores the variable name and short strings', () => {
    expect(findSecrets('RESEND_API_KEY=\nre_short\nare_not_keys_here')).toEqual(
      [],
    );
  });
});
