# Run halted — 2026-08-18

**Reason:** A requirement requires a human decision the runner cannot make. Gate 5's
first check is a deliberate stop, not a formality — it forbids `gh repo create` from
running until the active GitHub account is confirmed to be the personal one, and that
confirmation is not derivable from anything on this machine.

**At:** REQ-1.10 — Private GitHub repo under the personal account (Gate 5, first box)

**Measured:**

- `gh auth status` → `Logged in to github.com account **AhmedQureshi89** (keyring)`,
  active account: true. Token scopes: `gist`, `read:org`, `repo`, `workflow`.
- `gh api user` → `login: AhmedQureshi89`, `id: 107462777`, `name: "Ahmed Quereshi"`,
  `company: "Chartex"`, `location: "Riyadh"`, **`email: null`**,
  `notification_email: null`, `bio: "Backend engineer and founder of eQalam, Chartex,
  Nawat, Tadawulcom, co-founder of Warshah App."`
- `gh api user/emails` → **HTTP 404**, `This API operation needs the "user" scope`.
  The token cannot read the account's addresses, so the identity **cannot be
  confirmed offline**. This is the exact condition `specs.md` §2.16 and risk R4
  flagged before implementation began.
- Local commit authorship is clean: `git log --format='%an <%ae>'` → **15 commits,
  all `Ahmed <a.alshareef.89@gmail.com>`**, a single address. `git config user.email`
  is `a.alshareef.89@gmail.com`.
- `git remote -v` → **empty**. No remote exists; nothing has been pushed anywhere.

**Nothing was created.** No `gh repo create` was run, no remote added, no push
attempted. No box in Gate 5 is ticked.

## Completed this run

Gates 1–4 are fully ticked. 26 of 38 boxes; 8 requirements, 8 commits, one per
requirement.

- REQ-1.2 — strict declared once, all six projects typecheck, 6/6 `.tsbuildinfo`;
  TypeScript pinned to 5.9.3 rather than latest 7.0.2 to avoid a peer escape hatch
  (commit `80ba4b9`)
- REQ-1.5 — package shells carry no rules-engine logic; 14 declared dependency
  entries, no premature ones (commit `b403895`)
- REQ-1.6 — `pnpm test` collects 6/6 projects, 7 assertions, and fails when one
  project drops out (commit `204180b`)
- REQ-1.1 / NFR-4 — lockfile committed and in sync, `packageManager` exact, zero
  `^`/`~` across all seven manifests (commit `462a2a7`)
- NFR-5 — no secrets; grep proven capable of firing, 50 tracked files scanned
  (commit `a888479`)
- REQ-1.7 — ESLint resolves 17 files across all six projects, Prettier owns 33; both
  proven able to fail (commit `08217fd`)
- REQ-1.8 / REQ-1.9 — the RTL guardrail was watched failing twice, on two different
  rules in two different packages, with the error output recorded verbatim
  (commit `56695b1`)
- REQ-1.4 — `<html lang="ar" dir="rtl">` confirmed over HTTP from a real `next start`
  (200, 4307 bytes); both attributes removal-tested separately; risk R6 materialised
  and was survived without the fallback (commit `9b39a1f`)
- REQ-1.13 — `design/` tree hash byte-identical at `ca16ff5` and `HEAD`
  (commit `27e2b77`)

## Still unchecked

**Gate 5 — remote and branch protection (blocked on the decision below)**
- REQ-1.10 (Account confirmed before creation) ← halted here
- REQ-1.10 (Private), REQ-1.10 (Authorship)
- REQ-1.11 (Direct push rejected), REQ-1.11 (Owner cannot bypass),
  REQ-1.11 (CI required by name)

**Gate 6 — the full gate, green from a fresh clone in CI** (blocked by Gate 5; needs
a remote to exist)
- REQ-1.12 (Four commands in CI), REQ-1.12 (Green on a PR)
- NFR-1 (Fresh clone, locally), NFR-3 (Offline)
- REQ-1.6 / R3 (Build produces artifacts)

**Gate 7 — 🚦 stack compatibility (verdict gate)** — not reached. It is evaluated only
after Gate 6, and requires CI on Ubuntu to have run.

## What the user needs to decide

**The blocking decision:** whether `AhmedQureshi89` is the personal account that
REQ-1.10 requires. The evidence is genuinely ambiguous rather than merely unverified —
the profile's display name is "Ahmed Quereshi" (a different spelling from the
`Ahmed Alshehri` on the specs), its `company` field reads `Chartex`, and its bio names
Tadawulcom, the work context `requirements.md` §2.4 explicitly says this product does
not belong to. Against that, it is the only account authenticated on this machine and
the local git identity is uniformly `a.alshareef.89@gmail.com`. The token lacks the
`user` scope, so no command available here can settle it. `specs.md` §4 R4 states the
remedy if it turns out wrong is to delete and recreate rather than transfer, which is
cheap now and awkward once the question bank — the asset `mission.md` §4 sells — is
sitting in it. Either confirm the account, or re-authenticate with the intended one
(`gh auth login`, or `gh auth refresh -h github.com -s user` to make the address
readable), before any repo is created.

**Four secondary items, all recorded in `verification.md`, none acted on.** Each is a
gate command found to be narrower than its wording. They do not block the run, but
three of them describe checks that would have reported clean regardless of the code,
and fixing a gate is a planning act:

1. `packages/*/src` as a git pathspec matches **zero files** — a wildcard is matched
   against the whole path. Affects the REQ-1.5 gate text and `verification.md` §8.
2. `vitest run --dir does-not-exist` **exits 0 with all six files passing**, because
   each project's own `root` overrides the run-level `--dir`. Affects §8's empty-run
   probe.
3. NFR-5's `connection ?string` misses the underscore form and would not catch a
   leaked `WEBPUBSUB_CONNECTION_STRING`.
4. `git diff ca16ff5..HEAD -- design/` compares commits and is blind to uncommitted
   working-tree edits, so an uncommitted "improvement" to the handoff would pass it.

**One wording conflict that must be settled before Gate 7 is evaluated, not after.**
Gate 7's verdict text names **"ESLint 9"**, but `specs.md` §2.12 says "ESLint 9+" and
**10.8.1** is what is installed and passing. A verdict gate cannot be retried, so the
question of whether ESLint 10 satisfies the pinned stack needs an answer while it is
still a planning question.

**Two unratified deviations from `specs.md`:**

- `.prettierignore` covers `specs/`, which §2.13 does not authorise. Without it,
  Prettier reflows 799 lines of the read-only spec triad and mis-pads the Arabic
  table cells.
- `pnpm test` is a Node wrapper (`scripts/check-collected-tests.mjs`) rather than
  §2.3's bare `vitest run`. This was forced by measurement: `passWithNoTests: false`
  does **not** fail when a single project stops being collected, only when the whole
  run collects nothing. §2.9 explicitly authorises a Node script over the JSON output,
  so this follows the spec's intent while departing from §2.3's sketch.
