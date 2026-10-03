import type { Metadata } from 'next'

import { HostApp } from './HostApp'

// REQ-5.15 — `/host`, the judge app. See specs/phase-5/specs.md §2.11, `page.tsx`.
//
// A server component: the page's title — the prototype's `<title>`, which
// `host-prototype.test.ts` reads at run time (REQ-5.22, extraction W9) — and the client
// component that holds the room (tech-specs.md §3.1: `/host`, client-rendered, no account).
export const metadata: Metadata = {
  title: 'نلعب — لعبة المعلومات',
}

export default function HostPage() {
  return <HostApp />
}
