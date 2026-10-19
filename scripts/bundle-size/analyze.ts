// The rules of `check:size`, as pure functions over the built files (ADR-0009
// §7; ARCHITECTURE.md §8). No file system, no gzip, no process: the main script
// reads dist/ and passes everything in, so tests can use in-memory fixtures.

import { posix } from 'node:path';

export const KB = 1024;
export const DEFAULT_JS_BUDGET = 12 * KB;
export const JS_BUDGETS: Readonly<Record<string, number>> = {
  '/contact/': 16 * KB,
};
/** JS that loads after a click (the experience engine after Enter). */
export const AFTER_CLICK_DEFAULT = 40 * KB;
export const AFTER_CLICK_BUDGETS: Readonly<Record<string, number>> = {};
export const FONT_BUDGET = 120 * KB;
export const BOOTSTRAP_TARGET = 2 * KB;
export const BOOTSTRAP_CEILING = 5 * KB;
/** Phase A (ADR-0008): the engine loads in one piece. Phase B sets this to true. */
export const NESTED_LAZY_ALLOWED = false;
/** Astro's chunk name for the first <script> of ExperienceLayer.astro. */
export const BOOTSTRAP_ENTRY =
  /(^|\/)ExperienceLayer\.astro_astro_type_script_index_0_lang\.[\w-]+\.js$/;
const LAYER_MARKER = 'id="experience-layer"';

const STATIC_IMPORT =
  /(?:^|[;\s}])import\s*(?:[\w*{}\s,$]+from\s*)?["']([^"']+)["']/g;
// Vite writes dynamic import paths as template literals: import(`./x.js`).
const DYNAMIC_IMPORT = /import\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

export interface BuiltFile {
  code: string;
  gzipBytes: number;
}

export interface Page {
  route: string;
  html: string;
}

export interface AnalyzeInput {
  pages: readonly Page[];
  /** Keyed by the path relative to dist/, for example `_astro/x.js`. */
  files: ReadonlyMap<string, BuiltFile>;
  fontBytes: number;
}

/** Relative import specifiers in a built file, static or dynamic. */
export function parseImports(
  code: string,
  kind: 'static' | 'dynamic',
): string[] {
  const pattern = kind === 'static' ? STATIC_IMPORT : DYNAMIC_IMPORT;
  return [...code.matchAll(pattern)]
    .map((match) => match[1])
    .filter(
      (spec): spec is string => spec !== undefined && spec.startsWith('.'),
    );
}

export function classifyBootstrap(bytes: number): 'ok' | 'warn' | 'fail' {
  if (bytes <= BOOTSTRAP_TARGET) return 'ok';
  if (bytes <= BOOTSTRAP_CEILING) return 'warn';
  return 'fail';
}

const resolveFrom = (file: string, spec: string): string =>
  posix.normalize(posix.join(posix.dirname(file), spec));

function closure(
  entries: readonly string[],
  files: ReadonlyMap<string, BuiltFile>,
): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    const code = files.get(file)?.code ?? '';
    queue.push(
      ...parseImports(code, 'static').map((spec) => resolveFrom(file, spec)),
    );
  }
  return seen;
}

const bytesOf = (
  set: Iterable<string>,
  files: ReadonlyMap<string, BuiltFile>,
): number =>
  [...set].reduce((sum, file) => sum + (files.get(file)?.gzipBytes ?? 0), 0);

const kb = (bytes: number): string => `${(bytes / KB).toFixed(1)} KB`;

function scriptEntries(html: string): string[] {
  return [...html.matchAll(/<script[^>]*\ssrc="\/([^"]+\.js)"/g)]
    .map((match) => match[1])
    .filter((src): src is string => src !== undefined);
}

function inlineScripts(html: string): number {
  // The CSP (script-src 'self') blocks inline scripts. JSON data blocks are allowed.
  return [...html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>/g)]
    .map((match) => match[1] ?? '')
    .filter((attrs) => !/type="application\/(ld\+)?json"/.test(attrs)).length;
}

export function analyze(input: AnalyzeInput): {
  lines: string[];
  failed: boolean;
} {
  const { pages, files } = input;
  const lines: string[] = [];
  let failed = false;
  const fail = (line: string): void => {
    failed = true;
    lines.push(line);
  };
  let largestBootstrap = -1;
  let layerPages = 0;

  for (const { route, html } of pages) {
    const name = route.padEnd(24);
    const inline = inlineScripts(html);
    if (inline > 0) fail(`FAIL CSP  ${name} ${inline} inline script(s)`);

    const entries = scriptEntries(html);
    const startup = closure(entries, files);
    const startupBytes = bytesOf(startup, files);
    const budget = JS_BUDGETS[route] ?? DEFAULT_JS_BUDGET;
    const startupLine = `JS   ${name} ${kb(startupBytes)} / ${kb(budget)}`;
    if (startupBytes > budget) fail(`FAIL ${startupLine}`);
    else lines.push(`ok   ${startupLine}`);

    const lazyEntries = [...startup].flatMap((file) =>
      parseImports(files.get(file)?.code ?? '', 'dynamic').map((spec) =>
        resolveFrom(file, spec),
      ),
    );
    const after = closure(lazyEntries, files);
    for (const file of startup) after.delete(file);
    const afterBytes = bytesOf(after, files);
    const afterBudget = AFTER_CLICK_BUDGETS[route] ?? AFTER_CLICK_DEFAULT;
    const afterLine = `JS   ${`${route} (after click)`.padEnd(24)} ${kb(afterBytes)} / ${kb(afterBudget)}`;
    if (afterBytes > afterBudget) fail(`FAIL ${afterLine}`);
    else if (after.size > 0) lines.push(`ok   ${afterLine}`);

    for (const file of after) {
      if (parseImports(files.get(file)?.code ?? '', 'dynamic').length === 0)
        continue;
      if (NESTED_LAZY_ALLOWED)
        lines.push(`info lazy ${route} ${file} (not budgeted)`);
      else fail(`FAIL lazy ${name} ${file} has a nested import()`);
    }

    if (!html.includes(LAYER_MARKER)) continue;
    layerPages += 1;
    const layerEntry = entries.find((entry) => BOOTSTRAP_ENTRY.test(entry));
    if (layerEntry === undefined) {
      fail(
        `FAIL boot ${name} has the experience layer but no bootstrap script`,
      );
      continue;
    }
    if (after.size === 0) {
      fail(
        `FAIL boot ${name} loads the engine at startup (no code after Enter)`,
      );
    }
    const others = closure(
      entries.filter((entry) => entry !== layerEntry),
      files,
    );
    const own = [...closure([layerEntry], files)].filter(
      (file) => !others.has(file),
    );
    largestBootstrap = Math.max(largestBootstrap, bytesOf(own, files));
  }

  if (layerPages === 0) {
    lines.push('info boot no page has the experience layer');
  } else {
    const verdict = classifyBootstrap(largestBootstrap);
    const line = `boot startup script ${kb(largestBootstrap)} (target ${kb(BOOTSTRAP_TARGET)}, ceiling ${kb(BOOTSTRAP_CEILING)})`;
    if (verdict === 'fail') fail(`FAIL ${line}`);
    else lines.push(`${verdict === 'ok' ? 'ok  ' : 'WARN'} ${line}`);
  }

  const fontLine = `font Latin files total     ${kb(input.fontBytes)} / ${kb(FONT_BUDGET)}`;
  if (input.fontBytes > FONT_BUDGET) fail(`FAIL ${fontLine}`);
  else lines.push(`ok   ${fontLine}`);

  return { lines, failed };
}
