import './globals.css'

// REQ-1.4 — the RTL root. Both attributes are required: `dir="rtl"` without
// `lang="ar"` breaks font fallback and hyphenation, `lang="ar"` without
// `dir="rtl"` leaves the layout LTR (specs/phase-1/specs.md §2.10,
// mission.md §3). Verified on rendered output, not on this file.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
