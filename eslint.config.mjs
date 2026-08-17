// REQ-1.7 — one flat ESLint config at the root, covering every project's TS/TSX.
// See specs/phase-1/specs.md §2.12. Divergent per-package configs are the 1am
// debugging tax mission.md §5.5 exists to avoid, so there is exactly one file.
//
// Prettier is the SOLE formatter (§2.13): `eslint-config-prettier` is spread
// LAST so it switches off anything here that could argue with Prettier, and no
// formatting rule is enabled by hand.

import js from '@eslint/js'
import next from '@next/eslint-plugin-next'
import prettier from 'eslint-config-prettier/flat'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // design/ is the committed reference of record (REQ-1.13, mission.md §5.3).
    // It is lint-dirty on purpose and must never be linted or "tidied".
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/*.tsbuildinfo', 'design/**'],
  },

  js.configs.recommended,

  // Node-run build scripts: plain ESM, no TypeScript.
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly' },
    },
  },

  // Every project's TypeScript, all six of them.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
  },

  // Next's plugin, scoped to apps/web — the only Next.js app in the workspace.
  {
    ...next.flatConfig.recommended,
    files: ['apps/web/**/*.{ts,tsx}'],
    settings: { next: { rootDir: 'apps/web' } },
    rules: {
      ...next.flatConfig.recommended.rules,
      // Pages-Router-only rule. apps/web is App Router (§2.10) and has no
      // `pages/` directory, so the rule can never apply — and it prints a
      // "Pages directory cannot be found" warning on every run when it cannot
      // locate one. Off because it is inapplicable, not because it complained.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },

  // LAST. Nothing below this line may re-enable a formatting rule.
  prettier,
)
