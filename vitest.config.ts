import { defineConfig } from 'vitest/config'

// One root config, one project per workspace member (REQ-1.6).
// Vitest 4 exposes multi-project runs as `test.projects` here; the separate
// `vitest.workspace.ts` file was deprecated in v3 and removed in v4, so it is
// deliberately absent — see specs/phase-1/specs.md §2.9.
//
// `passWithNoTests: false` is set on every project *and* at the root: it is the
// difference between "0 tests passed" reporting success and the run failing.
// It is necessary but not sufficient — a single project silently dropping out
// of collection still exits 0 (measured) — so `pnpm test` runs Vitest through
// scripts/check-collected-tests.mjs, which asserts the collected file count
// against the number of workspace projects on disk.

const project = (name: string, root: string) => ({
  test: {
    name,
    root,
    // `.test.ts` stays FIRST and stays matched (REQ-2.1, specs/phase-2/specs.md
    // §2.12): widening for `packages/ui`'s .tsx must not narrow for the five
    // projects whose only test file is a .ts, or they drop out of collection
    // and scripts/check-collected-tests.mjs fails on the count.
    include: ['**/*.test.ts', '**/*.test.tsx'],
    passWithNoTests: false,
  },
})

export default defineConfig({
  test: {
    passWithNoTests: false,
    projects: [
      project('@nel3ab/game', './packages/game'),
      project('@nel3ab/protocol', './packages/protocol'),
      project('@nel3ab/content', './packages/content'),
      project('@nel3ab/ui', './packages/ui'),
      project('nel3ab-game', './apps/game'),
      {
        ...project('nel3ab-web', './apps/web'),
        // apps/web/tsconfig.json sets `jsx: "preserve"` because Next compiles
        // the JSX itself (specs.md §2.10). Vite honours that tsconfig, so
        // without this override it hands untransformed JSX to import analysis
        // and rtl-root.test.ts fails to parse app/layout.tsx. Scoped to this
        // one project: nothing else in the workspace contains JSX.
        oxc: { jsx: { runtime: 'automatic' as const } },
      },
    ],
  },
})
