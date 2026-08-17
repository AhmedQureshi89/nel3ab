# نلعب (Nel3ab) — Technical Specification

> The canonical technical reference for نلعب's architecture, technology stack, services, data flows, and integration contracts.

> [!NOTE]
> This is a **greenfield** project. Nothing described here is built yet — this document is the target architecture agreed during the constitution interview, not a description of existing code. Sections marked 🔲 are decisions made but not implemented.

---

## 1. System Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                             CLIENTS                                │
│                                                                    │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│   │   Landing    │    │  Judge app   │    │ Player phone │       │
│   │  (SSG, SEO)  │    │  (host, 1×)  │    │   (N×, RTL)  │       │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│          │                   │  WebSocket        │  WebSocket     │
└──────────┼───────────────────┼───────────────────┼────────────────┘
           │ HTTPS             │                   │
           ▼                   ▼                   ▼
  ┌─────────────────┐   ┌──────────────────────────────────┐
  │  nel3ab-web     │   │   Azure Web PubSub               │
  │  Next.js 15     │   │   (managed WebSockets)           │
  │  Container Apps │   │   one group per room code        │
  │                 │   └──────────┬───────────────────────┘
  │  · landing      │              │ upstream events
  │  · /j/[code]    │              │ (connect/message/disconnect)
  │  · judge app    │              ▼
  │  · /account     │   ┌──────────────────────────────────┐
  │  · /admin       │   │   nel3ab-game                    │
  └────────┬────────┘   │   Node + TypeScript              │
           │            │   Container Apps                 │
           │            │                                  │
           │            │   · room registry (in-memory)    │
           │            │   · authoritative clock          │
           │            │   · rules engine (@nel3ab/game)  │
           │            │   · answer redaction boundary    │
           │            └────────┬─────────────────────────┘
           │                     │
           └──────────┬──────────┘
                      ▼
        ┌───────────────────────────┐   ┌────────────────────────┐
        │ Azure Database for        │   │  Azure Blob Storage    │
        │ PostgreSQL Flexible Server│   │  · transfer receipts   │
        │ · hosts                   │   │  · landing artwork     │
        │ · subscriptions           │   └────────────────────────┘
        │ · receipts · matches      │
        └───────────────────────────┘

        ┌───────────────────────────────────────────────────┐
        │  EXTERNAL                                         │
        │  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
        │  │ Google      │  │ Apple       │  │  Bank     │ │
        │  │ Sign-In     │  │ Sign-In     │  │ (manual)  │ │
        │  └─────────────┘  └─────────────┘  └───────────┘ │
        └───────────────────────────────────────────────────┘

  Question content: versioned JSON in the repo, compiled into
  @nel3ab/content and loaded by nel3ab-game at boot. Not in the DB.
