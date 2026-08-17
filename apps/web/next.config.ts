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
}

export default nextConfig
