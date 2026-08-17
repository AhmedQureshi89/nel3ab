# نلعب (Nel3ab) — Mission & Constitution

> The foundational document that defines what نلعب is, who it serves, and the principles that guide every decision.

---

## 1. Mission Statement

**نلعب is an Arabic-first party game platform that gives Saudi friends and families a ready-made reason to gather around one screen — a room code, two teams, and a judge, with no app to install and no account for players.**

The gap it fills is social, not technical. A Saudi gathering — a ديوانية, a family night, a سهرة after dinner — reliably reaches a point where someone says "الجلسة يبيلها لعبة" and nobody has an answer. Existing options are English-first, built for remote play, or demand that everyone download something. نلعب turns any phone in the room into a controller in under fifteen seconds, and keeps the laughter where it belongs: in the room, out loud, between people who are sitting together.

The platform launches with one game — **حكم المعلومات**, a two-team trivia race with a human judge — and grows into a library of five.

---

## 2. Target Audience

| Attribute        | Detail                                                                                          |
|------------------|-------------------------------------------------------------------------------------------------|
| **Who**          | Saudi friends and families gathering in person — 4 to 10 people in one room, one of them hosting |
| **Experience**   | Zero. Anyone who can read a 6-character code off a screen can play                              |
| **Domain**       | Consumer social / party games                                                                   |
| **Language**     | Arabic, Saudi (Najdi-leaning) voice — authored natively, never translated                        |
| **Need**         | A game that starts immediately, includes everyone, and needs no setup or explanation             |
| **Pain Point**   | The gathering stalls; board games are a production; phone games are solitary; quiz apps are English-first, classroom-shaped, or built for remote players |

نلعب is deliberately narrow: it only works when people are **physically together**. That constraint is the product, not a limitation to engineer away.

---

## 3. Core Product Pillars

These three capabilities define نلعب. They are non-negotiable — a change that trades any of them away is the wrong change, regardless of what it gains.

### 🔹 Answer Secrecy
The correct answer, its accepted variants, and its trivia fact reach **the judge's client and no other**. This is enforced at the transport layer: the server never sends answer data to a player connection. Hiding answers with CSS, `display:none`, or client-side filtering is forbidden — a curious teenager with dev tools would end the game. When the judge rotates between rounds, the incoming judge's client gains answer data and the outgoing judge's loses it in the same operation.

Break this once and the product is worthless, because the only thing making a trivia game fair is that exactly one person knows.

### 🔹 Arabic-First RTL
Not an English app with Arabic strings poured in. Every screen is `dir="rtl"` and laid out mirrored from the start. Content is authored in Arabic by people who speak it — the copy carries a Saudi voice ("وش سالفتها؟", "الجلسة يبيلها لعبة"), and questions draw on Saudi and Arab reference points, not translated Western trivia. Latin and numeric runs — the room code, the clocks, score tallies — are set in Archivo and direction-isolated so they never reorder inside surrounding Arabic text.

### 🔹 The Arcade Look
The visual identity is a specific, committed style: 2.5–3px ink borders, hard offset drop shadows with **zero blur**, radii from 14px to 28px, and buttons that physically press down (`translateY` while the shadow shrinks by the same amount — never a scale, never an opacity fade). Both light and dark themes are final.

This is the product's personality, and it is easy to lose by accident. Softening it into generic flat or material styling — adding blur to a shadow, rounding a border down to 1px, replacing the press with a fade — is a regression even when it looks "cleaner."

---

## 4. Business Model

نلعب operates on a **freemium subscription, with hosts paying and players never signing up**.

| Tier              | Access                                                                                     |
|-------------------|--------------------------------------------------------------------------------------------|
| **Player**        | Always free, no account, no app. Joins any room with a code and a name. Never asked to pay |
| **Free host**     | Open unlimited rooms, play حكم المعلومات with the 8 free categories, full game features     |
| **Subscribed host** | The 3 paid categories (ثقافة · فن · أفلام), the full expanded question bank, and each new game in the library as it ships |

