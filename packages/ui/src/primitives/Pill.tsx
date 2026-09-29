// REQ-2.9 — Pill. See specs/phase-2/specs.md §2.6.
//
// The prototype's player chip: 999px radius, 2.5px border, 13.5px/700, and an
// asymmetric inline padding that is this phase's most likely fidelity error —
// see Pill.module.css. `selected` adds the `0 3px 0` selection shadow.
//
// Presentational only. The chip's `↔` / `✕` controls are a screen's children,
// not this component's.

import type { ComponentPropsWithoutRef } from 'react'

import { cx } from './cx.js'
import styles from './Pill.module.css'

export type PillProps = ComponentPropsWithoutRef<'span'> & {
  /** Fill, with the text colour the prototype pairs with it. Default `panel`. */
  tone?: 'panel' | 'red' | 'sky' | 'yellow'
  /** `0 3px 0` selection shadow. Default `false`. */
  selected?: boolean
}

export function Pill({ tone = 'panel', selected = false, className, ...rest }: PillProps) {
  return (
    <span
      className={cx(styles.pill, className)}
      data-tone={tone}
      data-selected={selected}
      {...rest}
    />
  )
}
