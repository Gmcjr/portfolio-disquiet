/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No import cycles anywhere in the tree.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'content-no-ui',
      severity: 'error',
      comment:
        'The content layer (src/content, src/lib/content) must not import UI - see ARCHITECTURE.md #4 / ADR-003.',
      from: { path: '^src/(lib/content|content)/' },
      to: { path: '^src/(components|layouts|pages)/' },
    },
    {
      name: 'crosscutting-no-ui',
      severity: 'error',
      comment:
        'Cross-cutting modules (src/config/ and the top-level files in src/lib/) must not import UI - see ARCHITECTURE.md #4 / ADR-0003.',
      from: { path: '^src/(config/|lib/[^/]+\\.ts$)' },
      to: { path: '^src/(components|layouts|pages)/' },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment:
        'An unresolved import has no real path, so the path rules cannot check it. Exceptions: astro: virtual modules, and astro/loaders (a package-exports subpath that the resolver does not follow; used by src/content.config.ts), and p5 (the same resolver limit; engine prototype).',
      from: { path: '^(src|api)/' },
      to: { couldNotResolve: true, pathNot: '^(astro:|astro/loaders$|p5$)' },
    },
    // The experience (ADR-0009 §1, §7).
    {
      name: 'experience-core-pure',
      severity: 'error',
      comment:
        'The experience core imports nothing outside src/lib/experience/ (ADR-0009 §1).',
      from: { path: '^src/lib/experience/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: '^src/lib/experience/' },
    },
    {
      name: 'experience-core-tests',
      severity: 'error',
      comment: 'Core tests import only core modules and vitest.',
      from: { path: '^src/lib/experience/.+\\.test\\.ts$' },
      to: { pathNot: '^src/lib/experience/|(^|/)node_modules/vitest/' },
    },
    {
      name: 'experience-bootstrap-lazy',
      severity: 'error',
      comment:
        'The startup code loads the engine only by dynamic import, at the Goodbye click (ADR-0009 Amendment 1).',
      from: {
        path: '^src/components/experience/(bootstrap|start|contract|record/[^/]+)\\.ts$',
      },
      to: {
        path: '^src/components/experience/(engine|detour)/',
        dependencyTypesNot: ['dynamic-import'],
      },
    },
    {
      name: 'experience-bootstrap-core-subset',
      severity: 'error',
      comment:
        'The startup code (recording) reaches only events, envelope, timeline, and key in the core (and timeline-read lazily), to stay small (ADR-0009 Amendment 1).',
      from: {
        path: '^src/components/experience/(bootstrap|start|contract|record/[^/]+)\\.ts$',
        pathNot: '\\.test\\.ts$',
      },
      to: {
        path: '^src/lib/experience/',
        pathNot:
          '^src/lib/experience/(events|envelope|timeline|timeline-read|key)\\.ts$',
      },
    },
    {
      name: 'experience-startup-parse-lazy',
      severity: 'error',
      comment:
        'The startup code loads the record parser only when a visit continues after a reload (ADR-0009 Amendment 1).',
      from: {
        path: '^src/components/experience/(bootstrap|start|contract|record/[^/]+)\\.ts$',
        pathNot: '\\.test\\.ts$',
      },
      to: {
        path: '^src/lib/experience/timeline-read\\.ts$',
        dependencyTypesNot: ['dynamic-import'],
      },
    },
    {
      name: 'experience-envelope-leaf',
      severity: 'error',
      comment:
        'envelope.ts is on the startup path, so it imports only events.ts.',
      from: { path: '^src/lib/experience/envelope\\.ts$' },
      to: {
        path: '^src/lib/experience/',
        pathNot: '^src/lib/experience/events\\.ts$',
      },
    },
    {
      name: 'experience-timeline-leaf',
      severity: 'error',
      comment: 'timeline.ts imports only events.ts and envelope.ts.',
      from: { path: '^src/lib/experience/timeline\\.ts$' },
      to: {
        path: '^src/lib/experience/',
        pathNot: '^src/lib/experience/(events|envelope)\\.ts$',
      },
    },
    {
      name: 'experience-engines-params-only',
      severity: 'error',
      comment:
        'The audio and visual engines read only parameter frames, never events or the mapping.',
      from: {
        path: '^src/components/experience/engine/[A-Za-z0-9]*(audio|visual|Audio|Visual)Engine\\.ts$',
      },
      to: {
        path: '^src/lib/experience/',
        pathNot: '^src/lib/experience/params\\.ts$',
      },
    },
    {
      name: 'experience-recorder-events-only',
      severity: 'error',
      comment: 'The recorder produces events and knows nothing else.',
      from: { path: '^src/components/experience/record/recorder\\.ts$' },
      to: {
        path: '^src/lib/experience/',
        pathNot: '^src/lib/experience/events\\.ts$',
      },
    },
    {
      name: 'experience-navigate-goodbye-only',
      severity: 'error',
      comment:
        'Only engine/goodbye.ts imports astro:transitions/client (the end navigation).',
      from: {
        path: '^src/components/experience/',
        pathNot: '^src/components/experience/engine/goodbye\\.ts$',
      },
      to: { path: '^astro:transitions/client$' },
    },
    {
      name: 'experience-p5-one-file',
      severity: 'error',
      comment:
        'Only engine/p5VisualEngine.ts imports p5 (ADR-0009 Amendment 2), so p5 stays in its own download.',
      from: {
        pathNot: '^src/components/experience/engine/p5VisualEngine\\.ts$',
      },
      to: { path: '^p5$' },
    },
    {
      name: 'experience-p5-lazy',
      severity: 'error',
      comment:
        'Only engine/goodbye.ts loads the p5 engine, and only by dynamic import (ADR-0009 Amendment 2).',
      from: { path: '^src/components/experience/engine/goodbye\\.ts$' },
      to: {
        path: '^src/components/experience/engine/p5VisualEngine\\.ts$',
        dependencyTypesNot: ['dynamic-import'],
      },
    },
    {
      name: 'experience-p5-single-loader',
      severity: 'error',
      comment: 'No file except engine/goodbye.ts imports the p5 engine.',
      from: {
        pathNot:
          '^src/components/experience/engine/(goodbye|p5VisualEngine)\\.ts$',
      },
      to: {
        path: '^src/components/experience/engine/p5VisualEngine\\.ts$',
      },
    },
    {
      name: 'experience-isolated',
      severity: 'error',
      comment: 'No code outside the experience imports experience modules.',
      from: {
        path: '^(src|api)/',
        pathNot: '^src/(lib|components|pages)/experience/',
      },
      to: { path: '^src/(lib|components)/experience/' },
    },
    {
      name: 'detour-loader-lazy',
      severity: 'error',
      comment:
        'Phase B: only engine/session.ts loads the detour, and only by dynamic import.',
      from: { path: '^src/components/experience/engine/session\\.ts$' },
      to: {
        path: '^src/components/experience/detour/',
        dependencyTypesNot: ['dynamic-import'],
      },
    },
    {
      name: 'detour-single-loader',
      severity: 'error',
      comment: 'No engine module except session.ts imports the detour.',
      from: {
        path: '^src/components/experience/engine/',
        pathNot: 'session\\.ts$',
      },
      to: { path: '^src/components/experience/detour/' },
    },
    {
      name: 'api-isolation',
      severity: 'error',
      comment:
        'api/contact.ts may import src/lib/contact-schema.ts and other pure src/lib helpers only - never content, UI, or config. See ADR-0004.',
      from: { path: '^api/' },
      to: { path: '^src/(components|layouts|pages|config|lib/content)/' },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    tsPreCompilationDeps: true,
  },
};
