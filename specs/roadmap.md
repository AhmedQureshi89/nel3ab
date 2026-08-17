# نلعب (Nel3ab) — Implementation Roadmap

> High-level implementation roadmap organized in small, **1-day** phases. Each phase is a self-contained unit of work with a hard exit criterion, sized to be finishable in a single working day.

---

## Roadmap Overview

```
FOUNDATIONS          REALTIME             PLAYER & RESILIENCE    MONEY              LAUNCH
1 ─ 2 ─ 3 ─ 4 ─ 5 ─ 6 ─ 7 ─► 8 ─ 9 ─ 10 ─ 11 ─ 12 ─► 13 ─ 14 ─ 15 ─ 16 ─► 17 ─ 18 ─ 19 ─ 20 ─► 21 ─ 22 ─ 23 ─ 24
                    ▲                     ▲                      ▲                  ▲
              playable offline      two real clients      party-proof          hosts can pay      public
```

| Phase | Name                                      | Duration | Status         |
|-------|-------------------------------------------|----------|----------------|
| 1     | Repo, toolchain & CI                      | 1 day    | 🔲 Not Started |
| 2     | Arcade design system                      | 1 day    | 🔲 Not Started |
| 3     | Rules engine — state & clock              | 1 day    | 🔲 Not Started |
| 4     | Rules engine — round & match flow          | 1 day    | 🔲 Not Started |
| 5     | Judge app — setup & room-ready            | 1 day    | 🔲 Not Started |
| 6     | Judge app — the play screen               | 1 day    | 🔲 Not Started |
| 7     | Judge app — round end & match end         | 1 day    | 🔲 Not Started |
| 8     | Content schema & pipeline                 | 1 day    | 🔲 Not Started |
| 9     | Azure foundation & first deploy           | 1 day    | 🔲 Not Started |
| 10    | Web PubSub transport spike                | 1 day    | 🔲 Not Started |
| 11    | Game server — rooms & protocol            | 1 day    | 🔲 Not Started |
| 12    | The redaction boundary                    | 1 day    | 🔲 Not Started |
| 13    | Player — join & lobby                     | 1 day    | 🔲 Not Started |
| 14    | Player — live & waiting                   | 1 day    | 🔲 Not Started |
| 15    | Reconnect & seat recovery                 | 1 day    | 🔲 Not Started |
| 16    | Clock reconciliation & judge disconnect    | 1 day    | 🔲 Not Started |
| 17    | Host authentication                       | 1 day    | 🔲 Not Started |
| 18    | Subscription request & receipt upload      | 1 day    | 🔲 Not Started |
| 19    | Admin approval panel                      | 1 day    | 🔲 Not Started |
| 20    | Entitlement enforcement                   | 1 day    | 🔲 Not Started |
| 21    | Landing page                              | 1 day    | 🔲 Not Started |
| 22    | Content expansion to launch depth         | 1 day+   | 🔲 Not Started |
| 23    | Hardening & observability                 | 1 day    | 🔲 Not Started |
| 24    | Launch preparation                        | 1 day    | 🔲 Not Started |

<!-- Status indicators: 🔲 Not Started · 🛠️ In Progress · ✅ Completed -->

---

## Completed Work

Nothing yet — this is a greenfield project as of 2026-08-17. No GitHub repository exists, so no issue/PR audit was possible; this roadmap is derived from the design handoff and the constitution interview rather than from shipped work.

---

## Milestone A — Foundations & a playable game (Phases 1–8)

The goal of this milestone is a **judge app you can hand to a friend and actually play**, running entirely on one device with no server. It front-loads the hardest risk: the game rules are fiddly and the prototype is their only specification.

### Phase 1: Repo, toolchain & CI

> **Goal:** A monorepo that builds, lints, tests and deploys nothing — correctly.

