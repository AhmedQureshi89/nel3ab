import { describe, expect, test } from 'vitest'

import {
  displaySeconds,
  remainingMs,
  settleActive,
  startClock,
  stopClock,
  zeroActive,
} from './clock.js'
import type { ClockState } from './types.js'

// REQ-3.9 — verification.md Gate 2, "Display, exhaustively". See
// specs/phase-3/specs.md §2.3 (the `displaySeconds` row).
//
// REQ-3.4, REQ-3.7 — `remainingMs` and the four internal transitions, at the
// end of this file. Their behaviour inside a round, through the reducer, is
// verification.md Gates 3 and 4, in reducer.test.ts.
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

// --- REQ-3.4, REQ-3.7: remainingMs and the internal transitions --------------

/** A clock with team `a` started and a full 45 s bank each; `over` replaces any field. */
const clock = (over: Partial<ClockState> = {}): ClockState => ({
  now: 0,
  active: 'a',
  runningSince: null,
  banks: { a: { ms: 45_000, started: true }, b: { ms: 45_000, started: false } },
  ...over,
})

describe('REQ-3.4: remainingMs — only the active bank runs, and only while the clock runs', () => {
  test('active and running: the bank less the elapsed time, now − runningSince', () => {
    expect(remainingMs(clock({ now: 1_300, runningSince: 300 }), 'a')).toBe(44_000)
  })

  test('running since engine time 0 — the value zero, which is not a stopped clock', () => {
    expect(remainingMs(clock({ now: 100, runningSince: 0 }), 'a')).toBe(44_900)
  })

  test('the inactive team: its bank as stored, whatever time has elapsed', () => {
    expect(remainingMs(clock({ now: 30_000, runningSince: 0 }), 'b')).toBe(45_000)
    expect(remainingMs(clock({ now: 30_000, runningSince: 0, active: 'b' }), 'a')).toBe(45_000)
  })

  test('stopped: the bank as stored, whatever the engine time', () => {
    expect(remainingMs(clock({ now: 30_000 }), 'a')).toBe(45_000)
  })

  test('a hand-built overdrawn clock reads +0, never negative', () => {
    // No action produces this state — a tick that reaches zero ends the round
    // in the same step — so the clamp is exercised by hand.
    expect(Object.is(remainingMs(clock({ now: 50_000, runningSince: 0 }), 'a'), 0)).toBe(true)
  })
})

describe('REQ-3.4, REQ-3.7: the internal clock transitions', () => {
  test.for([
    ['a', { a: true, b: false }],
    ['b', { a: false, b: true }],
  ] as const)(
    'startClock(now, %s, full): both banks full, only that team started, running from now',
    ([team, started]) => {
      expect(startClock(1_234, team, 20_000)).toStrictEqual({
        now: 1_234,
        active: team,
        runningSince: 1_234,
        banks: { a: { ms: 20_000, started: started.a }, b: { ms: 20_000, started: started.b } },
      })
    },
  )

  // Team `b` active, so a transition that wrote to `a` by mistake shows here.
  const running = clock({
    now: 1_300,
    active: 'b',
    runningSince: 300,
    banks: { a: { ms: 45_000, started: true }, b: { ms: 30_000, started: true } },
  })

  test('settleActive: the active bank settled to its remaining time; runningSince unchanged', () => {
    expect(settleActive(running)).toStrictEqual({
      ...running,
      banks: { a: { ms: 45_000, started: true }, b: { ms: 29_000, started: true } },
    })
  })

  test('stopClock: settled, then runningSince null', () => {
    expect(stopClock(running)).toStrictEqual({
      ...running,
      runningSince: null,
      banks: { a: { ms: 45_000, started: true }, b: { ms: 29_000, started: true } },
    })
  })

  test('zeroActive: the active bank at exactly 0 and stopped; the other bank untouched', () => {
    expect(zeroActive(running)).toStrictEqual({
      ...running,
      runningSince: null,
      banks: { a: { ms: 45_000, started: true }, b: { ms: 0, started: true } },
    })
  })
})
