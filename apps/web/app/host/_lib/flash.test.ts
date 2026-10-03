import { afterEach, beforeEach, describe, expect, expectTypeOf, test, vi } from 'vitest'

import { createFlash, FLASH_MS } from './flash'
import type { FlashTimers } from './flash'

// REQ-5.21 — specs/phase-5/verification.md Gate 4, "Share and flash", Table T9: the 1800 ms flash
// and its restart. See specs.md §2.9 (`flash.ts`) and §2.12 (this file's row).
//
// The countdown runs under Vitest's fake timers through the flash's DEFAULT timers, `globalThis`,
// so what is tested is what the page runs. `onChange` records every value it is given; "the
// label is set" at a time means the last value reported by then is the label.

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/** A flash on the default timers, and every value it has reported, in order. */
const recorded = () => {
  const reports: (string | null)[] = []
  const flash = createFlash((label) => {
    reports.push(label)
  })
  /** The value showing now: the last one reported, or null before any. */
  const showing = (): string | null => (reports.length === 0 ? null : (reports.at(-1) ?? null))
  return { flash, reports, showing }
}

describe('REQ-5.21: Table T9 — the flash', () => {
  test('FLASH_MS is 1800', () => {
    expect(FLASH_MS).toBe(1800)
  })

  test('a single show: set at 0, still set at 1,799, null at 1,800', () => {
    const { flash, reports, showing } = recorded()
    flash.show('نُسخ الرابط ✔')
    expect(showing()).toBe('نُسخ الرابط ✔')
    vi.advanceTimersByTime(1_799)
    expect(showing()).toBe('نُسخ الرابط ✔')
    vi.advanceTimersByTime(1)
    expect(showing()).toBeNull()
    expect(reports).toStrictEqual(['نُسخ الرابط ✔', null])
    // Nothing further.
    vi.advanceTimersByTime(10_000)
    expect(reports).toStrictEqual(['نُسخ الرابط ✔', null])
    expect(vi.getTimerCount()).toBe(0)
  })

  test('show at 0, show again at 1,000: set at 0, still set at 2,799, null at 2,800', () => {
    const { flash, reports, showing } = recorded()
    flash.show('تمت المشاركة ✔')
    expect(showing()).toBe('تمت المشاركة ✔')
    vi.advanceTimersByTime(1_000)
    flash.show('تمت المشاركة ✔')
    // The first countdown, which would have ended at 1,800, is gone.
    vi.advanceTimersByTime(800)
    expect(showing()).toBe('تمت المشاركة ✔')
    vi.advanceTimersByTime(999)
    // 2,799.
    expect(showing()).toBe('تمت المشاركة ✔')
    expect(reports).toStrictEqual(['تمت المشاركة ✔', 'تمت المشاركة ✔'])
    vi.advanceTimersByTime(1)
    // 2,800.
    expect(showing()).toBeNull()
    expect(reports).toStrictEqual(['تمت المشاركة ✔', 'تمت المشاركة ✔', null])
    vi.advanceTimersByTime(10_000)
    expect(reports).toHaveLength(3)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('a second show with another label shows it at once, and the restart is from that press', () => {
    const { flash, reports } = recorded()
    flash.show('الكود: SKZJ62')
    vi.advanceTimersByTime(1_000)
    flash.show('نُسخ الرابط ✔')
    expect(reports).toStrictEqual(['الكود: SKZJ62', 'نُسخ الرابط ✔'])
    vi.advanceTimersByTime(1_799)
    expect(reports).toStrictEqual(['الكود: SKZJ62', 'نُسخ الرابط ✔'])
    vi.advanceTimersByTime(1)
    expect(reports).toStrictEqual(['الكود: SKZJ62', 'نُسخ الرابط ✔', null])
  })

  test('a show after the label has cleared starts a fresh 1,800 ms', () => {
    const { flash, reports } = recorded()
    flash.show('تمت المشاركة ✔')
    vi.advanceTimersByTime(5_000)
    flash.show('نُسخ الرابط ✔')
    vi.advanceTimersByTime(1_799)
    expect(reports).toStrictEqual(['تمت المشاركة ✔', null, 'نُسخ الرابط ✔'])
    vi.advanceTimersByTime(1)
    expect(reports).toStrictEqual(['تمت المشاركة ✔', null, 'نُسخ الرابط ✔', null])
  })

  test('dispose clears a pending countdown and reports nothing; with none pending it does nothing', () => {
    const { flash, reports } = recorded()
    flash.dispose()
    flash.show('تمت المشاركة ✔')
    expect(vi.getTimerCount()).toBe(1)
    flash.dispose()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(10_000)
    expect(reports).toStrictEqual(['تمت المشاركة ✔'])
    // Still usable afterwards.
    flash.show('نُسخ الرابط ✔')
    vi.advanceTimersByTime(1_800)
    expect(reports).toStrictEqual(['تمت المشاركة ✔', 'نُسخ الرابط ✔', null])
  })
})

describe('REQ-5.21: the flash on injected timers', () => {
  /** Fake timers whose handles count up from 0, recording every call. */
  const injected = () => {
    const calls: string[] = []
    const callbacks = new Map<unknown, () => void>()
    let next = 0
    const timers: FlashTimers = {
      setTimeout: (callback, ms) => {
        const handle = next
        next += 1
        calls.push(`set ${handle} ${ms}`)
        callbacks.set(handle, callback)
        return handle
      },
      clearTimeout: (handle) => {
        calls.push(`clear ${String(handle)}`)
        callbacks.delete(handle)
      },
    }
    return { calls, callbacks, timers }
  }

  test("the prototype's order — report, clear the pending one (handle 0 included), set 1800", () => {
    const { calls, callbacks, timers } = injected()
    const flash = createFlash((label) => {
      calls.push(`report ${String(label)}`)
    }, timers)
    flash.show('أ')
    flash.show('ب')
    expect(calls).toStrictEqual(['report أ', 'set 0 1800', 'report ب', 'clear 0', 'set 1 1800'])
    // The pending countdown fires: it reports null and is no longer pending.
    callbacks.get(1)?.()
    flash.dispose()
    expect(calls.slice(5)).toStrictEqual(['report null'])
    // dispose with one pending clears that one.
    flash.show('ج')
    flash.dispose()
    expect(calls.slice(6)).toStrictEqual(['report ج', 'set 2 1800', 'clear 2'])
  })

  test('the default timers are globalThis (a type test, checked by pnpm typecheck)', () => {
    expectTypeOf<typeof globalThis>().toExtend<FlashTimers>()
  })
})
