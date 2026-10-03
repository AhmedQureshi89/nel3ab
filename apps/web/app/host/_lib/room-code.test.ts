import { afterEach, describe, expect, test, vi } from 'vitest'

import { createLocalRoom } from './driver'
import { makeRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './room-code'
import { seedRoom } from './seed'

// REQ-5.10 / REQ-5.11 — specs/phase-5/verification.md Gate 4, "Room code and default source":
// Table T6 and T7. See specs.md §2.9 (`room-code.ts`, `driver.ts`'s creation) and §2.12 (this
// file's row: length, alphabet, pinned values, the guard, the default source).
//
// T6 pins `makeRoomCode` against sources that always return one value; T7 shows that the room
// `/host` creates draws its code from `Math.random` — the page's source — and that nothing else
// calls it before the host's first draw: `startMatch()` and `nextRound()` on `setup` are no-ops
// that call no random source.

afterEach(() => {
  vi.restoreAllMocks()
})

/** A source that always returns `value`, counting its calls. */
const constant = (value: number) => vi.fn(() => value)

/** A source that returns `values` in turn, then `NaN`, counting its calls. */
const sequence = (values: readonly number[]) => {
  let next = 0
  return vi.fn(() => {
    const value = values[next] ?? Number.NaN
    next += 1
    return value
  })
}

describe('REQ-5.10: the room code', () => {
  test('the alphabet is A–Z then 0–9, 36 characters, and a code is 6 of them', () => {
    expect(ROOM_CODE_ALPHABET).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
    expect(ROOM_CODE_ALPHABET).toHaveLength(36)
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(36)
    expect(ROOM_CODE_LENGTH).toBe(6)
  })

  test('T6 — always 0, always 0.999, always 0.5: AAAAAA, 999999, SSSSSS, with 6 calls each', () => {
    const pinned = [
      [0, 'AAAAAA'],
      [0.999, '999999'],
      [0.5, 'SSSSSS'],
    ] as const
    for (const [value, code] of pinned) {
      const random = constant(value)
      expect(makeRoomCode(random)).toBe(code)
      expect(random).toHaveBeenCalledTimes(6)
    }
  })

  test('T6 — each character is ROOM_CODE_ALPHABET[floor(r × 36)], one call each, in call order', () => {
    // Every character is reachable: the middle of its 1/36 of [0, 1), and just below the next.
    for (let i = 0; i < 36; i += 1) {
      const character = ROOM_CODE_ALPHABET.charAt(i)
      expect(makeRoomCode(constant((i + 0.5) / 36))).toBe(character.repeat(6))
      expect(makeRoomCode(constant((i + 1) / 36 - 1e-9))).toBe(character.repeat(6))
    }
    // floor(r × 36) = 0, 1, 10, 25, 27, 35 → A, B, K, Z, 1, 9 — the first call is the first character.
    const random = sequence([0, 0.05, 0.3, 0.7, 0.75, 0.99])
    expect(makeRoomCode(random)).toBe('ABKZ19')
    expect(random).toHaveBeenCalledTimes(6)
  })

  test('T6 — a value of 1, −0.1 or NaN throws RangeError naming it', () => {
    for (const value of [1, -0.1, Number.NaN]) {
      expect(() => makeRoomCode(constant(value))).toThrow(RangeError)
      expect(() => makeRoomCode(constant(value))).toThrow(`got ${value} for character 1 of 6`)
    }
    // Infinite values reach the same guard; so does a bad value after good ones.
    expect(() => makeRoomCode(constant(Number.POSITIVE_INFINITY))).toThrow(RangeError)
    const late = sequence([0.5, 0.5, 0.5, 1, 0.5, 0.5])
    expect(() => makeRoomCode(late)).toThrow('got 1 for character 4 of 6')
    expect(late).toHaveBeenCalledTimes(4)
  })
})

describe('REQ-5.11: the default source', () => {
  test('T7 — createLocalRoom() calls Math.random 6 times at creation, for the code, and no timer', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const setInterval = vi.spyOn(globalThis, 'setInterval')
    const room = createLocalRoom()
    expect(random).toHaveBeenCalledTimes(6)
    expect(setInterval).toHaveBeenCalledTimes(0)
    // The code is the spy's — SSSSSS for 0.5 — and the room is otherwise the seed.
    expect(room.getState()).toStrictEqual(seedRoom('SSSSSS'))
  })

  test('T7 — startMatch() and nextRound() on setup call it 0 times, and change nothing', () => {
    const random = vi.spyOn(Math, 'random')
    const room = createLocalRoom()
    expect(random).toHaveBeenCalledTimes(6)
    const created = room.getState()
    expect(created.screen).toBe('setup')
    const listener = vi.fn()
    room.subscribe(listener)

    room.startMatch()
    room.nextRound()
    expect(random).toHaveBeenCalledTimes(6)
    expect(room.getState()).toBe(created)
    expect(listener).toHaveBeenCalledTimes(0)
  })

  test('the code is made once per room and kept across room-ready → setup → room-ready', () => {
    const random = vi.spyOn(Math, 'random')
    const room = createLocalRoom()
    const { roomCode } = room.getState()
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/)
    room.dispatch({ type: 'openRoom' })
    room.dispatch({ type: 'backToSetup' })
    room.dispatch({ type: 'openRoom' })
    expect(room.getState().screen).toBe('ready')
    expect(room.getState().roomCode).toBe(roomCode)
    expect(random).toHaveBeenCalledTimes(6)
  })
})
