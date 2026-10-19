import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import eslintConfigPrettier from 'eslint-config-prettier';

// The experience rules (ADR-0009 §7). Flat config replaces a rule's options per
// file and does not merge them, so each list is defined once here and combined
// in the blocks below.
const msg = (message) => (entry) => ({
  ...(typeof entry === 'string' ? { name: entry } : entry),
  message,
});
const EGRESS_GLOBALS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'Worker',
  'SharedWorker',
  'Image',
  'open',
  'RTCPeerConnection',
  'DOMParser',
].map(msg('No network and no HTML parsing in the experience (ADR-0008 §4).'));
const CORE_GLOBALS = [
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'sessionStorage',
  'localStorage',
  'indexedDB',
  'AudioContext',
  'OfflineAudioContext',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'performance',
  'setTimeout',
  'setInterval',
  'globalThis',
  'self',
].map(
  msg('The experience core is pure. The caller passes this in (ADR-0009 §1).'),
);
const EGRESS_PROPS = [
  { object: 'navigator', property: 'sendBeacon' },
  { property: 'addModule' },
].map((p) => ({ ...p, message: 'No network from the experience.' }));
const HTML_SINK_PROPS = [
  { property: 'innerHTML' },
  { property: 'outerHTML' },
  { property: 'insertAdjacentHTML' },
  { property: 'createContextualFragment' },
  { object: 'document', property: 'write' },
].map((p) => ({
  ...p,
  message: 'No HTML sinks. Use textContent or DOM nodes.',
}));
const CLOCK_PROPS = [
  { object: 'Date', property: 'now', message: 'Use the injected clock.' },
  {
    object: 'Math',
    property: 'random',
    message: 'Use the injected random source.',
  },
];
const CLOCK_SYNTAX = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'Use the injected clock.',
  },
  {
    selector: "CallExpression[callee.name='Date']",
    message: 'Use the injected clock.',
  },
];
const KEY_NAMES = [
  'key',
  'code',
  'keyCode',
  'which',
  'charCode',
  'shiftKey',
  'ctrlKey',
  'altKey',
  'metaKey',
  'getModifierState',
  'location',
  'value',
  'textContent',
  'innerText',
  'getSelection',
  'clipboardData',
  'href',
];
const KEY_PROPS = KEY_NAMES.map((property) => ({
  property,
  message:
    'Never read key identity or field content (ADR-0008 §4). Count and time only.',
}));
const KEY_SYNTAX = [
  {
    selector: `ObjectPattern > Property[key.name=/^(${KEY_NAMES.join('|')})$/]`,
    message: 'Never read key identity or field content (ADR-0008 §4).',
  },
];
const globalsRule = (list) => [
  'error',
  { checkGlobalObject: true, globals: list },
];
const ASTRO_IMPORT_BANS = [
  {
    regex: '(^|/)lib/experience(/|$)',
    message:
      'Only .ts files in components/experience import the core (ADR-0009 §1).',
  },
  {
    regex: '(^|/)(engine|detour)/',
    message: 'The engine loads through bootstrap.ts only (ADR-0009 §2).',
  },
];

export default tseslint.config(
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: [
      'scripts/**/*.ts',
      'src/**/*.{ts,tsx}',
      'astro.config.ts',
      'api/**/*.ts',
    ],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['*.config.ts', '*.setup.ts'],
    extends: [...tseslint.configs.recommended],
  },
  ...astro.configs['flat/recommended'],
  {
    files: ['src/lib/experience/**/*.ts'],
    rules: {
      'no-restricted-globals': globalsRule([
        ...CORE_GLOBALS,
        ...EGRESS_GLOBALS,
      ]),
      'no-restricted-properties': [
        'error',
        ...CLOCK_PROPS,
        ...EGRESS_PROPS,
        ...HTML_SINK_PROPS,
      ],
      'no-restricted-syntax': ['error', ...CLOCK_SYNTAX],
    },
  },
  {
    files: ['src/lib/experience/events.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...CLOCK_PROPS,
        ...EGRESS_PROPS,
        ...HTML_SINK_PROPS,
        ...KEY_PROPS,
      ],
      'no-restricted-syntax': ['error', ...CLOCK_SYNTAX, ...KEY_SYNTAX],
    },
  },
  {
    files: ['src/components/experience/**/*.ts'],
    rules: {
      'no-restricted-globals': globalsRule(EGRESS_GLOBALS),
      'no-restricted-properties': [
        'error',
        ...EGRESS_PROPS,
        ...HTML_SINK_PROPS,
      ],
    },
  },
  {
    files: ['src/components/experience/engine/recorder.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...EGRESS_PROPS,
        ...HTML_SINK_PROPS,
        ...KEY_PROPS,
      ],
      'no-restricted-syntax': ['error', ...KEY_SYNTAX],
    },
  },
  {
    files: ['src/**/*.astro', 'src/**/*.astro/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...ASTRO_IMPORT_BANS,
            {
              regex: '(^|/)bootstrap(\\.ts)?$',
              message:
                'Only the ExperienceLayer.astro script imports bootstrap.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/experience/ExperienceLayer.astro/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ASTRO_IMPORT_BANS }],
    },
  },
  {
    files: [
      'src/components/experience/**/*.astro/*.ts',
      'src/pages/experience/**/*.astro/*.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program > :not(ImportDeclaration)',
          message:
            'An experience <script> block holds one import only. Put the logic in a .ts module (ADR-0009 §1).',
        },
      ],
    },
  },
  {
    files: [
      'src/components/experience/**/*.astro',
      'src/pages/experience/**/*.astro',
    ],
    rules: { 'astro/no-set-html-directive': 'error' },
  },
  eslintConfigPrettier,
);
