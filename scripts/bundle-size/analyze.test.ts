import { describe, expect, it } from 'vitest';
import {
  AFTER_CLICK_DEFAULT,
  BOOTSTRAP_CEILING,
  BOOTSTRAP_TARGET,
  KB,
  analyze,
  classifyBootstrap,
  parseImports,
  type BuiltFile,
} from './analyze';

const LAYER_CHUNK =
  '_astro/ExperienceLayer.astro_astro_type_script_index_0_lang.Ab1-x.js';
const ROUTER_CHUNK =
  '_astro/ClientRouter.astro_astro_type_script_index_0_lang.Zz9.js';
const ENGINE_CHUNK = '_astro/index.Qq7.js';

const file = (code: string, gzipBytes: number): BuiltFile => ({
  code,
  gzipBytes,
});

function page(scripts: string[], layer: boolean) {
  const tags = scripts
    .map((s) => `<script type="module" src="/${s}"></script>`)
    .join('');
  const body = layer ? '<div id="experience-layer"></div>' : '';
  return `<html><head>${tags}</head><body>${body}</body></html>`;
}

function run(
  files: Record<string, BuiltFile>,
  html: string,
  route = '/work/',
): ReturnType<typeof analyze> {
  return analyze({
    pages: [{ route, html }],
    files: new Map(Object.entries(files)),
    fontBytes: 70 * KB,
  });
}

const failures = (result: ReturnType<typeof analyze>) =>
  result.lines.filter((line) => line.startsWith('FAIL'));

describe('parseImports', () => {
  it('finds static imports and template-literal dynamic imports', () => {
    const code =
      'import{a as b}from"./x.js";const e=()=>import(`./engine.Ab.js`);';
    expect(parseImports(code, 'static')).toEqual(['./x.js']);
    expect(parseImports(code, 'dynamic')).toEqual(['./engine.Ab.js']);
  });

  it('ignores package imports', () => {
    expect(
      parseImports('import "astro:x";import y from "react";', 'static'),
    ).toEqual([]);
  });
});

describe('classifyBootstrap', () => {
  it('splits at the 2 KB target and the 5 KB ceiling', () => {
    expect(classifyBootstrap(BOOTSTRAP_TARGET)).toBe('ok');
    expect(classifyBootstrap(BOOTSTRAP_TARGET + 1)).toBe('warn');
    expect(classifyBootstrap(BOOTSTRAP_CEILING)).toBe('warn');
    expect(classifyBootstrap(BOOTSTRAP_CEILING + 1)).toBe('fail');
  });
});

describe('analyze', () => {
  const engine = file('export const run=1;', 20 * KB);
  const bootstrap = file('const go=()=>import(`./index.Qq7.js`);', 1 * KB);
  const router = file('export const r=1;', 4 * KB);

  it('passes a page with a small bootstrap and a lazy engine', () => {
    const result = run(
      {
        [LAYER_CHUNK]: bootstrap,
        [ROUTER_CHUNK]: router,
        [ENGINE_CHUNK]: engine,
      },
      page([LAYER_CHUNK, ROUTER_CHUNK], true),
    );
    expect(failures(result)).toEqual([]);
    expect(result.lines.some((line) => line.startsWith('ok   boot'))).toBe(
      true,
    );
  });

  it('fails when the engine is over the after-click budget', () => {
    const result = run(
      {
        [LAYER_CHUNK]: bootstrap,
        [ENGINE_CHUNK]: file('x', AFTER_CLICK_DEFAULT + 1),
      },
      page([LAYER_CHUNK], true),
    );
    expect(failures(result).join()).toMatch(/after click/);
  });

  it('fails on a nested import() in the after-click code', () => {
    const result = run(
      {
        [LAYER_CHUNK]: bootstrap,
        [ENGINE_CHUNK]: file('const d=()=>import(`./detour.X.js`);', 5 * KB),
        '_astro/detour.X.js': file('x', KB),
      },
      page([LAYER_CHUNK], true),
    );
    expect(failures(result).join()).toMatch(/nested import/);
  });

  it('fails when a page has the layer but no bootstrap script', () => {
    const result = run({ [ROUTER_CHUNK]: router }, page([ROUTER_CHUNK], true));
    expect(failures(result).join()).toMatch(/no bootstrap script/);
  });

  it('fails when the engine became a static import', () => {
    const staticBoot = file('import"./index.Qq7.js";', KB);
    const result = run(
      { [LAYER_CHUNK]: staticBoot, [ENGINE_CHUNK]: file('x', KB) },
      page([LAYER_CHUNK], true),
    );
    expect(failures(result).join()).toMatch(/loads the engine at startup/);
  });

  it('fails a bootstrap over the 5 KB ceiling', () => {
    const big = file('const go=()=>import(`./index.Qq7.js`);', 6 * KB);
    const result = run(
      { [LAYER_CHUNK]: big, [ENGINE_CHUNK]: engine },
      page([LAYER_CHUNK], true),
    );
    expect(failures(result).join()).toMatch(/startup script/);
  });

  it('only reports info when no page has the layer', () => {
    const result = run({ [ROUTER_CHUNK]: router }, page([ROUTER_CHUNK], false));
    expect(failures(result)).toEqual([]);
    expect(result.lines).toContain(
      'info boot no page has the experience layer',
    );
  });

  it('fails an inline script and a page over its startup budget', () => {
    const result = run(
      { [ROUTER_CHUNK]: file('x', 13 * KB) },
      `<script>alert(1)</script>${page([ROUTER_CHUNK], false)}`,
    );
    expect(failures(result)).toHaveLength(2);
  });

  it('allows the larger budget on /contact/', () => {
    const result = run(
      { [ROUTER_CHUNK]: file('x', 15 * KB) },
      page([ROUTER_CHUNK], false),
      '/contact/',
    );
    expect(failures(result)).toEqual([]);
  });
});
