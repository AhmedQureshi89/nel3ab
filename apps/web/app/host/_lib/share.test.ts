import { describe, expect, expectTypeOf, test, vi } from 'vitest'

import { SHARE_URL_BASE, shareRoom } from './share'
import type { ShareTarget } from './share'

// REQ-5.21 — specs/phase-5/verification.md Gate 4, "Share and flash", Table T8: the seven paths of
// `shareRoom('SKZJ62', …)`. See specs.md §2.9 (`share.ts`) and §2.12 (this file's row).
//
// Every target is a fake built from `vi.fn`s, so each path records what it called: the share
// sheet's payload, whether the clipboard was touched, and with what. The strings below are the
// prototype's; `host-prototype.test.ts` reads them from the prototype at run time (W5).

const CODE = 'SKZJ62'
const LINK = 'https://nel3ab.game/j/SKZJ62'
const PAYLOAD = { title: 'نلعب', text: 'انضم لغرفتنا بالكود SKZJ62', url: LINK }

const SHARED = 'تمت المشاركة ✔'
const COPIED = 'نُسخ الرابط ✔'
const RAW = 'الكود: SKZJ62'

/** A share sheet that settles as given. */
const sheet = (settle: () => Promise<void>) =>
  vi.fn((data: { title: string; text: string; url: string }) => {
    void data
    return settle()
  })

/** A clipboard whose `writeText` settles as given. */
const clipboard = (settle: () => Promise<void>) => ({
  writeText: vi.fn((text: string) => {
    void text
    return settle()
  }),
})

const resolves = () => Promise.resolve()
const rejects = (reason: unknown) => () => Promise.reject(reason)

/** The error a browser's share sheet rejects with when the host dismisses it. */
const dismissal = () => new DOMException('Share canceled', 'AbortError')

describe('REQ-5.21: Table T8 — the seven paths of shareRoom', () => {
  test('1 · share resolves → "تمت المشاركة ✔", share called once with the payload, clipboard untouched', async () => {
    const share = sheet(resolves)
    const board = clipboard(resolves)
    await expect(shareRoom(CODE, { share, clipboard: board })).resolves.toBe(SHARED)
    expect(share).toHaveBeenCalledTimes(1)
    expect(share).toHaveBeenCalledWith(PAYLOAD)
    // Exactly the three fields — nothing more leaves the page (NFR-5.7).
    expect(share.mock.calls[0]?.[0]).toStrictEqual(PAYLOAD)
    expect(board.writeText).not.toHaveBeenCalled()
  })

  test('2 · share rejects AbortError → null, clipboard untouched', async () => {
    const share = sheet(rejects(dismissal()))
    const board = clipboard(resolves)
    await expect(shareRoom(CODE, { share, clipboard: board })).resolves.toBeNull()
    expect(share).toHaveBeenCalledTimes(1)
    expect(board.writeText).not.toHaveBeenCalled()
  })

  test('3 · share rejects another error → the link written to the clipboard → "نُسخ الرابط ✔"', async () => {
    const share = sheet(rejects(new DOMException('Permission denied', 'NotAllowedError')))
    const board = clipboard(resolves)
    await expect(shareRoom(CODE, { share, clipboard: board })).resolves.toBe(COPIED)
    expect(share).toHaveBeenCalledTimes(1)
    expect(board.writeText).toHaveBeenCalledTimes(1)
    expect(board.writeText).toHaveBeenCalledWith(LINK)
  })

  test('4 · share rejects undefined → the same: the link copied → "نُسخ الرابط ✔"', async () => {
    const share = sheet(rejects(undefined))
    const board = clipboard(resolves)
    await expect(shareRoom(CODE, { share, clipboard: board })).resolves.toBe(COPIED)
    expect(board.writeText).toHaveBeenCalledTimes(1)
    expect(board.writeText).toHaveBeenCalledWith(LINK)
  })

  test('5 · no share, clipboard resolves → "نُسخ الرابط ✔"', async () => {
    const board = clipboard(resolves)
    await expect(shareRoom(CODE, { clipboard: board })).resolves.toBe(COPIED)
    expect(board.writeText).toHaveBeenCalledTimes(1)
    expect(board.writeText).toHaveBeenCalledWith(LINK)
  })

  test('6 · no share, clipboard rejects → "الكود: SKZJ62"', async () => {
    const board = clipboard(rejects(new DOMException('Write denied', 'NotAllowedError')))
    await expect(shareRoom(CODE, { clipboard: board })).resolves.toBe(RAW)
    expect(board.writeText).toHaveBeenCalledTimes(1)
    expect(board.writeText).toHaveBeenCalledWith(LINK)
  })

  test('7 · neither → "الكود: SKZJ62"', async () => {
    await expect(shareRoom(CODE, {})).resolves.toBe(RAW)
  })
})