- [ ] Initialise pnpm workspace: `apps/web`, `apps/game`, `packages/{game,protocol,content,ui}` — question JSON lives at `packages/content/categories/`, not at the repo root
- [ ] TypeScript strict across all packages, shared `tsconfig.base.json`, project references
- [ ] Next.js 15 App Router scaffold in `apps/web` with `dir="rtl"` and `lang="ar"` on the root layout
- [ ] Vitest configured; one trivial passing test per package
- [ ] ESLint + Prettier across all packages
- [ ] Stylelint on all CSS / CSS Modules with a logical-properties rule — physical `left`/`right`/`margin-left`/`padding-right` fail lint wherever an inline-start/end equivalent exists. This is the RTL guardrail; ESLint cannot lint `.css`, so it cannot enforce it. `pnpm lint` runs ESLint and Stylelint together
- [ ] GitHub repo created — **private, under the personal account** (`a.alshareef.89@gmail.com`)
- [ ] `main` protected: no direct pushes, CI required to pass before merge. Use a ruleset if classic branch protection is unavailable on the plan
- [ ] CI running lint + typecheck + test + build on every PR
- [ ] `design/` handoff committed as the reference of record

**Exit criteria:** `pnpm build && pnpm typecheck && pnpm test && pnpm lint` passes clean from a fresh clone, and CI is green on a PR running the same four commands.

---

### Phase 2: Arcade design system

> **Goal:** The visual identity exists as reusable primitives before any screen is built on top of it.

- [ ] Port `arcade-tokens.css` into `packages/ui` as CSS custom properties — all tokens, both themes
- [ ] Theme switching via `data-theme` on the root; no flash of wrong theme on load
- [ ] Self-host Baloo Bhaijaan 2 (500/600/700/800) and Archivo (600/800) via `next/font/local`
- [ ] Primitives: `Panel`, `Button` (primary/secondary/action variants), `Pill`, `Dot`, `Card`
- [ ] Press behaviour as a shared mixin: `translateY` with the offset shadow shrinking by the same amount — never scale, never opacity
- [ ] Global states: `:focus-visible` 3px red outline, yellow `::selection`, disabled at `opacity .45`
- [ ] `.ltr-num` utility for direction-isolated Latin/numeric runs in Archivo
- [ ] A `/styleguide` dev route rendering every primitive in both themes side by side

**Exit criteria:** The styleguide renders every primitive in light and dark, and a button press visually matches the prototype exactly.

---

### Phase 3: Rules engine — state & clock

> **Goal:** The game's core maths, as pure functions with no UI and no network.

- [ ] Define `RoomState` in `packages/game` matching the handoff's state contract
- [ ] Pure reducer: `(state, action) => state`, no side effects, no timers inside
- [ ] Clock model: banks per team, `active`, `runningSince`; time advanced by an explicit `tick(ms)` action
- [ ] Spend actions: hint costs 2s, skip costs 3s; any spend reaching 0 ends the round immediately
- [ ] Reveal pauses the clock; all judge actions are no-ops while a reveal is up or the clock is stopped
- [ ] Display helper: `ceil(seconds)`, clamped at 0
- [ ] Unit tests covering every spend/boundary case, especially "spend exactly to zero"

**Exit criteria:** Full test coverage on clock and spend logic; a simulated 45-second round produces the same outcome as the prototype.

---

### Phase 4: Rules engine — round & match flow

> **Goal:** Rounds, matches, judges and categories all behave exactly as the prototype does.

- [ ] Category draw: random from selected-but-unused, falling back to the full selection when exhausted
- [ ] Question pool: shuffled per round, no repeats until the pool wraps
- [ ] Turn passing on `correct`: reveal → 1000ms hold → other team, whose bank starts full on their first turn
- [ ] Round win = the opponent's clock hit zero; tally, log entry, reason line
- [ ] Odd rounds start with team A, even rounds with team B
- [ ] Match ends at `winsNeeded` (default 3) or when categories run out
- [ ] Judge rotation on `nextRound` when "بدّل الحكم كل جولة" is on
- [ ] Tests for a full simulated match, and for the categories-exhausted edge case

**Exit criteria:** A scripted full match runs end to end in tests and produces a correct round log.

---

### Phase 5: Judge app — setup & room-ready

> **Goal:** The host can build a game, pixel-accurate to the prototype.

