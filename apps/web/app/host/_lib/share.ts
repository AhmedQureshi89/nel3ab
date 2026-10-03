// REQ-5.21 — specs/phase-5/specs.md §2.9, `share.ts`. The prototype's `shareRoom`, framework-free:
// what pressing share on room-ready does, and the label the button flashes afterwards.
//
// The order is the prototype's (design/README.md, "Share"): first the operating system's share
// sheet (`navigator.share`) with the title, the text naming the code and the join link; if the
// sheet is unavailable, or fails for any reason other than the host dismissing it, the link is
// copied to the clipboard; if that is unavailable or fails, the raw code is shown. Dismissing the
// sheet (an `AbortError`) shows nothing and copies nothing — the result is `null`, and the screen
// flashes no label. Any other rejection, an `undefined` one included, falls through to the
// clipboard, as the prototype's `if(!e || e.name !== 'AbortError') copy()` does.
//
// `target` is navigator-shaped, and in the page it is `navigator` itself. Both methods are called
// on their own object (`target.share(…)`, `clipboard.writeText(…)`), never detached: a browser's
// `navigator.share` called without `navigator` as its receiver throws "Illegal invocation".
//
// The result is always a resolved promise. A synchronous throw from either method is treated as
// that method's rejection, so the screen's `.then` never meets an unhandled rejection.
//
// The only thing that leaves the page is this payload — the title, the text with the room code,
// and the link — handed to the share sheet or the clipboard (NFR-5.7). Nothing here touches the
// network. `host-prototype.test.ts` reads the prototype's strings at run time and asserts they
// are these (REQ-5.22, extraction W5).
//
// Framework-free: no React import (specs.md §1).

/** The join link's base: the link shared for room `code` is this followed by the code. */
export const SHARE_URL_BASE = 'https://nel3ab.game/j/'

/** The share sheet's title. */
const SHARE_TITLE = 'نلعب'

/** The share sheet's text, before the room code. */
const SHARE_TEXT = 'انضم لغرفتنا بالكود '

/** The label after the share sheet resolved. */
const SHARED_LABEL = 'تمت المشاركة ✔'

/** The label after the link was written to the clipboard. */
const COPIED_LABEL = 'نُسخ الرابط ✔'

/** The label when neither the sheet nor the clipboard could be used, before the room code. */
const CODE_LABEL = 'الكود: '

/** The name of the error a share sheet rejects with when the host dismisses it. */
const ABORT = 'AbortError'

/** What `shareRoom` needs of the page: `navigator`'s `share` and `clipboard.writeText`, either absent. */
export interface ShareTarget {
  readonly share?: (data: { title: string; text: string; url: string }) => Promise<void>
  readonly clipboard?: { readonly writeText?: (text: string) => Promise<void> }
}

/**
 * Whether a share sheet's rejection is the host dismissing it: an object whose `name` is
 * `'AbortError'` (a `DOMException` in a browser) — the prototype's `e && e.name === 'AbortError'`.
 * Anything else, `undefined` and `null` included, is a failure to fall back from.
 */
const isDismissal = (reason: unknown): boolean =>
  typeof reason === 'object' && reason !== null && 'name' in reason && reason.name === ABORT

/** The clipboard step: the link written → the copied label; else, or on failure, the raw code. */
async function copy(code: string, link: string, target: ShareTarget): Promise<string> {
  const clipboard = target.clipboard
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(link)
      return COPIED_LABEL
    } catch {
      return CODE_LABEL + code
    }
  }
  return CODE_LABEL + code
}

/** The label to flash, or null when the host dismissed the share sheet. */
export async function shareRoom(code: string, target: ShareTarget): Promise<string | null> {
  const link = SHARE_URL_BASE + code
  if (target.share) {
    try {
      await target.share({ title: SHARE_TITLE, text: SHARE_TEXT + code, url: link })
      return SHARED_LABEL
    } catch (reason) {
      if (isDismissal(reason)) return null
      return copy(code, link, target)
    }
  }
  return copy(code, link, target)
}