describe('REQ-5.21: the fallbacks between the seven paths', () => {
  test('what counts as the host dismissing the sheet: an object named AbortError, and nothing else', async () => {
    const dismissed = [
      dismissal(),
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
      // The prototype reads `e.name` from whatever it is given.
      { name: 'AbortError' },
    ]
    for (const reason of dismissed) {
      const board = clipboard(resolves)
      await expect(
        shareRoom(CODE, { share: sheet(rejects(reason)), clipboard: board }),
      ).resolves.toBeNull()
      expect(board.writeText).not.toHaveBeenCalled()
    }

    const failures = [
      undefined,
      null,
      0,
      '',
      'AbortError',
      new Error('AbortError'),
      new TypeError('Failed to execute share'),
      new DOMException('Permission denied', 'NotAllowedError'),
      { name: 'abortError' },
      {},
    ]
    for (const reason of failures) {
      const board = clipboard(resolves)
      await expect(
        shareRoom(CODE, { share: sheet(rejects(reason)), clipboard: board }),
      ).resolves.toBe(COPIED)
      expect(board.writeText).toHaveBeenCalledWith(LINK)
    }
  })

  test('share fails and the clipboard fails, or is absent, or has no writeText → the raw code', async () => {
    const failed = () => sheet(rejects(new TypeError('no sheet')))
    const board = clipboard(rejects(new Error('denied')))
    await expect(shareRoom(CODE, { share: failed(), clipboard: board })).resolves.toBe(RAW)
    expect(board.writeText).toHaveBeenCalledWith(LINK)
    await expect(shareRoom(CODE, { share: failed() })).resolves.toBe(RAW)
    await expect(shareRoom(CODE, { share: failed(), clipboard: {} })).resolves.toBe(RAW)
    await expect(shareRoom(CODE, { clipboard: {} })).resolves.toBe(RAW)
  })

  test('both methods are called on their own object, as navigator requires', async () => {
    const receivers: unknown[] = []
    const board = {
      writeText(this: unknown, text: string): Promise<void> {
        void text
        receivers.push(this)
        return Promise.resolve()
      },
    }
    const target = {
      share(this: unknown, data: { title: string; text: string; url: string }): Promise<void> {
        void data
        receivers.push(this)
        return Promise.reject(new Error('no sheet'))
      },
      clipboard: board,
    }
    await expect(shareRoom(CODE, target)).resolves.toBe(COPIED)
    expect(receivers).toHaveLength(2)
    expect(receivers[0]).toBe(target)
    expect(receivers[1]).toBe(board)
  })

  test('a synchronous throw is a rejection: shareRoom always resolves', async () => {
    const throwingSheet = (error: unknown) =>
      vi.fn((data: { title: string; text: string; url: string }): Promise<void> => {
        void data
        throw error
      })
    const throwingWrite = vi.fn((text: string): Promise<void> => {
      void text
      throw new Error('denied')
    })
    const board = clipboard(resolves)
    await expect(
      shareRoom(CODE, { share: throwingSheet(dismissal()), clipboard: board }),
    ).resolves.toBeNull()
    expect(board.writeText).not.toHaveBeenCalled()
    await expect(
      shareRoom(CODE, { share: throwingSheet(new TypeError('no')), clipboard: board }),
    ).resolves.toBe(COPIED)
    expect(board.writeText).toHaveBeenCalledWith(LINK)
    await expect(shareRoom(CODE, { clipboard: { writeText: throwingWrite } })).resolves.toBe(RAW)
    expect(throwingWrite).toHaveBeenCalledWith(LINK)
  })

  test('the link is SHARE_URL_BASE followed by the code, whatever the code', async () => {
    expect(SHARE_URL_BASE).toBe('https://nel3ab.game/j/')
    const share = sheet(resolves)
    await expect(shareRoom('AB12CD', { share })).resolves.toBe(SHARED)
    expect(share).toHaveBeenCalledWith({
      title: 'نلعب',
      text: 'انضم لغرفتنا بالكود AB12CD',
      url: 'https://nel3ab.game/j/AB12CD',
    })
    const board = clipboard(rejects(undefined))
    await expect(shareRoom('AB12CD', { clipboard: board })).resolves.toBe('الكود: AB12CD')
    expect(board.writeText).toHaveBeenCalledWith('https://nel3ab.game/j/AB12CD')
  })

  test("the page's navigator is a ShareTarget (a type test, checked by pnpm typecheck)", () => {
    expectTypeOf<Navigator>().toExtend<ShareTarget>()
  })
})