```

### Deployment

| Component            | Platform                                    | Region        | Notes                                        |
|----------------------|---------------------------------------------|---------------|----------------------------------------------|
| `nel3ab-web`         | Azure Container Apps                        | West Europe   | Next.js server; landing is statically generated |
| `nel3ab-game`        | Azure Container Apps                        | West Europe   | Single replica initially — see Technical Debt |
| WebSocket transport  | Azure Web PubSub                            | West Europe   | One group per room code                      |
| Database             | Azure Database for PostgreSQL Flexible Server | West Europe | Burstable tier to start                      |
| Blob storage         | Azure Blob Storage                          | West Europe   | Private container for receipts; public CDN container for artwork |
| Registry             | Azure Container Registry                    | West Europe   | Images for both container apps               |
| Secrets              | Azure Key Vault                             | West Europe   | Referenced by Container Apps secret refs     |

> [!IMPORTANT]
> **Region choice:** West Europe was selected over UAE North / Qatar Central. This costs roughly 90–120ms round-trip from Riyadh versus 20–40ms from a Gulf region. That is acceptable **only because** the clock is server-authoritative and rendered in whole seconds — no interaction in this game is latency-sensitive at that scale. The trade-off is deliberate (wider service catalogue, lower cost). It does mean Saudi player data transits and rests in the EU, which should be revisited if PDPL data-residency obligations tighten or if a Saudi/Gulf region becomes attractive.

---

## 2. Technology Stack

### 2.1 `nel3ab-web` — Next.js application

| Layer            | Technology                        | Purpose                                                        |
|------------------|-----------------------------------|----------------------------------------------------------------|
| **Runtime**      | Node.js 24                        | Matches local toolchain                                        |
| **Framework**    | Next.js 15 (App Router)           | Landing (SSG) + judge app + join/player app in one codebase     |
| **Language**     | TypeScript (strict)               | Shared types with the game server via workspace packages        |
| **Styling**      | CSS Modules + CSS custom properties | Arcade tokens are already authored as custom properties — port them directly rather than translating into a utility framework |
| **State**        | React state + a WS client hook    | Room state is server-owned; the client is mostly a renderer     |
| **Validation**   | Zod                               | Shared schemas for WS messages and REST payloads               |
| **Fonts**        | Self-hosted Baloo Bhaijaan 2 + Archivo | `next/font/local` — Google Fonts CDN is not used in production |
| **i18n / dir**   | `dir="rtl"` at the root, `lang="ar"` | Single-locale for now; no i18n framework until a second locale exists |

### 2.2 `nel3ab-game` — realtime game server

| Layer            | Technology                              | Purpose                                                    |
|------------------|-----------------------------------------|------------------------------------------------------------|
| **Runtime**      | Node.js 24                              | Long-lived process holding room state                      |
| **Framework**    | Fastify                                 | HTTP for `/negotiate`, the Web PubSub event handler, and health |
| **Transport**    | `@azure/web-pubsub` + `@azure/web-pubsub-express` | Service client for sending to groups; middleware for upstream events |
| **Language**     | TypeScript (strict)                     | Rules engine shared with the web app                       |
| **Clock**        | `setInterval` @ 100ms per active room   | Authoritative; see §4                                      |
| **Validation**   | Zod                                     | Every inbound client message is parsed before it touches state |

### 2.3 Shared workspace packages

| Package             | Purpose                                                                                          |
|---------------------|--------------------------------------------------------------------------------------------------|
| `@nel3ab/game`      | Pure, dependency-free rules engine: reducer over room state, clock maths, round/match flow, category draw. **Fully unit-testable with no server, no sockets, no React.** Built in Phases 3–4 — Phase 1 creates the package shell only |
| `@nel3ab/protocol`  | Zod schemas + TypeScript types for every WS message in both directions. Single source of truth for the wire format |
| `@nel3ab/content`   | The question bank as typed, versioned JSON + loader and validation. Ships in the game server image |
| `@nel3ab/ui`        | Arcade primitives — tokens, Panel, Button (with press behaviour), Pill, TimerCard, dots. Shared by landing, judge and player |

### 2.4 Database

| Component      | Technology                                  | Details                                                        |
|----------------|---------------------------------------------|----------------------------------------------------------------|
| **Database**   | Azure Database for PostgreSQL Flexible Server | Burstable B1ms to start; managed backups                     |
| **Access**     | Drizzle ORM                                 | Typed schema, SQL-first migrations checked into the repo       |
| **Auth store** | Own `hosts` + `auth_sessions` tables        | Sessions as HTTP-only cookies; no third-party auth service     |
| **Content**    | ❌ *Not in the database*                     | Questions live in git — see §2.5                              |

### 2.5 Content pipeline

Questions are **not** database rows. They are versioned JSON under `packages/content/categories/*.json`, compiled into `@nel3ab/content` at build time. The JSON lives inside the package so `@nel3ab/content` is self-contained and the workspace needs no special-case glob for a root `content/` directory.

| Stage      | Process                                                                                                  |
|------------|----------------------------------------------------------------------------------------------------------|
| **Draft**  | Claude generates candidate questions per category against the schema (`q`, `a`, `alts[]`, `h[]`, `f`)     |
| **Review** | Every question human-verified for factual accuracy and Arabic voice. **Nothing merges unreviewed**        |
| **Validate** | CI validates schema, checks for duplicate questions, and enforces minimum counts per category           |
| **Ship**   | Merged to `main` → baked into the game server image                                                       |

Rationale: Arabic copy quality is reviewable in a diff, factual corrections carry git history and blame, and the review gate is enforced by pull request rather than by discipline. Cost: content changes require a deploy — acceptable at this stage, revisit if question volume makes it painful.

### 2.6 External integrations

| Service              | Role                                          | Status         |
|----------------------|-----------------------------------------------|----------------|
| Google Sign-In       | Host authentication (OAuth 2.0 / OIDC)        | 🔲 Planned     |
| Apple Sign-In        | Host authentication — significant iPhone share in Saudi | 🔲 Planned |
| Bank transfer        | Subscription payment, manual + admin approval | 🔲 Planned     |
| Azure Web PubSub     | WebSocket transport                           | 🔲 Planned     |
| Payment gateway      | Moyasar / Tap — *deferred*, not in scope      | ⏸️ Future      |

---

## 3. Service Details

### 3.1 `nel3ab-web` routes

| Route                   | Rendering | Auth      | Purpose                                                     |
|-------------------------|-----------|-----------|-------------------------------------------------------------|
| `/`                     | SSG       | Public    | Landing: hero, how-it-works, game library, pricing close      |
| `/j/[code]`             | Client    | None      | Player join — code prefilled from the URL, name entry        |
| `/play`                 | Client    | None      | Player lobby / live / waiting screens                        |
| `/host`                 | Client    | Optional  | Judge app: setup → ready → play → roundEnd → match           |
| `/account`              | SSR       | Host      | Subscription status, request subscription, upload receipt     |
| `/account/subscribe`    | SSR       | Host      | IBAN + reference code, receipt upload form                   |
| `/admin`                | SSR       | Admin     | Pending subscription requests, receipt review, approve/reject |
| `/api/auth/[...]`       | Route     | —         | OAuth start/callback, session issue, sign-out                |
| `/api/subscription/*`   | Route     | Host      | Create request, upload receipt (SAS to Blob), read status     |
| `/api/admin/*`          | Route     | Admin     | List pending, approve, reject                                 |

### 3.2 `nel3ab-game` endpoints

| Endpoint          | Method | Purpose                                                                                     |
|-------------------|--------|---------------------------------------------------------------------------------------------|
| `/negotiate`      | POST   | Issue a short-lived Web PubSub client access token scoped to one room group and one role (`judge` \| `player`). **This is where the answer-secrecy boundary is established** |
| `/eventhandler`   | POST   | Web PubSub upstream webhook — `connect`, `message`, `disconnected`. CloudEvents, signature-validated |
| `/rooms`          | POST   | Create a room; returns a 6-character code                                                    |
| `/healthz`        | GET    | Container Apps liveness/readiness probe                                                     |

### 3.3 Core modules (`nel3ab-game`)

| Module                | Purpose                                                                                          |
|-----------------------|--------------------------------------------------------------------------------------------------|
| `rooms/registry.ts`   | In-memory `Map<roomCode, Room>`; creation, lookup, TTL eviction of abandoned rooms                |
| `rooms/clock.ts`      | Per-room 100ms interval; decrements the active team's bank; fires round-end at zero; paused during reveal |
| `rooms/reducer.ts`    | Thin wrapper over `@nel3ab/game` — validates that the actor is the current judge before applying any judge action |
| `transport/publish.ts`| **The redaction boundary.** Produces two payloads per broadcast: a judge view (with answer data) and a player view (without). Player payload is built by construction, never by deletion |
| `transport/tokens.ts` | Web PubSub access tokens; encodes role and room in claims                                        |
| `seats.ts`            | Player id ↔ seat mapping for reconnect                                                           |

### 3.4 Middleware

| Middleware              | Purpose                                                                    |
|-------------------------|----------------------------------------------------------------------------|
| `requireHost`           | Validates the session cookie on `/account/*` and host APIs                  |
| `requireAdmin`          | Role check on `/admin/*`                                                    |
| `validateWebPubSubSig`  | Verifies the upstream webhook signature — rejects forged room events        |
| `rateLimitJoin`         | Caps join attempts per IP, so room codes can't be brute-forced              |

---

## 4. The Clock — authoritative timing

The prototype ticks every 100ms in one browser. Production must not broadcast at 100ms; that would be tens of thousands of needless messages per match.

**Model:** the server holds the truth and broadcasts *transitions*, not ticks.

```
Room state carries:  { banks: {a,b}, active, runningSince | null, serverTime }

Server: ticks internally at 100ms to detect zero-crossing and end the round.
        Broadcasts only on: turn pass, hint, skip, reveal start/end,
        round end, join/leave, and a ~5s heartbeat for drift correction.

Client: renders ceil(bank - (now - runningSince)) locally between broadcasts,
        clamped at 0, and snaps to the server value on every broadcast.
```

This keeps the displayed clock smooth while the decision — *did time run out?* — is made in exactly one place. Clients never decide that a round ended.

**Answer redaction is structural, not cosmetic.** `transport/publish.ts` builds the player payload from scratch with only player-safe fields. There is no code path where a payload containing `answer`, `alts` or `fact` is sent to a player connection and then filtered. On judge rotation, the outgoing judge's connection is moved out of the judge group before the incoming judge's payload is sent.

---

## 5. Data Model (key tables)

| Table                | Purpose                                                                                                  |
|----------------------|----------------------------------------------------------------------------------------------------------|
| `hosts`              | `id`, `provider` (google\|apple), `provider_user_id`, `email`, `display_name`, `created_at`               |
| `auth_sessions`      | `id`, `host_id`, `expires_at`, `user_agent` — HTTP-only cookie sessions                                    |
| `subscriptions`      | `id`, `host_id`, `status` (`pending`\|`active`\|`expired`\|`rejected`), `plan`, `reference_code` (unique), `amount_sar`, `requested_at`, `activated_at`, `expires_at`, `approved_by` |
| `payment_receipts`   | `id`, `subscription_id`, `blob_path`, `uploaded_at`, `note`, `reviewed_at`, `reviewed_by`                  |
| `admins`             | `id`, `host_id`, `role` — small allowlist, no self-service admin creation                                  |
| `matches`            | `id`, `host_id` (nullable — free anonymous hosts), `room_code`, `started_at`, `ended_at`, `winner`, `rounds` (jsonb) — history and analytics |
| `entitlements` (view)| Derived: which category ids a given host may select, from active subscription state                        |

Room state itself is **not** a table. It lives in the game server's memory for the life of the gathering.

---

## 6. Authentication & Authorization

| Mechanism           | Implementation                                                                              |
|---------------------|---------------------------------------------------------------------------------------------|
| **Player identity** | None. A `playerId` UUID in `localStorage` maps to a room seat. No account, ever              |
| **Host auth**       | Google Sign-In + Apple Sign-In (OIDC), sessions as HTTP-only, `SameSite=Lax`, Secure cookies |
| **Admin auth**      | Host session + row in `admins`. No separate admin login                                      |
| **Realtime auth**   | Short-lived Web PubSub access token from `/negotiate`, carrying `room` and `role` claims      |
| **Paid content**    | Enforced server-side in `/rooms` category selection against `entitlements`. The lock icon in the UI is a hint, never the control |

---

## 7. Environment Configuration

| Category         | Variables                                                                                     |
|------------------|-----------------------------------------------------------------------------------------------|
| **Database**     | `DATABASE_URL`                                                                                 |
| **Web PubSub**   | `WEBPUBSUB_CONNECTION_STRING`, `WEBPUBSUB_HUB`                                                  |
| **Auth**         | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `SESSION_SECRET` |
| **Storage**      | `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_RECEIPTS_CONTAINER`, `AZURE_STORAGE_ASSETS_CONTAINER`   |
| **Payments**     | `BANK_IBAN`, `BANK_ACCOUNT_NAME`, `SUBSCRIPTION_PRICE_SAR`                                      |
| **App**          | `PUBLIC_BASE_URL` (`https://nel3ab.game`), `GAME_SERVER_URL`, `NODE_ENV`                        |

All secrets are stored in Key Vault and injected as Container Apps secret references. Nothing secret is committed.

---

## 8. API Surface Summary

| Group          | Base path              | Auth      | Surface                                          |
|----------------|------------------------|-----------|--------------------------------------------------|
| Public pages   | `/`                    | No        | Landing (SSG)                                    |
| Player         | `/j/*`, `/play`        | No        | Join, lobby, live, waiting                       |
| Judge          | `/host`                | No        | Full judge app (free tier needs no account)      |
| Account        | `/api/subscription/*`  | Host      | 3 endpoints                                      |
| Admin          | `/api/admin/*`         | Admin     | 3 endpoints                                      |
| Realtime       | game server            | Token     | 4 HTTP endpoints + WS message protocol           |

### WS message protocol (outline)

| Direction         | Message                        | Notes                                                  |
|-------------------|--------------------------------|--------------------------------------------------------|
| client → server   | `join`, `swapTeam`, `rename`   | Player actions; `swapTeam` rejected once play starts    |
| judge → server    | `correct`, `hint`, `skip`, `startRound`, `nextRound`, `setJudge`, `pickCategories` | Rejected unless the sender is the seated judge |
| server → judge    | `state:judge`                  | Includes `answer`, `alts`, `fact`                      |
| server → players  | `state:player`                 | Never includes answer data                             |
| server → all      | `reveal`, `roundEnd`, `matchEnd` | Reveal payload carries the answer **only** after the judge has ruled correct |

---

## 9. Known Technical Debt & Accepted Risks

Greenfield, so this is a register of decisions taken with known costs rather than accumulated mess.

| Item                                                                 | Severity | Status                                             |
|----------------------------------------------------------------------|----------|----------------------------------------------------|
| **Single game-server replica; rooms in memory** — any deploy or crash kills every live room mid-match | High | Accepted for launch. Needs Redis-backed snapshots or sticky sharding before meaningful concurrency |
| **No judge-disconnect handling** — an open question in the handoff, still unanswered | High | Must be resolved before public launch. A dropped judge currently freezes a room permanently |
| **Question bank is 33 questions** (11 categories × 3) — a single gathering exhausts it | High | Phase 8 moves it into validated JSON; Phase 22 expands it to launch depth. Public launch is blocked on this |
| **README says 2 locked categories, the prototype has 3** (ثقافة، فن، أفلام) | Medium | Discrepancy found during handoff review. Product decision needed; treating 3 as correct |
| **Landing artwork does not exist** — five `<image-slot>` placeholders at 250px | Medium | Blocks the landing page shipping. Needs a designer or commissioned art |
| **West Europe region** — ~100ms from Riyadh, EU data residency for Saudi users | Medium | Deliberate. Revisit on PDPL pressure or Gulf region availability |
| **No payment gateway** — manual transfer needs a human in every subscription | Medium | Deliberate for this stage. State machine shaped so Moyasar/Tap drops in later |
| **No rate limiting on room creation** | Medium | Add before public launch — room codes are a 6-char space |
| **No observability** — no App Insights, structured logs, or alerting | Medium | Add alongside the first real deploy |
| **Team-size cap undecided** — open question from the handoff | Low | Pick a number before launch; UI will break at some point regardless |
| **Locked-category purchase location undecided** — in-room or on account beforehand | Low | Open question from the handoff |

---

*Last updated: 2026-08-17*
*Author: Ahmed Alshehri (ahmed@tadawulcom.sa)*
*Status: Living document — updated as the architecture evolves*
