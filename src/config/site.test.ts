import { describe, expect, it } from 'vitest';
import { NAV } from './site';

describe('site config', () => {
  it('keeps reserved sections disabled until they are built.', () => {
    const reserved = NAV.filter((item) =>
      ['/writing', '/music', '/art'].includes(item.href),
    );
    expect(reserved.every((item) => !item.enabled)).toBe(true);
  });
});
