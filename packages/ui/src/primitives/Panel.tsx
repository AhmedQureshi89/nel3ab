// REQ-2.9 — Panel. See specs/phase-2/specs.md §2.6.
//
// The standard card surface every screen is built on: 3px ink border, 20px
// radius, `0 4px 0` hard shadow, 14px padding — the values the prototypes use
// on every `border-radius: var(--r)` card. `raised` and `padded` are both on by
// default because that is the form the prototypes use almost everywhere.
//
// Each variant prop is emitted as a `data-*` attribute of the same name, and
// Panel.module.css keys its rules off those attributes. So the attribute a test
// asserts is the attribute the CSS reads, not a parallel description of it —
// and it survives the hashing of module class names (specs.md §2.6).
//
// No `"use client"`: Panel holds no state and no handlers of its own.

import type { ComponentPropsWithoutRef } from 'react'

import { cx } from './cx.js'
import styles from './Panel.module.css'

export type PanelProps = ComponentPropsWithoutRef<'div'> & {
  /** `0 4px 0` hard shadow. Default `true`; `false` is the flat form. */
  raised?: boolean
  /** `var(--pad-card)` (14px) padding. Default `true`. */
  padded?: boolean
}

export function Panel({ raised = true, padded = true, className, ...rest }: PanelProps) {
  return (
    <div
      className={cx(styles.panel, className)}
      data-raised={raised}
      data-padded={padded}
      {...rest}
    />
  )
}
