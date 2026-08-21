import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

import { PlumbingProbe } from './plumbing-probe.js'

// REQ-2.1, verification.md Gate 1. `renderToStaticMarkup` is the precedent
// already set by apps/web/rtl-root.test.ts — no jsdom, no @testing-library
// (specs/phase-2/specs.md §2.11).
//
// It asserts the `data-*` attribute, not the CSS-Module class name: module
// class names are hashed and their exact form is a build detail, not a
// contract (specs.md §2.6). Under Vitest's default `css: false` the import
// resolves to a proxy, so `styles.probe` has no stable value to assert — which
// is precisely risk R3, and why every variant in this phase is observable
// through data-* instead.
test('@nel3ab/ui renders a .tsx that imports a .module.css', () => {
  const markup = renderToStaticMarkup(<PlumbingProbe />)

  expect(markup).toContain('data-probe="ui-plumbing"')
})