**Payment is by manual bank transfer**, not a card gateway. A host requests a subscription, receives an IBAN and a unique reference code, transfers the amount, uploads the receipt, and an administrator approves it — at which point the account activates. This is a deliberate choice for the Saudi market and the current stage; it means the product needs an admin approval surface that a Stripe-style integration would not have required.

The subscription state machine (`pending → active → expired`) is designed so that a card gateway can later become one more activation path rather than a rewrite.

---

## 5. Guiding Principles

### 5.1 Players Never Sign Up
The single hardest-won property of this product is that a guest goes from "send me the link" to playing in under fifteen seconds. Accounts, profiles, permissions, onboarding, and email verification all belong to the **host** side of the line. Nothing that touches the player join path may add a step. When a feature seems to require player identity, the answer is a room seat persisted in local storage, not an account.

### 5.2 The Server Owns The Clock
Two clients must never disagree about how much time a team has left. The authoritative bank lives on the server and every client renders a reconciled view of it. Client-side countdowns that drift are not an acceptable optimisation — the clock running out is how rounds are decided, so it is the one number that must be beyond dispute.

### 5.3 The Prototypes Are The Specification
The design handoff in `design/` is high-fidelity and intentional: every colour, radius, border width, font size and animation duration is a decision, not a placeholder. When implementation and prototype disagree, the prototype is right until someone explicitly decides otherwise and updates the spec. The HTML is a reference to reproduce, never code to copy.

### 5.4 Wrong Answers Are Fatal
A trivia game's entire credibility rests on being correct. Every question, accepted variant, hint, and trivia fact is human-verified before it merges — no exceptions, no "we'll check it later," regardless of how it was drafted. One confidently wrong answer in front of a room of ten people costs more trust than fifty good questions earn.

### 5.5 Solo-Scale Choices
This is built by one person with Claude. Prefer managed services over self-hosted infrastructure, boring and well-documented technology over clever novelty, and one deployable thing over four. Every piece of architecture has to be something one person can debug at 1am.

---

## 6. What نلعب Is NOT

- ❌ **Not a remote or online multiplayer game** — everyone is in the same room. No video chat, no matchmaking with strangers, no asynchronous play, no "invite a friend across the world." Phones are second screens for people sitting together, and the game has no meaning otherwise.
- ❌ **Not a solo game** — no practice mode, no bot opponents, no daily puzzle, no streaks. It requires a group and a host, and it does not try to be entertaining alone.
- ❌ **Not a quiz or education tool** — not Kahoot for classrooms, not a study aid. No grading, no learner analytics, no LMS integration, no measuring whether anyone improved.
- ❌ **Not a social network** — no profiles, friends, feeds, cross-session leaderboards, or persistent identity beyond a seat in one room. When the gathering ends, the room ends.

---

## 7. Success Metrics

| Metric                              | Target                                                                 |
|-------------------------------------|------------------------------------------------------------------------|
| **Time from link tap to in-room**   | Under 15 seconds on a mid-range phone over mobile data                 |
| **Answer leaks**                    | Zero. Any answer datum reaching a player connection is a P0 defect     |
| **Question accuracy**               | 100% human-verified at merge; any reported factual error fixed same day |
| **Repeat sessions**                 | A host who runs one match runs a second within 30 days                 |
| **Rounds per session**              | Groups reach a full match (3 round wins) rather than abandoning midway  |
| **Reconnect success**               | A player whose phone sleeps or reloads returns to their existing seat   |
| **Question bank depth**             | Enough per category that a single gathering never sees a repeat         |
| **Design fidelity**                 | Implemented screens match the prototypes on colour, radius, border, shadow and timing |

---

*Last updated: 2026-08-17*
*Author: Ahmed Alshehri (ahmed@tadawulcom.sa)*
*Status: Living document — updated as the product evolves*
