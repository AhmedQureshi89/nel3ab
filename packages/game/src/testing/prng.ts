// Test support (Phase 3) — the seeded generator behind every sample. REQ-3.3, REQ-3.11.
// See specs/phase-3/specs.md §2.8.
//
// mulberry32, EXACTLY as specs.md §2.8 gives it: the verdict's sample and the
// per-length samples are pre-registered by their seeds (verification.md
// Tables B and C), so a change to one operator here changes every sequence
// and every number measured against them.
//
// Test support: excluded from coverage (REQ-3.12's second exclusion), never
// exported from index.ts, imported only by `*.test.ts` and by other files
// under `testing/`.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
