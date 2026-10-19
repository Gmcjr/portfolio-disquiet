// The experience layer persists across page changes, and Astro restarts CSS
// animations on persisted elements. So experience styles hold no CSS animation;
// motion comes from the canvas or the Web Animations API (design plan D-4).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const ROOTS = ['components/experience', 'pages/experience'];
const STYLE_FILE = /^experience.*\.css$/;
const PATTERNS = [
  /@keyframes\b/,
  /(^|[\s;{"'])animation(-[a-z-]+)?\s*:/m,
  /\banimate-[a-z]/,
];

function walk(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  } catch {
    return [];
  }
}

const files = [
  ...ROOTS.flatMap((root) => walk(join(SRC, root))),
  ...walk(join(SRC, 'styles')).filter((file) =>
    STYLE_FILE.test(file.split('/').pop() ?? ''),
  ),
].filter(
  (file) => /\.(astro|css|ts)$/.test(file) && !file.endsWith('.test.ts'),
);

describe('experience styles', () => {
  it('contain no CSS animation', () => {
    const hits = files.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          PATTERNS.some((p) => p.test(line)) ? [`${file}:${i + 1}`] : [],
        ),
    );
    expect(hits).toEqual([]);
  });
});
