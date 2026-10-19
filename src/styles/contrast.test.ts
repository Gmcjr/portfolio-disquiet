// Checks text contrast from the design tokens, in both themes (WCAG 2.2 1.4.3).
// The experience art is full colour on reading plates (ADR-0008, user decision
// 10), so text always sits on --bg; this test guards those pairs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string): string =>
  readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');

/** `--name: value;` declarations inside the first block that `selector` opens. */
function block(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`Missing block: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  return new Map(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
      m[1] ?? '',
      (m[2] ?? '').trim(),
    ]),
  );
}

const primitives = block(read('tokens.css'), '@theme static');
const semantic = read('semantic.css');
const themes = {
  light: block(semantic, ':root'),
  dark: new Map([
    ...block(semantic, ':root'),
    ...block(semantic, "[data-theme='dark']"),
  ]),
};

/** Resolves var() chains to a #rgb or #rrggbb value. Any other format fails. */
function resolve(name: string, scope: Map<string, string>): string {
  let value = scope.get(name) ?? primitives.get(name);
  for (let depth = 0; value !== undefined && depth < 10; depth += 1) {
    const ref = /^var\((--[\w-]+)\)$/.exec(value);
    if (ref === null) break;
    value = scope.get(ref[1] ?? '') ?? primitives.get(ref[1] ?? '');
  }
  if (value === undefined || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    throw new Error(
      `${name} does not resolve to a hex colour: ${String(value)}`,
    );
  }
  return value;
}

function luminance(hex: string): number {
  const full =
    hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

const ratio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

describe.each(Object.entries(themes))('%s theme', (_theme, scope) => {
  const bg = resolve('--bg', scope);

  it.each(['--text', '--muted'])('%s on --bg is at least 4.5:1', (token) => {
    expect(ratio(resolve(token, scope), bg)).toBeGreaterThanOrEqual(4.5);
  });
});
