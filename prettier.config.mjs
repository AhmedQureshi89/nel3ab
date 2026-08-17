// REQ-1.7 — Prettier is the sole formatter (specs/phase-1/specs.md §2.13).
// Minimal and boring on purpose: these are decisions, not discussions.
//
// `endOfLine: 'lf'` must agree with `.gitattributes` (`* text=auto eol=lf`) or
// the two tools fight forever on a Windows checkout with a Linux CI runner
// (NFR-2). Do not change one without the other.

/** @type {import("prettier").Config} */
export default {
  semi: false,
  singleQuote: true,
  printWidth: 100,
  endOfLine: 'lf',
}
