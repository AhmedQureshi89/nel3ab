// REQ-2.9 — Dot. See specs/phase-2/specs.md §2.6.
//
// One round won (or not yet won) in a first-to-N tally: 9px on the play
// screen, 11px on the round- and match-end screens.
//
// Rendered `aria-hidden="true"`. The win count is conveyed by the tally text
// beside the dots; six unlabelled circles are noise to a screen reader.

import type { ComponentPropsWithoutRef } from 'react'

import { cx } from './cx.js'
import styles from './Dot.module.css'

export type DotProps = ComponentPropsWithoutRef<'span'> & {
  /** `sm` (default) is 9px, `md` is 11px. */
  size?: 'sm' | 'md'
  /** Filled yellow. Default `false`. */
  won?: boolean
}

export function Dot({ size = 'sm', won = false, className, ...rest }: DotProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(styles.dot, className)}
      data-size={size}
      data-won={won}
      {...rest}
    />
  )
}
