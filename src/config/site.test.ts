import { describe, expect, it } from 'vitest';
import { NAV, SITE_NAME } from './site';

describe('site config', () => {
  it('has the expected site name', () => {
    expect(SITE_NAME).toBe('Disquiet');
  });

  it('keeps reserved sections disabled until they are built.', () => {
    const reserved = NAV.filter((item) =>
      ['/writing', '/music', '/art'].includes(item.href),
    );
    expect(reserved.every((item) => !item.enabled)).toBe(true);
  });
});