- [ ] Setup screen: teams card, editable team names with shuffle, player chips with swap/remove
- [ ] Judge card: judge selection, odd-count hint, "بدّل الحكم كل جولة" toggle
- [ ] Categories rail: horizontal snap-scroll bleeding to card edges, selected/locked states
- [ ] Guard: cannot start with zero categories selected
- [ ] Room-ready screen: room code in Archivo with `.2em` tracking, share button, in-room list
- [ ] Share: `navigator.share` → clipboard → raw code fallback; 1800ms leaf confirmation; ignore `AbortError`
- [ ] Remove the prototype's debug top bar entirely — it is not part of the product

**Exit criteria:** Setup and ready screens match the prototype in both themes; a designer's eye finds no spacing, radius or shadow deviation.

---

### Phase 6: Judge app — the play screen

> **Goal:** The single most important screen in the product.

- [ ] Two timer cards with active fill, win dots, status text, Archivo 22px clock
- [ ] Category pill + time-bank bar with `width` transitioning at `.1s linear`
- [ ] Question card: coloured header strip, 24px/800 body with `text-wrap: pretty`, hint footer strip
- [ ] Hint reveal with `slidein` 220ms; muted placeholder copy until a hint is spent
- [ ] Reveal overlay: leaf panel, `pop` 180ms, answer at 30px/800, auto-dismiss at 1000ms
- [ ] Judge-only answer box: 3px dashed red border, answer + accepted variants
- [ ] Action row: تخطي / تلميح / صحيح with sub-labels, disabled states, press behaviour
- [ ] Wire all three actions through the Phase 3–4 reducer

**Exit criteria:** A full round is playable on one device — clock runs, hints spend, skips advance, correct reveals and passes the turn.

---

### Phase 7: Judge app — round end & match end

> **Goal:** Phase 1's stated deliverable — a complete, playable, serverless judge app.

- [ ] Round-end screen: bobbing 🏆, winner line, reason line, two score cards, progress line
- [ ] "الجولة التالية" draws a fresh unused category and rotates the judge if enabled
- [ ] Match-end screen: bobbing 👑, winner, 34px Archivo tallies, round log panel
- [ ] "نفس الفرق — مباراة جديدة" resets scores without clearing players
- [ ] "غيّر اللاعبين والفئات" returns to setup with state intact
- [ ] Play a real match with real people and write down what broke

**Exit criteria:** ✅ **A full match — setup through match end — is playable on one phone.** Someone who has never seen the product can host it without instructions.

---

### Phase 8: Content schema & pipeline

> **Goal:** Questions become a reviewable, validated asset rather than a hardcoded array.

- [ ] Formalise the content schema in `packages/content`: `{name, emoji, desc, chips[], paid?, qs[{q,a,alts[],h[],f}]}`
- [ ] Migrate all 11 existing categories out of the prototype HTML into `packages/content/categories/*.json`
- [ ] Zod validation + a CI check: schema conformance, duplicate detection, minimum question count per category
- [ ] Resolve the locked-category discrepancy — the README says 2, the prototype has 3 (ثقافة، فن، أفلام)
- [ ] Write the authoring guide: what a good hint is (narrows without giving it away), what a good fact is, house voice
- [ ] Draft one category up to target depth as a template for the rest

**Exit criteria:** Content is loaded from JSON, CI rejects a malformed or duplicate question, and one category is at full depth.

---

## Milestone B — Realtime (Phases 9–12)

Two real devices, one room, and the answer never leaves the judge.

### Phase 9: Azure foundation & first deploy

> **Goal:** Infrastructure exists and something real is running in West Europe.

- [ ] Bicep (or Terraform) for: resource group, Container Registry, two Container Apps, Postgres Flexible Server, Blob Storage, Key Vault, Web PubSub
- [ ] Dockerfiles for `apps/web` and `apps/game`
- [ ] GitHub Actions: build → push to ACR → deploy both container apps
- [ ] Postgres reachable; Drizzle schema + first migration applied
- [ ] Secrets in Key Vault, referenced by Container Apps — nothing secret in the repo
- [ ] `/healthz` green on both apps

