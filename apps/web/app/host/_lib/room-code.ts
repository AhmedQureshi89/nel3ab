// TEMPORARY — a placeholder until Phase 11, whose server generates room codes.
//
// REQ-5.10 — specs/phase-5/specs.md §2.9, `room-code.ts`. The room code `/host` shows on
// room-ready: six characters, each one of `A`–`Z` and `0`–`9`, made once per page load from the
// driver's random source (`Math.random` in the page) and kept for the life of the page — across
// room-ready → setup → room-ready included (requirements.md, reading 8; H-04, "الرجوع للإعداد دون
// فقدان الغرفة"). The engine never generated codes (Phase 3: "Phase 11 generates codes"), so the
// stand-in lives here, beside the driver that calls it.
//
// The random source is a parameter, as the engine's draw helpers take theirs: the same values
// always give the same code, in a test and in the page alike (verification.md Table T6).
//
// Framework-free: no React import (specs.md §1).

import type { Random } from '@nel3ab/game'

/** The characters a room code is made of: the 26 capital Latin letters, then the ten digits. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** A room code's length, in characters. */
export const ROOM_CODE_LENGTH = 6

/**
 * A room code: `ROOM_CODE_LENGTH` characters, each `ROOM_CODE_ALPHABET[floor(r × 36)]` for one
 * call `r = random()` — exactly six calls.
 *
 * ONE guard covers every bad value, as the engine's `drawCategory` does: a value of 1 or more,
 * below 0, `NaN` or infinite puts the index outside the alphabet, so the character looked up is
 * `undefined`, and a `RangeError` names the value and the character it was drawn for.
 */
export function makeRoomCode(random: Random): string {
  let code = ''
  for (let k = 1; k <= ROOM_CODE_LENGTH; k += 1) {
    const r = random()
    const character = ROOM_CODE_ALPHABET[Math.floor(r * ROOM_CODE_ALPHABET.length)]
    if (character === undefined) {
      throw new RangeError(
        `makeRoomCode needs every random value in [0, 1); got ${r} for character ${k} of ${ROOM_CODE_LENGTH}`,
      )
    }
    code += character
  }
  return code
}
