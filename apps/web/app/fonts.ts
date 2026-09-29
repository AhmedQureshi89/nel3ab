import localFont from 'next/font/local'

// REQ-2.3 — both families self-hosted from this origin. See
// specs/phase-2/specs.md §2.2, and fonts/README.md for provenance and licence.
//
// tech-specs.md §2.1: the Google Fonts CDN is not used in production. The
// prototypes `<link>` it; that is a prototype affordance, not a design value.
//
// The CSS variables are `--font-baloo` / `--font-archivo`, NOT `--font` /
// `--font-en`: those two are reference tokens owned by
// @nel3ab/ui's tokens.css (REQ-2.4), which defines them as
// `var(--font-baloo, 'Baloo Bhaijaan 2'), …`. The app supplies only the resolved
// family; the token layer stays a faithful port of design/arcade-tokens.css.
//
// next/font/local is a Next-only loader, rewritten by Next's compiler at build
// time. It is called here, at module scope, once — never from packages/ui, which
// tsc --build and Vitest also consume and neither can resolve it.
// `display: 'swap'` matches the prototypes' `&display=swap`.

// One variable file, wght 400–800, covering the 500/600/700/800 REQ-2.3 needs.
// The declared range is the file's real axis range, so the @font-face does not
// claim weights the file cannot draw.
export const baloo = localFont({
  src: [{ path: './fonts/BalooBhaijaan2-Variable.woff2', weight: '400 800', style: 'normal' }],
  variable: '--font-baloo',
  display: 'swap',
  preload: true,
})

// Two static files, not the variable one — owner's ruling of 2026-09-29,
// recorded in fonts/README.md (upstream's variable Archivo is `.ttf`-only and
// carries an unused `wdth` axis; the statics are committed unmodified).
export const archivo = localFont({
  src: [
    { path: './fonts/Archivo-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: './fonts/Archivo-ExtraBold.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-archivo',
  display: 'swap',
  preload: true,
})
