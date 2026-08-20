// REQ-2.1 — the plumbing probe. See specs/phase-2/specs.md §1 STEP 1, §4 R1/R2.
//
// verification.md Gate 1 requires `packages/ui` to contain at least one `.tsx`
// component, one `.module.css` and one `.test.tsx` *before* the four gate
// commands are run, because Gate 1 is "the cheapest possible probe of risk
// R1/R2 — run it before writing a token." Four tools read this package by four
// different paths (tsc --build's project-reference graph, Vite/oxc under
// Vitest, Next's transpilePackages, Stylelint) and this is the smallest file
// set that puts JSX and a CSS Module in front of all of them.
//
// It is deliberately NOT exported from index.ts. It is not a primitive and not
// a design decision; the real ones are STEP 4.

import styles from './plumbing-probe.module.css'

export function PlumbingProbe() {
  return <div className={styles.probe} data-probe="ui-plumbing" />
}
