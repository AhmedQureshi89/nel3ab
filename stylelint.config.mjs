// REQ-1.8 / REQ-1.9 — THE RTL GUARDRAIL. See specs/phase-1/specs.md §2.14.
//
// mission.md §3 makes mirrored, Arabic-first layout a product pillar. ESLint
// cannot parse `.css`, so this file is the ONLY automated defence of it
// (requirements.md §2.3). A physical `left`/`right` that slips through is
// invisible until someone views a mirrored screen and the padding is on the
// wrong side.
//
// (a) Implemented with stylelint's CORE rules, not a logical-properties plugin.
//     A plugin would be more expressive, but this phase must not depend on a
//     package whose rule names and maintenance status cannot be verified
//     offline. `property-disallowed-list` and
//     `declaration-property-value-disallowed-list` ship with Stylelint and
//     cannot go stale. Swapping in a plugin later is a small reviewed change —
//     and REQ-1.9's negative tests already exist to prove the replacement fires.
//
// (b) The INLINE axis only. `top`, `bottom`, `margin-block-*`, `padding-block-*`
//     are unaffected by writing direction. Banning them produces false
//     positives, which trains people to add `stylelint-disable`, which is how a
//     guardrail dies. Do not "tighten" this into the block axis.
//
// The two rules below are the reason this file exists. `extends` may be
// narrowed or dropped if it proves noisy (risk R1); these two may not be
// disabled, narrowed or weakened.

export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['**/node_modules/**', 'design/**', '**/.next/**', '**/dist/**'],
  rules: {
    'property-disallowed-list': [
      [
        'left',
        'right',
        'margin-left',
        'margin-right',
        'padding-left',
        'padding-right',
        'border-left',
        'border-right',
        'border-left-width',
        'border-right-width',
        'border-left-color',
        'border-right-color',
        'border-left-style',
        'border-right-style',
        'border-top-left-radius',
        'border-top-right-radius',
        'border-bottom-left-radius',
        'border-bottom-right-radius',
      ],
      {
        message:
          'Use the logical equivalent (inset-inline-*, margin-inline-*, padding-inline-*, border-inline-*, border-start-start-radius…). Nel3ab is RTL-first — see mission.md §3.',
      },
    ],
    'declaration-property-value-disallowed-list': [
      {
        'text-align': ['/^left$/', '/^right$/'],
        float: ['/^left$/', '/^right$/'],
        clear: ['/^left$/', '/^right$/'],
      },
      {
        message:
          'Use start / end instead of left / right. Nel3ab is RTL-first — see mission.md §3.',
      },
    ],
  },
}
