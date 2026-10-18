// Checks the built site in dist/ against the budgets in docs/ARCHITECTURE.md §8:
// JS per page (gzip) and the total size of the Latin font files. Also fails on
// any inline script, because the CSP blocks them.
// Counts the scripts a page loads at startup: <script src> plus their static
// imports. Dynamic imports (loaded after a user action) are not counted.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const KB = 1024;
const DEFAULT_JS_BUDGET = 12 * KB;
const JS_BUDGETS: Record<string, number> = { '/contact/': 16 * KB };
// Routes skipped by every check here. /experience is broken and gets rewritten as a
// separate milestone (recovery plan Step 6). Remove it from this set then.
const EXEMPT_ROUTES = new Set(['/experience/']);
const FONT_BUDGET = 120 * KB;

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

function staticImports(jsPath: string): string[] {
  const code = readFileSync(jsPath, 'utf8');
  const found = [
    ...code.matchAll(
      /(?:^|[;\s}])import\s*(?:[\w*{}\s,$]+from\s*)?["']([^"']+)["']/g,
    ),
  ];
  return found
    .map((match) => match[1])
    .filter(
      (spec): spec is string => spec !== undefined && spec.startsWith('.'),
    )
    .map((spec) => join(jsPath, '..', spec));
}

function pageScripts(htmlPath: string): Set<string> {
  const html = readFileSync(htmlPath, 'utf8');
  const entries = [...html.matchAll(/<script[^>]*\ssrc="(\/[^"]+\.js)"/g)]
    .map((match) => match[1])
    .filter((src): src is string => src !== undefined)
    .map((src) => join(DIST, src));
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    queue.push(...staticImports(file));
  }
  return seen;
}

const gzipSize = (file: string): number => gzipSync(readFileSync(file)).length;
const kb = (bytes: number): string => `${(bytes / KB).toFixed(1)} KB`;

let failed = false;
const files = walk(DIST);

for (const html of files.filter((file) => file.endsWith('.html'))) {
  const route = routeOf(html);
  if (EXEMPT_ROUTES.has(route)) continue;
  // The CSP (script-src 'self') blocks inline scripts. JSON data blocks are allowed.
  const inline = [
    ...readFileSync(html, 'utf8').matchAll(/<script(?![^>]*\ssrc=)([^>]*)>/g),
  ]
    .map((match) => match[1] ?? '')
    .filter((attrs) => !/type="application\/(ld\+)?json"/.test(attrs));
  if (inline.length > 0) {
    failed = true;
    console.log(
      `FAIL CSP  ${route.padEnd(24)} ${inline.length} inline script(s)`,
    );
  }
  const total = [...pageScripts(html)].reduce(
    (sum, file) => sum + gzipSize(file),
    0,
  );
  const budget = JS_BUDGETS[route] ?? DEFAULT_JS_BUDGET;
  const ok = total <= budget;
  if (!ok) failed = true;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} JS   ${route.padEnd(24)} ${kb(total)} / ${kb(budget)}`,
  );
}

const fontTotal = files
  .filter((file) => /-latin-(?!ext-)[^/]*\.woff2$/.test(file))
  .reduce((sum, file) => sum + statSync(file).size, 0);
const fontsOk = fontTotal <= FONT_BUDGET;
if (!fontsOk) failed = true;
console.log(
  `${fontsOk ? 'ok  ' : 'FAIL'} font Latin files total     ${kb(fontTotal)} / ${kb(FONT_BUDGET)}`,
);

if (failed) process.exit(1);
