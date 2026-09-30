import { describe, expect, test } from 'vitest'

import { displaySeconds } from './clock.js'

// REQ-3.9 — verification.md Gate 2, "Display, exhaustively". See
// specs/phase-3/specs.md §2.3 (the `displaySeconds` row).
//
// The reference below is integer arithmetic — `Math.floor((ms + 999) / 1000)`
// is the ceiling of ms / 1000 for any non-negative integer ms — so the
// exhaustive check compares the helper against a second, independent
// formulation of "round up", not against a copy of its own expression.

/** The longest bank the prototype allows: 90 s (ROUND_SECONDS_OPTIONS' maximum). */
const MAX_MS = 90_000

const reference = (ms: number): number => Math.floor((ms + 999) / 1000)

describe('REQ-3.9: displaySeconds — whole seconds, rounded up, clamped at zero', () => {
  test('equals floor((ms + 999) / 1000) for every integer ms in 0 … 90,000', () => {
    let checked = 0
    const mismatches: (readonly [ms: number, got: number, want: number])[] = []
    for (let ms = 0; ms <= MAX_MS; ms += 1) {
      checked += 1
      const got = displaySeconds(ms)
      const want = reference(ms)
      if (!Object.is(got, want)) mismatches.push([ms, got, want])
    }
    // One comparison, so a failure reports the count and the first few cases
    // rather than stopping at the first of possibly thousands.
    expect({ checked, mismatches: mismatches.length, first: mismatches.slice(0, 5) }).toStrictEqual(
      { checked: 90_001, mismatches: 0, first: [] },
    )
  })

  const EDGES: readonly (readonly [ms: number, seconds: number])[] = [
    [0, 0],
    [1, 1],
    [999, 1],
    [1000, 1],
    [1001, 2],
    [44_001, 45],
    [45_000, 45],
  ]

  test('the edge list is the seven verification.md names', () => {
    expect(EDGES).toHaveLength(7)
  })

  test.for(EDGES)('%s ms shows %s', ([ms, seconds]) => {
    expect(Object.is(displaySeconds(ms), seconds)).toBe(true)
  })

  const NEGATIVES = [-1, -999, -1000, -1e9]

  test('the negative list is the four verification.md names, and the clamp is not vacuous', () => {
    expect(NEGATIVES).toHaveLength(4)
    // Without the clamp, -1 and -999 would show "-0" and -1000 would show -1:
    // the assertions below would fail if `Math.max(0, …)` were dropped.
    expect(Object.is(Math.ceil(-1 / 1000), -0)).toBe(true)
    expect(Math.ceil(-1000 / 1000)).toBe(-1)
  })

  test.for(NEGATIVES)('%s ms shows +0 — not -0, not negative', (ms) => {
    // Object.is, not toBe(0) alone: it is the assertion that tells +0 from -0.
    expect(Object.is(displaySeconds(ms), 0)).toBe(true)
  })

  test.for([NaN, Infinity, -Infinity])('%s throws a RangeError', (ms) => {
    expect(() => displaySeconds(ms)).toThrow(RangeError)
    expect(() => displaySeconds(ms)).toThrow(`got ${ms}`)
  })
})
