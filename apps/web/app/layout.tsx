// REQ-2.3 / REQ-2.5 — specs/phase-2/specs.md §2.13. Import order is
// load-bearing: tokens, then base (which reads them), then the app's reset
// (which may override). Reordering changes the cascade.
import '@nel3ab/ui/tokens.css'
import '@nel3ab/ui/base.css'
import './globals.css'

import { archivo, baloo } from './fonts'

// REQ-1.4 — the RTL root. Both attributes are required: `dir="rtl"` without
// `lang="ar"` breaks font fallback and hyphenation, `lang="ar"` without
// `dir="rtl"` leaves the layout LTR (specs/phase-1/specs.md §2.10,
// mission.md §3). Verified on rendered output, not on this file.
//
// The class carries the two next/font CSS variables, which tokens.css's
// `--font` / `--font-en` resolve through. There is deliberately NO
// `data-theme` here: the 2026-08-20 decision (requirements.md REQ-2.5) is
// "follow the device", so with no attribute the cascade picks the palette
// from `prefers-color-scheme`.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${baloo.variable} ${archivo.variable}`}>
      <body>{children}</body>
    </html>
  )
}
