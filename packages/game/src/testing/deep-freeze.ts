// Test support (Phase 3) — recursive Object.freeze. REQ-3.3.
// See specs/phase-3/specs.md §2.8.
//
// Every (state, action) pair of the per-length sample and the scripted
// scenarios is deep-frozen before `reduce` sees it (verification.md Gate 5,
// "Never mutates its input"). ES modules are strict, so a write to a frozen
// object THROWS a TypeError instead of failing silently: a reducer that
// mutated its input would stop the run rather than pass it.
//
// States share structure — a tick copies the top level and the clock and
// shares everything else — so freezing each state from scratch would re-walk
// the same question pool hundreds of thousands of times. `done` remembers every
// object already walked; an object is added before its children are walked, so
// a shared sub-object is walked once, and the walk cannot loop.
//
// Test support: excluded from coverage (REQ-3.12's second exclusion), never
// exported from index.ts, imported only by `*.test.ts`.

const done = new WeakSet<object>()

/** Freeze `value` and everything reachable from it through own properties; returns `value`. */
export function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || done.has(value)) return value
  done.add(value)
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key])
  }
  Object.freeze(value)
  return value
}
