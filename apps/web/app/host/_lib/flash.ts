// REQ-5.21 — specs/phase-5/specs.md §2.9, `flash.ts`. The share button's confirmation: a label
// shown for exactly `FLASH_MS`, then cleared — the prototype's `flash`, inside its `shareRoom`:
//
//   this.setState({shareMsg: label});
//   clearTimeout(this.copyId);
//   this.copyId = setTimeout(() => this.setState({shareMsg:''}), 1800);
//
// `show(label)` does the same three things in the same order: it reports the label, clears any
// timeout still pending, and sets one for `FLASH_MS` that reports `null`. So a second press while a
// label is showing restarts the 1800 ms from that press rather than ending at the first one's.
// `dispose()` clears a pending timeout without reporting anything.
//
// The timers are a parameter — `globalThis`'s in the page, fakes in a test — as the driver's are.
// The handle is boxed: a timer handle may be any value, `0` included. `host-prototype.test.ts`
// reads the prototype's 1800 at run time and asserts it is `FLASH_MS` (REQ-5.22, extraction W5).
//
// Framework-free: no React import (specs.md §1). `HostApp.tsx` holds one flash above the screens,
// with its state setter as `onChange`, so the label outlives a trip to setup as the prototype's does.

/** How long a share outcome stays on the button, in ms — the prototype's `setTimeout(…, 1800)`. */
export const FLASH_MS = 1800

/** The two timer functions a flash uses — `globalThis`'s in the page, fakes in a test. */
export interface FlashTimers {
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface Flash {
  /** Reports `label`, then (re)starts the `FLASH_MS` countdown that reports `null`. */
  show(label: string): void
  /** Clears the countdown if one is pending; reports nothing. */
  dispose(): void
}

/** A flash that reports each label to `onChange`, and `null` `FLASH_MS` after the latest `show`. */
export function createFlash(
  onChange: (label: string | null) => void,
  timers: FlashTimers = globalThis,
): Flash {
  /** The pending countdown's handle, boxed; `null` when none is pending. */
  let pending: { readonly handle: unknown } | null = null

  const clear = (): void => {
    if (pending === null) return
    timers.clearTimeout(pending.handle)
    pending = null
  }

  return {
    show: (label) => {
      onChange(label)
      clear()
      pending = {
        handle: timers.setTimeout(() => {
          pending = null
          onChange(null)
        }, FLASH_MS),
      }
    },

    dispose: clear,
  }
}
