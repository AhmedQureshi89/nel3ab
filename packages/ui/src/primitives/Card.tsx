// REQ-2.9 — Card. See specs/phase-2/specs.md §2.6.
//
// `md` is exactly a Panel. `lg` is the question-card *shell* only: 24px radius,
// the `0 6px 0` CTA shadow, `overflow: hidden`, and no padding, because its
// header strip and hint footer must reach the border. What goes inside it is
// Phase 6's, not this phase's.
//
// Card renders a Panel rather than restating its values, so the border, fill
// and raised/flat behaviour have one definition. Card.module.css only states
// how `lg` differs.

import type { ComponentPropsWithoutRef } from 'react'

import styles from './Card.module.css'
import { cx } from './cx.js'
import { Panel } from './Panel.js'

export type CardProps = ComponentPropsWithoutRef<'div'> & {
  /** `md` (default) is a Panel; `lg` is the question-card shell. */
  size?: 'md' | 'lg'
  /** Default `true`. `md` raised is `0 4px 0`; `lg` raised is `0 6px 0`. */
  raised?: boolean
  /** Default `true` for `md` and `false` for `lg`, whose contents reach the border. */
  padded?: boolean
}

export function Card({ size = 'md', raised = true, padded, className, ...rest }: CardProps) {
  return (
    <Panel
      className={cx(styles.card, className)}
      raised={raised}
      padded={padded ?? size === 'md'}
      data-size={size}
      {...rest}
    />
  )
}
