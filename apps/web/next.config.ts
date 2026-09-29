import type { NextConfig } from 'next'

// REQ-1.4 / REQ-1.2 — see specs/phase-1/specs.md §2.10.
//
// Workspace packages are consumed as TypeScript source (§2.7: `main`/`types` →
// `src/index.ts`), not pre-built, so Next has to transpile them itself. Without
// this list a `next build` fails on the first `import` of an untranspiled
// workspace package. The three listed are exactly `apps/web`'s declared
// dependencies; `@nel3ab/content` is `apps/game`'s, not this app's.
const nextConfig: NextConfig = {
  transpilePackages: ['@nel3ab/ui', '@nel3ab/protocol', '@nel3ab/game'],

  // Phase 2 finding, 2026-09-29 (specs/phase-2/verification.md Gate 3, "All
  // five exist and export"). The workspace packages use `moduleResolution:
  // NodeNext`, which requires relative imports to name the *emitted* file —
  // `./primitives/Panel.js` for `Panel.tsx`. tsc and Vitest map that back to
  // the source; webpack does not, so the first `next build` that imported
  // @nel3ab/ui failed with `Module not found: Can't resolve
  // './primitives/Panel.js'` (5 of them). This tells webpack to try the
  // TypeScript sources first for a `.js` specifier, and fall back to a real
  // `.js` file. It changes resolution only — nothing about how anything is
  // compiled, linted or type-checked. specs/phase-2/specs.md §3 listed this
  // file as UNTOUCHED; the change is the owner's ruling of 2026-09-29.
  webpack: (config: { resolve: { extensionAlias?: Record<string, string[]> } }) => {
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] }
    return config
  },
}

export default nextConfig
