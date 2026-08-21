// REQ-2.1 — CSS Modules, declared for `tsc`, which does not understand them.
// See specs/phase-2/specs.md §2.10.
//
// `Readonly<Record<string, string>>` rather than a generated per-file type:
// generating types is a toolchain decision this phase does not take, and
// `noUncheckedIndexedAccess` in tsconfig.base.json would make a generated map's
// misses `string | undefined` anyway. This shape is honest about what the
// bundler produces.

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