**Exit criteria:** A push to `main` deploys both apps to Azure and the judge app is reachable at a public URL.

---

### Phase 10: Web PubSub transport spike

> **Goal:** Prove the transport before building on it.

- [ ] `/negotiate` issues a scoped, short-lived client access token with `room` and `role` claims
- [ ] Web PubSub event handler wired with signature validation
- [ ] One group per room code; join/leave on connect/disconnect
- [ ] Two browsers in one group exchange a message end to end
- [ ] Measure real round-trip from a Saudi connection and record it
- [ ] Decide and document reconnect/backoff behaviour on the client

**Exit criteria:** Two devices on different networks exchange messages through a room group, with measured latency written into `tech-specs.md`.

---

### Phase 11: Game server — rooms & protocol

> **Goal:** Room state moves off the client and onto the server.

- [ ] `packages/protocol`: Zod schemas for every message in both directions
- [ ] In-memory room registry with creation, code generation, and TTL eviction of abandoned rooms
- [ ] Server-side reducer wrapping `packages/game`, with judge-authority checks on every judge action
- [ ] Server-side 100ms tick per active room; broadcasts only on transitions plus a ~5s heartbeat
- [ ] Judge app switched from local state to server state — same screens, different source of truth
- [ ] Reject any judge action from a connection that is not the seated judge

**Exit criteria:** The judge app runs a full match against the server, and a forged judge action from a player connection is rejected.

---

### Phase 12: The redaction boundary

> **Goal:** Make answer secrecy structurally impossible to break. This is a pillar; treat it accordingly.

- [ ] `transport/publish.ts` builds judge and player payloads **separately, by construction**
- [ ] The player payload type has no `answer`/`alts`/`fact` fields at all — a leak becomes a type error
- [ ] Judge rotation: outgoing judge leaves the judge group before the incoming judge's payload is sent
- [ ] Reveal payload carries the answer to players only *after* the judge rules correct
- [ ] Automated test: capture every frame sent to a player connection across a full match, assert none contains answer text
- [ ] Manual verification with dev tools open on a player device throughout a match

**Exit criteria:** ✅ **The leak test passes across a full simulated match, and a player device's network tab contains no answer data at any point.**

---

## Milestone C — Player experience & resilience (Phases 13–16)

### Phase 13: Player — join & lobby

- [ ] Join screen: code + name inputs, Archivo 26px code field with `.24em` tracking, uppercase
- [ ] Validation: name required; code compared case-insensitively after `trim().toUpperCase()`; error clears on keystroke; Enter submits
- [ ] Deep link `/j/[code]` prefills the code from the URL
- [ ] Player appears in the judge's room list immediately on join
- [ ] Lobby: team card in the team colour, welcome line, "بدّل فريقي ↺" shown only before play starts
- [ ] Judge banner when this player is the judge, with a link to the judge screen

**Exit criteria:** A guest joins from a link on their own phone in under 15 seconds and sees their team.

---

### Phase 14: Player — live & waiting

- [ ] Live view: compact timer cards (Archivo 20px, no win dots), question card at 22px/800, identical hint strip
- [ ] No reveal overlay and no answer box on the player client — not hidden, absent
- [ ] Waiting panel: sunken fill, 2.5px dashed border, bobbing ⏳ (👑 at match end), title + body
- [ ] Automatic transition into the question view when the round starts
- [ ] Match-end result visible on the player's phone
- [ ] Verify every screen in both themes at real phone widths

**Exit criteria:** A player follows an entire match from their phone without ever touching the host screen.

---

### Phase 15: Reconnect & seat recovery

> **Goal:** Phones sleep constantly at a party. Losing your seat cannot be a thing that happens.

- [ ] Persist `playerId` in `localStorage`; server maps id → seat
- [ ] Reconnect restores the existing seat, team and judge status — never creates a duplicate player
- [ ] Handle backgrounded tabs, screen lock, and browser reload
- [ ] Server tolerates a brief disconnect without removing the player from the room
- [ ] Visible connection state on the client, with automatic backoff and retry
- [ ] Test: lock the phone mid-round, unlock, confirm the seat and live state return

