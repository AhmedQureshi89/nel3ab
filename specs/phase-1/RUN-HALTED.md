# Run halted — 2026-08-18

**Reason:** REQ-1.10 and REQ-1.11 cannot both be satisfied on this account's GitHub
plan. This is not a bug in our config and not a token-scope problem — it is a conflict
between two requirements of the phase, and resolving it is a spending/product decision
that belongs to the user.

**At:** REQ-1.11 — `main` protected against direct pushes, with CI required to merge
(Gate 5, boxes 4–6)

## Measured

Both protection mechanisms are refused at the endpoint level for a **private** repo on
this account:

```
PUT /repos/AhmedQureshi89/nel3ab/branches/main/protection
{"message":"Upgrade to GitHub Pro or make this repository public to enable this
  feature.", "status":"403"}

POST /repos/AhmedQureshi89/nel3ab/rulesets
{"message":"Upgrade to GitHub Pro or make this repository public to enable this
  feature.", "status":"403"}
```

Proven to be a **plan limitation, not a scope limitation**:

- The same token performed an admin-only write on this same private repo:
  `PATCH /repos/AhmedQureshi89/nel3ab` succeeded and returned
  `permissions: {"admin": true, ...}`. (A description was set as the probe and
  reverted; `description` is `null` again.)
- Clean A/B on the same token and the same endpoint:
  `GET /repos/AhmedQureshi89/openclaw/rulesets` (a **public** repo of the same
  account) → **HTTP 200 `[]`**. Private → **403**.
- `X-Oauth-Scopes: gist, read:org, repo, workflow`. `gh api user` → `plan: null`
  (Free).
- The 403 is payload-independent: a minimal classic payload (`enforce_admins` +
  `required_pull_request_reviews`) and a full ruleset with `bypass_actors: []` both
  returned the identical error.

**The three REQ-1.11 boxes remain unticked.** `main` reports `protected: false`. The
push-rejection probe was deliberately **not** run — with no protection in place it
would have succeeded, adding a junk commit and proving nothing. Owner-admin status is
confirmed (`{"admin":true,"maintain":true,"push":true,"triage":true,"pull":true}`,
login `AhmedQureshi89`); the missing half is the protection, not the identity.

## What did land this session

`.github/workflows/ci.yml` — commit `9f972fb`, pushed directly to `main` while it was
still legitimately unprotected, per the sequencing the user chose.

- Run <https://github.com/AhmedQureshi89/nel3ab/actions/runs/32140653299> —
  **conclusion `success`**, 1m 8s, **first attempt**.
- lint → typecheck → test → build, in that order, on `ubuntu-latest` / Node 24 /
  `--frozen-lockfile`.
- Check name verified by query rather than assumption, and byte-compared: job id in
  `ci.yml` = `ci` (hex `6369`, len 2); check name GitHub reported = `ci` (hex `6369`,
  len 2) — identical.
- **A trap worth recording:** the *workflow* `name:` is `CI` (uppercase) while the
  *check* name is `ci` (lowercase, the job id). Requiring `CI` would have configured a
  check that never reports — the silent un-protection `specs.md` §2.15 warns about.

REQ-1.12's Gate 6 boxes were **not** ticked; this is their evidence, not their
verification.

**R7 and R8 did not materialise.** No case-sensitivity failure, no pinned-version
conflict. CI passed on Ubuntu on the first run with no pin loosened, no override, no
escape hatch. Gate 7 territory was not entered.

## Completed this run

Gates 1–4 complete, plus REQ-1.10. 29 of 38 boxes, 12 commits.

- REQ-1.2 `80ba4b9` · REQ-1.5 `b403895` · REQ-1.6 `204180b` · REQ-1.1/NFR-4 `462a2a7`
- NFR-5 `a888479` · REQ-1.7 `08217fd` · REQ-1.8/1.9 `56695b1` · REQ-1.4 `9b39a1f`
- REQ-1.13 `27e2b77` · REQ-1.10 `9bd2812` · ci.yml `9f972fb`

## Still unchecked

- **Gate 5:** REQ-1.11 ×3 — blocked on the decision below.
- **Gate 6:** REQ-1.12 ×2, NFR-1, NFR-3, REQ-1.6/R3 ×1. Partly evidenced already (CI
  is green on `main`), but "Green on a PR… and the merge button is blocked until it
  is" cannot be demonstrated without protection.
- **Gate 7:** 🚦 verdict gate — not reached.

## What the user needs to decide

The phase requires the repository to be **private** (REQ-1.10, because
`mission.md` §4 sells the question bank) *and* `main` to be **protected with no owner
bypass** (REQ-1.11, because `mission.md` §5.4's human-verification gate for question
accuracy is a pull request). GitHub Free grants branch protection on public
repositories only. Any two of {free, private, protected} are available; not all three.

Three ways out, none of which the runner may choose on its own:

1. **Upgrade to GitHub Pro** (~$4/month). Satisfies both requirements exactly as
   written; REQ-1.11 can then be completed unchanged. It is the only option that
   preserves both pillars.
2. **Make the repository public.** Free, and protection becomes available immediately —
   but it contradicts REQ-1.10's rationale directly, publishing the commercial asset.
3. **Amend the phase** to defer protection, recording the consequence: `mission.md`
   §5.4's "every question… human-verified before it merges — no exceptions" would rest
   on discipline rather than enforcement, which is the specific hole REQ-1.11 exists to
   close. Amending is a planning act (`/spec-phase`), not something this run may do.

A local `pre-push` hook is **not** a fourth option. It is client-side and `--no-verify`
defeats it — decorative protection of exactly the kind `verification.md` §10 calls
indistinguishable, in every log and settings page, from the real thing.
