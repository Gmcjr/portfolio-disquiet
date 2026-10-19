// Checks the built site in dist/ against the budgets in docs/ARCHITECTURE.md §8.
// This file only reads dist/ and prints; the rules are in bundle-size/analyze.ts.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { analyze, type BuiltFile, type Page } from './bundle-size/analyze';

const DIST = 'dist';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function routeOf(htmlPath: string): string {
  const rel = relative(DIST, htmlPath).replace(/index\.html$/, '');
  return `/${rel}`.replace(/\.html$/, '');
}

const all = walk(DIST);
const pages: Page[] = all
  .filter((file) => file.endsWith('.html'))
  .map((file) => ({ route: routeOf(file), html: readFileSync(file, 'utf8') }));
const files = new Map<string, BuiltFile>(
  all
    .filter((file) => file.endsWith('.js'))
    .map((file) => {
      const code = readFileSync(file, 'utf8');
      return [relative(DIST, file), { code, gzipBytes: gzipSync(code).length }];
    }),
);
const fontBytes = all
  .filter((file) => /-latin-(?!ext-)[^/]*\.woff2$/.test(file))
  .reduce((sum, file) => sum + statSync(file).size, 0);

const { lines, failed } = analyze({ pages, files, fontBytes });
for (const line of lines) console.log(line);
if (failed) process.exit(1);