**Exit criteria:** A player can reload, lock, background and restore their phone at any point in a match and land back in the same seat.

---

### Phase 16: Clock reconciliation & judge disconnect

> **Goal:** Close the two remaining correctness risks in the realtime layer.

- [ ] Client interpolates the clock between broadcasts and snaps to the server value on each one
- [ ] Verify no visible jump on the heartbeat, and no client-side drift over a full 45-second bank
- [ ] **Resolve the open question: what happens when the judge disconnects mid-round?** Decide, then implement
- [ ] Implement the decision — pause the round with a clear banner, and offer transfer of the judge seat
- [ ] Answer data moves atomically with the judge seat on any transfer
- [ ] Room cleanup for genuinely abandoned rooms

**Exit criteria:** Killing the judge's browser mid-round leaves the room recoverable, and no client's clock disagrees with the server's.

---

## Milestone D — Accounts & money (Phases 17–20)

Players remain account-free throughout. Everything in this milestone is host-side.

### Phase 17: Host authentication

- [ ] Google Sign-In (OIDC) end to end
- [ ] Apple Sign-In end to end — significant iPhone share in the audience
- [ ] `hosts` and `auth_sessions` tables; HTTP-only, `SameSite=Lax`, Secure cookies
- [ ] `/account` shows the signed-in host and their subscription status
- [ ] `requireHost` middleware; sign-out
- [ ] Confirm hosting a free game still requires no account at all

**Exit criteria:** A host signs in with Google and with Apple, and an anonymous host can still open a room and play.

---

### Phase 18: Subscription request & receipt upload

- [ ] `subscriptions` and `payment_receipts` tables; state machine `pending → active → expired → rejected`
- [ ] Request flow issues a unique reference code and displays IBAN, account name and amount
- [ ] Receipt upload straight to Blob Storage via a short-lived SAS URL, into a private container
- [ ] Upload validation: file type, size cap
- [ ] `/account` reflects live status: awaiting transfer, under review, active, rejected with a reason
- [ ] All copy in Arabic, in the Arcade style

**Exit criteria:** A host requests a subscription, receives a reference code, uploads a receipt, and sees "under review."

---

### Phase 19: Admin approval panel

- [ ] `admins` table with a manual allowlist — no self-service admin creation
- [ ] `/admin` lists pending requests with host, amount, reference code and receipt
- [ ] Receipt viewable through a time-limited SAS link
- [ ] Approve → activates the subscription and sets `expires_at`; reject → records a reason
- [ ] Every action records `reviewed_by` and `reviewed_at` for an audit trail
- [ ] Host is notified of the outcome

**Exit criteria:** An admin approves a real request end to end and the host's account becomes active.

---

### Phase 20: Entitlement enforcement

> **Goal:** Paid content is gated by the server, not by a lock icon.

- [ ] `entitlements` view deriving allowed category ids from active subscription state
- [ ] Category selection validated server-side on room creation — a forged request for a paid category is rejected
- [ ] Expiry handled: a lapsed subscription loses paid categories immediately
- [ ] Locked-tile UI driven by real entitlement data rather than a hardcoded flag
- [ ] **Resolve the open question: are locked categories bought in-room or on the account beforehand?**
- [ ] Test: a free host cannot obtain paid questions by any client-side manipulation

**Exit criteria:** A free host provably cannot access paid categories, verified by direct API calls rather than through the UI.

---

## Milestone E — Launch (Phases 21–24)

### Phase 21: Landing page

- [ ] Hero: 64px/800 headline stepping to ~40px under 760px, live-looking score panel
- [ ] "كيف تلعب" three-up grid collapsing to one column on narrow widths
- [ ] Game library: all five games, حكم المعلومات playable, four marked قريباً
- [ ] Pricing close: full-width red panel, `0 8px 0` shadow, subscription CTA
- [ ] Sticky nav, brand mark, footer
- [ ] ⚠️ **Blocked on real artwork** — five 250px image slots are placeholders and cannot ship as-is
- [ ] SEO: Arabic metadata, Open Graph images, sitemap

