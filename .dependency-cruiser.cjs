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
        'Cross-cutting modules (src/config, src/lib/seo.ts, src/lib/analytics.ts) must not import UI - see ARCHITECTURE.md #4 / ADR-0003.',
      from: { path: '^src/(config/|lib/(seo|analytics)\\.ts$)' },
      to: { path: '^src/(components|layouts|pages)/' },
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
