// REQ-2.10 — Button. See specs/phase-2/specs.md §2.7 (and §2.5 for the press).
//
// Three variants that differ in more than colour — see Button.module.css for
// the measured table. The one difference that is structural rather than
// stylistic lives here: `primary` and `action` are raised controls and carry
// the shared press; `secondary` is the one control in the system that was
// never raised, so it has no rest shadow and no press travel. It is not a
// suppressed press.
//
// DEVIATION from specs.md §2.7, which writes the press as `composes: press from
// '../styles/press.module.css'` inside Button.module.css. Stylelint's
// `property-no-unknown` (stylelint-config-standard) rejects `composes`, and
// NFR-2.2 freezes stylelint.config.mjs at its Phase 1 bytes with no disable
// comments — so the same composition is done here instead, by adding
// press.module.css's own class to the element. There is still exactly one
// press rule; the variants only set --press-rest / --press-travel. Owner's
// ruling of 2026-09-29.
//
// `type="button"` is explicit so that a Button inside a future <form> (the join
// screen, Phase 13) does not submit it by accident; `...rest` can still
// override it. `disabled` sets both the native attribute and
// aria-disabled="true", so base.css's disabled rule and press.module.css's
// :not() guard apply whichever selector a consumer relies on.
//
// Phase 5 (specs/phase-5/specs.md §2.8, REQ-5.23): `size`, emitted as
// `data-size` on every Button. `lg`, the default, is Phase 2's 20px primary,
// unchanged; `md` is the prototypes' 19px primary CTA (room-ready's "ابدأ
// الجولة الأولى", Phase 7's two, Phase 13's "انضم"). A prop rather than a
// screen's override, because a screen class loses to the `[data-variant]`
// selector (specs/phase-5/specs.md §4, R5). It has no effect on `secondary`
// or `action`.

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import press from '../styles/press.module.css'
import styles from './Button.module.css'
import { cx } from './cx.js'

export type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  /** Default `primary`. */
  variant?: 'primary' | 'secondary' | 'action'
  /** The 11px line under an `action` label. Ignored by the other variants. */
  subLabel?: ReactNode
  /** Default `lg` (20px). `md` is the 19px primary. Ignored by the other variants. */
  size?: 'lg' | 'md'
}

export function Button({
  variant = 'primary',
  subLabel,
  size = 'lg',
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(styles.button, variant !== 'secondary' && press.press, className)}
      data-variant={variant}
      data-size={size}
      disabled={disabled}
      aria-disabled={disabled ? true : undefined}
      {...rest}
    >
      {children}
      {/* `<br>` + an inline span, exactly as the prototype writes it — NOT a
          block element, as specs.md §2.7 says. The second line then keeps
          the button's own 15.5px strut, which is what makes the prototype's
          action button 88.67px tall; a block sub-label only has its 11px
          line box and came out 80.67px (Gate 6, finding 2). Owner's ruling
          of 2026-09-30: the prototype wins (mission.md §5.3). */}
      {variant === 'action' && subLabel != null && (
        <>
          <br />
          <span className={styles['sub-label']}>{subLabel}</span>
        </>
      )}
    </button>
  )
}