**Exit criteria:** The landing page is live at the production domain with real artwork in every game card.

---

### Phase 22: Content expansion to launch depth

> **Duration:** more than one day — this is a content grind, not an engineering task. Run it in parallel with Phases 21, 23 and 24.

- [ ] Set the target depth per category from measured play: how many questions a real gathering consumes
- [ ] Draft candidates with Claude against the Phase 8 schema, category by category
- [ ] **Human-verify every question, variant, hint and fact.** No exceptions
- [ ] Balance difficulty within each category so a round doesn't stall on three hard questions
- [ ] Ensure the paid categories are visibly richer than the free ones — the subscription has to be worth buying
- [ ] Playtest for repeats across several consecutive matches

**Exit criteria:** No repeat questions across a full evening of play, and every question has been read and approved by a human.

---

### Phase 23: Hardening & observability

- [ ] Application Insights on both apps; structured logging with room code correlation
- [ ] Alerts: game server down, error-rate spike, Postgres connection saturation
- [ ] Rate limiting on room creation and join attempts — the room code space is small
- [ ] **Decide the players-per-team cap** and enforce it with a clear message
- [ ] Load test: a realistic number of concurrent rooms, checking clock accuracy under load
- [ ] Postgres automated backups verified by an actual restore
- [ ] Accessibility pass: focus order, focus-visible rings, contrast in both themes, screen-reader labels on icon-only buttons

**Exit criteria:** Alerts fire correctly in a drill, a backup restores successfully, and the accessibility pass has no outstanding blockers.

---

### Phase 24: Launch preparation

- [ ] Domain and TLS on `nel3ab.game`; share links resolve correctly
- [ ] Privacy policy and terms in Arabic, covering EU data residency for Saudi users
- [ ] Runbook: how to restart the game server, restore the DB, approve a subscription manually
- [ ] Support channel for factual corrections to questions, with a same-day fix commitment
- [ ] Analytics on the funnel metrics from `mission.md`
- [ ] Final review against the pillars: answer secrecy, Arabic-first RTL, the Arcade look
- [ ] Soft launch to a controlled group before opening the doors

**Exit criteria:** ✅ **Strangers can find, host and play نلعب, and a host can pay for a subscription.**

---

## Future Considerations (post Phase 24)

- **Game 02 — تحدي الصور** — image-guessing, two teams. Needs image hosting and a media pipeline
- **Game 03 — سهرة نلعب** — a full evening schedule with rotating rounds, every player on their own phone
- **Game 04 — من الأسرع** — buzz-in, first press wins. **This is where phone answering lives.** It reintroduces race conditions, latency fairness and press deduplication, all deliberately excluded from حكم المعلومات
- **Game 05 — كلمة وموقف** — describe the word without saying it
- **Payment gateway** — Moyasar or Tap for mada, dropping into the existing subscription state machine as one more activation path
- **Gulf region migration** — move to UAE North or a Saudi region if PDPL residency requires it or latency proves to matter
- **Multi-replica game server** — Redis-backed room snapshots so a deploy no longer kills live matches
- **Community question submissions** — with a review queue, once the review gate can scale
- **Match history for hosts** — past matches, favourite categories, group statistics

---

## How to Use This Roadmap

1. **One phase per day** — if a phase runs over, split it rather than letting it sprawl
2. **Exit criteria are binary** — a phase is done when its criterion is demonstrably true, not when the tasks look finished
3. **Update the status column** as you go
4. **Milestone boundaries are the real checkpoints** — Phases 7, 12, 16, 20 and 24 each end with something you can show someone
5. **Phase 22 runs in parallel** — content is a grind that shouldn't block engineering
6. **Tag releases** at each milestone (`v0.1-playable`, `v0.2-realtime`, `v0.3-resilient`, `v0.4-paid`, `v1.0-launch`)

---

*Last updated: 2026-08-17*
*Author: Ahmed Alshehri (ahmed@tadawulcom.sa)*
*Status: Living document — phases are re-evaluated as priorities shift*
