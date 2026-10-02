// Test support (Phase 4) — the match oracle. REQ-4.14.
// See specs/phase-4/specs.md §2.10 ("match-oracle.ts") and
// specs/phase-4/verification.md, "Pre-registered values", Tables A (Phase 3's,
// reused as an anchor), E, F and G.
//
// A TRANSCRIPTION of the round and match flow of the prototype's behaviour
// class in design/designs/Nel3ab - Arcade.dc.html — `drawCategory`, `goWheel`,
// `startRound`, `startClock` (its interval body), `stopClock`, `spend`,
// `nextQuestion`, `markCorrect`, `passTurn`, `markSkip`, `giveHint`,
// `endRound`, `nextRound`, `rematch`, `resetAll`, and the getters `remaining`,
// `startingTeam` and `question` — with every branch commented with the method
// it comes from. It is written by reading the file, not by importing or
// executing it: design/ is HTML to reproduce, never code to copy (CLAUDE.md
// invariant 5), and what is taken from it is the control flow and the
// arithmetic only.
//
// Phase 3's `prototype-oracle.ts` models ONE TURN of one round, and Phase 3's
// pre-registered tables depend on exactly that, so it is not extended
// (requirements.md REQ-4.11). This is a second, fuller oracle: a whole room,
// from room-ready through any number of rounds, matches, rematches and resets.
//
// ONE function, TWO arithmetics — exactly Phase 3's (its specs.md §2.8), now
// over BOTH banks. Only the numbers differ — `UNITS` below — and everything
// else, the `v <= 0` test included, is one piece of code, so the two cannot
// differ in control flow:
//
//   |             | 'float' — the prototype as it computes | 'exact' — its stated rules   |
//   |-------------|----------------------------------------|------------------------------|
//   | unit        | seconds, a JS number                   | tenths of a second, integer  |
//   | tick        | Math.max(0, v − 0.1)                   | Math.max(0, v − 1)           |
//   | hint        | Math.max(0, v − 2)                     | Math.max(0, v − 20)          |
//   | skip        | Math.max(0, v − 3)                     | Math.max(0, v − 30)          |
//   | ended when  | v <= 0                                 | v <= 0                       |
//   | display     | Math.ceil(v)                           | Math.floor((v + 9) / 10)     |
//
// TIME. One 'tick' event is 100 ms: one firing of `startClock`'s
// `setInterval(…, 100)`. `markCorrect` stops that interval and starts a
// separate `setTimeout(() => this.passTurn(), 1000)` — the HOLD. While a hold
// is pending no interval exists, so a tick is the hold's: it counts the hold
// down, and the TENTH tick (1000 ms) runs `passTurn`, which starts a new
// interval whose first firing is the next tick (specs.md §2.10, the event
// table).
//
// THE DRAWS. Where the prototype calls `Math.random()` in `drawCategory`, the
// oracle takes the draw's value `r`; where `startRound` calls `shuffle`, it
// takes the draw's permutation `perm`: `pool = perm.map(k =>
// categoryQuestions(catIdx)[k])` (specs.md §2.10). The engine is given the same
// `r` and `perm` by the harness, so the two are compared on everything that
// follows from a draw — not on the draw's randomness.
//
// THE BUTTONS. A flow event runs its method only on the screen whose button
// calls it (verification.md Gate 4, extraction #16): `goWheel` on room-ready
// and `rematch` on match end (both 'startMatch'), `nextRound` on round end,
// `resetAll` on round end and match end ('resetMatch'). Elsewhere it does
// nothing: there is no button to press.
//
// Observation: the 17-tuple of specs.md §2.10 — (screen, round, tallyA,
// tallyB, active, display a, display b, started a, started b, reveal up,
// hintIndex, questionIndex, category, used list, judge index, log length, last
// log entry) — the same shape the harness reads off the engine.
//
// Test support: excluded from coverage (REQ-4.15, as REQ-3.12's second
// exclusion), never exported from index.ts, imported only by `*.test.ts` and by
// other files under `testing/`.

import type { CategoryId, Question, Screen, Team } from '../types.js'
import type { MatchFlow } from './match-sequences.js'
import type { Arithmetic } from './prototype-oracle.js'
import { categoryQuestions, type ReadyRoomSetup } from './rooms.js'

export type { Arithmetic } from './prototype-oracle.js'

/**
 * A flow event that starts a round, with its draw (specs.md §2.10): `r`, the
 * value the prototype's `drawCategory` takes from `Math.random()`, and `perm`,
 * the order `startRound` puts the category's questions in where the prototype
 * calls `shuffle`.
 */
export interface MatchDraw {
  readonly type: MatchFlow
  readonly r: number
  readonly perm: readonly number[]
}

/**
 * One event (specs.md §2.10): `tick` (100 ms), the three judge buttons, and
 * the three flow buttons — `startMatch(r, perm)`, `nextRound(r, perm)` and
 * `resetMatch`.
 */
export type MatchEvent = 'tick' | 'correct' | 'skip' | 'hint' | 'resetMatch' | MatchDraw

/** One entry of the prototype's round log, as the oracle keeps it. */
export interface OracleLogEntry {
  readonly n: number
  readonly category: CategoryId
  /**
   * The winning team's KEY. The prototype logs `winner === 'a' ? s.teamA :
   * s.teamB` — the team's display name — which is a function of the key, since
   * names are editable only on setup and both ways back to setup clear the log
   * (requirements.md, reading 3). The engine records the key.
   */
  readonly winner: Team
}

/**
 * An observation (specs.md §2.10): the 17-tuple, the last entry as
 * `n:category:winner` or empty. The oracle's and the engine's (read by
 * `testing/match-harness.ts`) have this one shape.
 */
export type MatchObservation = readonly [
  screen: Screen,
  round: number,
  tallyA: number,
  tallyB: number,
  active: Team,
  displayA: number,
  displayB: number,
  startedA: boolean,
  startedB: boolean,
  revealUp: boolean,
  hintIndex: number,
  questionIndex: number,
  category: CategoryId | null,
  used: readonly CategoryId[],
  judgeIndex: number,
  logLength: number,
  lastLog: string,
]

/** A log entry as the observation's last field writes it: `n:category:winner`. */
export const logEntryText = (entry: {
  readonly n: number
  readonly category: CategoryId
  readonly winner: Team
}): string => `${entry.n}:${entry.category}:${entry.winner}`

/** Everything the oracle holds that a caller may read — the observation, with the whole log. */
export interface OracleView {
  readonly screen: Screen
  readonly round: number
  readonly tallyA: number
  readonly tallyB: number
  readonly active: Team
  readonly display: readonly [a: number, b: number]
  readonly started: readonly [a: boolean, b: boolean]
  readonly revealUp: boolean
  readonly hintIndex: number
  readonly questionIndex: number
  readonly category: CategoryId | null
  readonly used: readonly CategoryId[]
  readonly judgeIndex: number
  readonly log: readonly OracleLogEntry[]
}

/** What differs between the two arithmetics: the unit (as a full bank), the three subtrahends, and the display. */
interface Units {
  /** A full bank: the prototype's `this.roundTime` (`this.props.roundSeconds ?? 45`), in this unit. */
  readonly full: (roundSeconds: number) => number
  /** What one firing of `startClock`'s interval subtracts. */
  readonly tick: number
  /** `giveHint`'s `this.spend(2)`, in this unit. */
  readonly hint: number
  /** `markSkip`'s `this.spend(3)`, in this unit. */
  readonly skip: number
  /** The whole seconds a clock shows for a bank of `v`. */
  readonly display: (v: number) => number
}

const UNITS: Readonly<Record<Arithmetic, Units>> = {
  // The prototype as it computes: floating-point seconds. `clockA:
  // String(Math.ceil(s.a.time))`, and the same for `b`.
  float: {
    full: (roundSeconds) => roundSeconds,
    tick: 0.1,
    hint: 2,
    skip: 3,
    display: (v) => Math.ceil(v),
  },
  // The prototype's stated rules: integer tenths of a second, so every
  // subtraction is exact. `Math.floor((v + 9) / 10)` is `Math.ceil(v / 10)`
  // over non-negative integers, with no division left to round.
  exact: {
    full: (roundSeconds) => roundSeconds * 10,
    tick: 1,
    hint: 20,
    skip: 30,
    display: (v) => Math.floor((v + 9) / 10),
  },
}

/**
 * The hold, in ticks: `markCorrect`'s `setTimeout(() => this.passTurn(), 1000)`
 * over `startClock`'s `setInterval(…, 100)` — the tenth tick is the 1000th ms.
 */
export const HOLD_TICKS = 10

/** The prototype's room, flow and clock, in one arithmetic. */
export interface MatchOracle {
  readonly arithmetic: Arithmetic
  /** Apply one event through the prototype's handler for it (specs.md §2.10, the event table). */
  step(event: MatchEvent): void
  /** The observation now. */
  observe(): MatchObservation
  /** `this.state.screen`. */
  screen(): Screen
  /** Everything `observe` reads, with the whole log. */
  view(): OracleView
  /**
   * The list `drawCategory` would pick from if `type`'s button were pressed
   * now — after `rematch` has cleared the used list, for a rematch — or `null`
   * when no button on this screen calls that method. The harness places a
   * scripted draw that names its category at its position in this list
   * (specs.md §2.10, "The scripted matches").
   */
  drawable(type: MatchFlow): readonly CategoryId[] | null
  /** A team's bank, in this arithmetic's own unit: seconds for 'float', tenths for 'exact'. */
  bank(team: Team): number
}

/**
 * The prototype on room-ready, with `setup`'s configuration, players, judge,
 * rotation toggle and selection — the state `startGame` leaves for `goWheel`,
 * which is what `readyRoom(setup)` (testing/rooms.ts) gives the engine.
 */
export function matchOracle(arithmetic: Arithmetic, setup: ReadyRoomSetup): MatchOracle {
  const u = UNITS[arithmetic]
  const { roundSeconds, winsNeeded, picked, players, rotateJudge } = setup
  const full = u.full(roundSeconds)

  // The prototype's state, as far as the flow reads it. Names are the
  // prototype's `this.state` fields.
  /** `this.state.screen`. */
  let screen: Screen = 'ready'
  /** `this.state.round`, `tallyA`, `tallyB`, `log`. */
  let round = 1
  let tallyA = 0
  let tallyB = 0
  let log: readonly OracleLogEntry[] = []
  /** `this.state.usedCats`, `this.state.catIdx` — category ids here, indices into `CATS` there. */
  let usedCats: readonly CategoryId[] = []
  let catIdx: CategoryId | null = null
  /**
   * `this.state.a`, `this.state.b` — `{time, started}`, `time` in this
   * arithmetic's unit. The prototype's initial state writes `time:45`, its
   * default `roundTime`; room-ready is never observed (every sequence and
   * every script opens with a draw, whose `startRound` sets both banks), so the
   * configured length stands here, as `createRoom` gives the engine.
   */
  const banks: Record<Team, { time: number; started: boolean }> = {
    a: { time: full, started: false },
    b: { time: full, started: false },
  }
  /** `this.state.active`. */
  let active: Team = 'a'
  /** `this.state.pool`, `qi`, `hintIdx`. */
  let pool: readonly Question[] = []
  let qi = 0
  let hintIdx = 0
  /** `this.state.reveal !== null`. */
  let reveal = false
  /** `this.state.judgeIdx`. */
  let judgeIdx = setup.judgeIndex
  /** `this.clockId !== null`: the interval exists, so a tick fires and the judge's handlers pass their first guard. */
  let clockId = false
  /** `this.revealId`: the pending hold, as the number of ticks it has run; `null` when none is pending. */
  let revealId: number | null = null

  // get remaining(){ return this.state.picked.filter(i => !this.state.usedCats.includes(i)); }
  const remaining = (used: readonly CategoryId[]): readonly CategoryId[] =>
    picked.filter((i) => !used.includes(i))

  // drawCategory: `const pool = this.remaining.length ? this.remaining : this.state.picked;`
  const choicesFrom = (used: readonly CategoryId[]): readonly CategoryId[] => {
    const left = remaining(used)
    return left.length ? left : picked
  }

  // get startingTeam(){ return this.state.round % 2 === 1 ? 'a' : 'b'; }
  const startingTeam = (): Team => (round % 2 === 1 ? 'a' : 'b')

  // get question(){ const p = this.state.pool; return p.length ? p[this.state.qi % p.length] : CATS[0].qs[0]; }
  // The `CATS[0].qs[0]` fallback is for an empty pool, which no round here
  // has: the judge's handlers that read the question pass `!this.clockId`
  // only after a `startRound`, and every draw's `perm` is non-empty.
  const question = (): Question => {
    const q = pool[qi % pool.length]
    if (q === undefined) throw new Error(`no question at qi ${qi} in a pool of ${pool.length}`)
    return q
  }

  // startClock(){ clearInterval(this.clockId); this.clockId = setInterval(() => { … }, 100); }
  // The interval's body is `interval` below: one 'tick' event is one firing.
  const startClock = (): void => {
    clockId = true
  }

  // stopClock(){ clearInterval(this.clockId); this.clockId = null; }
  const stopClock = (): void => {
    clockId = false
  }

  // endRound(loserKey){ if(this.state.screen !== 'play') return; this.stopClock(); clearTimeout(this.revealId);
  //   const winner = loserKey === 'a' ? 'b' : 'a';
  //   this.setState(s => { const tallyA = …; const tallyB = …;
  //     const done = tallyA >= this.winsNeeded || tallyB >= this.winsNeeded || this.remaining.length === 0;
  //     return { screen: done ? 'match' : 'roundEnd', tallyA, tallyB, reveal:null, roundWinner: winner,
  //       log: [...s.log, {n: s.round, cat: CATS[s.catIdx].name, winner: winner === 'a' ? s.teamA : s.teamB}] }; }); }
  const endRound = (loserKey: Team): void => {
    // endRound: `if(this.state.screen !== 'play') return;`
    if (screen !== 'play') return
    // endRound: `this.stopClock(); clearTimeout(this.revealId);`
    stopClock()
    revealId = null
    // endRound: `const winner = loserKey === 'a' ? 'b' : 'a';`
    const winner: Team = loserKey === 'a' ? 'b' : 'a'
    // endRound's updater: each tally rises by one for its own team.
    const nextA = tallyA + (winner === 'a' ? 1 : 0)
    const nextB = tallyB + (winner === 'b' ? 1 : 0)
    // endRound's updater: `this.remaining` reads `usedCats`, which this
    // round's `startRound` has already extended with this round's category.
    const done = nextA >= winsNeeded || nextB >= winsNeeded || remaining(usedCats).length === 0
    // endRound's updater: `{n: s.round, cat: CATS[s.catIdx].name, winner: …}`.
    if (catIdx === null) throw new Error('endRound: a round in play has a category')
    const entry: OracleLogEntry = { n: round, category: catIdx, winner }
    // endRound's updater: `screen: done ? 'match' : 'roundEnd', tallyA, tallyB, reveal:null, log: […]`.
    screen = done ? 'match' : 'roundEnd'
    tallyA = nextA
    tallyB = nextB
    reveal = false
    log = [...log, entry]
  }

  // spend(sec){ const key = this.state.active, cur = this.state[key];
  //   const time = Math.max(0, cur.time - sec); this.setState({[key]: {...cur, time}});
  //   if(time <= 0){ this.endRound(key); return true; } return false; }
  const spend = (sec: number): boolean => {
    const key = active
    const time = Math.max(0, banks[key].time - sec)
    banks[key] = { ...banks[key], time }
    // spend: `if(time <= 0){ this.endRound(key); return true; }`
    if (time <= 0) {
      endRound(key)
      return true
    }
    // spend: `return false;`
    return false
  }

  // nextQuestion(extra){ this.setState(s => Object.assign({qi: s.qi + 1, hintIdx:0, reveal:null}, extra || {})); }
  const nextQuestion = (): void => {
    qi += 1
    hintIdx = 0
    reveal = false
  }

  // startClock's interval body:
  //   if(this.state.reveal) return;
  //   const key = this.state.active, cur = this.state[key];
  //   const time = Math.max(0, cur.time - 0.1);
  //   this.setState({[key]: {...cur, time}}, () => { if(time <= 0) this.endRound(key); });
  const interval = (): void => {
    // startClock / stopClock: a cleared interval does not fire. `stopClock`
    // runs on a reveal (`markCorrect`), a round end (`endRound`) and a reset
    // (`resetAll`).
    if (!clockId) return
    // startClock: `if(this.state.reveal) return;`
    if (reveal) return
    const key = active
    const time = Math.max(0, banks[key].time - u.tick)
    banks[key] = { ...banks[key], time }
    // startClock: the setState callback, `if(time <= 0) this.endRound(key);`
    if (time <= 0) endRound(key)
  }

  // passTurn(){ const cur = this.state.active, next = cur === 'a' ? 'b' : 'a';
  //   const nx = this.state[next];
  //   this.setState({ active: next, [next]: nx.started ? nx : {time:this.roundTime, started:true},
  //     qi: this.state.qi + 1, hintIdx:0, reveal:null }, () => this.startClock()); }
  const passTurn = (): void => {
    const cur = active
    const next: Team = cur === 'a' ? 'b' : 'a'
    const nx = banks[next]
    active = next
    // passTurn: `[next]: nx.started ? nx : {time:this.roundTime, started:true}`
    banks[next] = nx.started ? nx : { time: full, started: true }
    // passTurn: `qi: this.state.qi + 1, hintIdx:0, reveal:null`
    qi += 1
    hintIdx = 0
    reveal = false
    // passTurn: `() => this.startClock()`
    startClock()
  }

  // The hold's timer: markCorrect's `this.revealId = setTimeout(() => this.passTurn(), 1000)`.
  // While it is pending the clock is stopped, so the tick is the hold's; the
  // tenth runs `passTurn`.
  const tick = (): void => {
    if (revealId !== null) {
      revealId += 1
      if (revealId === HOLD_TICKS) {
        revealId = null
        passTurn()
      }
      return
    }
    // startClock's interval.
    interval()
  }

  // markCorrect = () => { if(!this.clockId || this.state.reveal) return; const q = this.question;
  //   this.stopClock(); this.setState({reveal:{answer:q.a, fact:q.f || ''}});
  //   clearTimeout(this.revealId); this.revealId = setTimeout(() => this.passTurn(), 1000); };
  const markCorrect = (): void => {
    // markCorrect: `if(!this.clockId || this.state.reveal) return;`
    if (!clockId || reveal) return
    // markCorrect: `const q = this.question;` — the reveal carries its answer
    // and fact; the observation records only that the reveal is up.
    question()
    // markCorrect: `this.stopClock();`
    stopClock()
    // markCorrect: `this.setState({reveal:{answer:q.a, fact:q.f || ''}});`
    reveal = true
    // markCorrect: `clearTimeout(this.revealId); this.revealId = setTimeout(() => this.passTurn(), 1000);`
    revealId = 0
  }

  // markSkip = () => { if(!this.clockId || this.state.reveal) return; if(this.spend(3)) return; this.nextQuestion(); };
  const markSkip = (): void => {
    // markSkip: `if(!this.clockId || this.state.reveal) return;`
    if (!clockId || reveal) return
    // markSkip: `if(this.spend(3)) return;` — a round-ending skip advances nothing
    if (spend(u.skip)) return
    // markSkip: `this.nextQuestion();`
    nextQuestion()
  }

  // giveHint = () => { if(!this.clockId || this.state.reveal) return;
  //   if(this.state.hintIdx >= (this.question.h || []).length) return;
  //   if(this.spend(2)) return; this.setState(s => ({hintIdx: s.hintIdx + 1})); };
  const giveHint = (): void => {
    // giveHint: `if(!this.clockId || this.state.reveal) return;`
    if (!clockId || reveal) return
    // giveHint: `if(this.state.hintIdx >= (this.question.h || []).length) return;`
    // — BEFORE the spend, so an exhausted hint costs nothing
    if (hintIdx >= question().h.length) return
    // giveHint: `if(this.spend(2)) return;` — a round-ending hint advances nothing
    if (spend(u.hint)) return
    // giveHint: `this.setState(s => ({hintIdx: s.hintIdx + 1}));`
    hintIdx += 1
  }

  // startRound = () => { const start = this.startingTeam, other = start === 'a' ? 'b' : 'a';
  //   this.setState(s => ({ screen:'play',
  //     usedCats: s.usedCats.includes(s.catIdx) ? s.usedCats : [...s.usedCats, s.catIdx],
  //     pool: shuffle(CATS[s.catIdx].qs), qi:0, hintIdx:0, reveal:null, active: start,
  //     [start]: {time:this.roundTime, started:true}, [other]: {time:this.roundTime, started:false}
  //   }), () => this.startClock()); };
  const startRound = (perm: readonly number[]): void => {
    // startRound: `this.startingTeam` — read after `drawCategory`'s setState,
    // so a `nextRound` has already advanced `round`.
    const start = startingTeam()
    const other: Team = start === 'a' ? 'b' : 'a'
    if (catIdx === null) throw new Error('startRound: drawCategory has set a category')
    const category = catIdx
    screen = 'play'
    // startRound: `usedCats: s.usedCats.includes(s.catIdx) ? s.usedCats : [...s.usedCats, s.catIdx]`
    usedCats = usedCats.includes(category) ? usedCats : [...usedCats, category]
    // startRound: `pool: shuffle(CATS[s.catIdx].qs)` — `perm` in place of `shuffle`.
    const questions = categoryQuestions(category)
    pool = perm.map((k) => {
      const q = questions[k]
      if (q === undefined) throw new RangeError(`startRound: no question ${k} in ${category}`)
      return q
    })
    // startRound: `qi:0, hintIdx:0, reveal:null, active: start`
    qi = 0
    hintIdx = 0
    reveal = false
    active = start
    // startRound: `[start]: {time:this.roundTime, started:true}, [other]: {time:this.roundTime, started:false}`
    banks[start] = { time: full, started: true }
    banks[other] = { time: full, started: false }
    // startRound: `() => this.startClock()`
    startClock()
  }

  // drawCategory = (extra) => {
  //   const pool = this.remaining.length ? this.remaining : this.state.picked;
  //   const pick = pool[Math.floor(Math.random() * pool.length)];
  //   this.setState(Object.assign({catIdx: pick}, extra || {}), () => this.startRound()); };
  // `r` in place of `Math.random()`; `extra` is applied with `catIdx`, in the
  // same setState, before `startRound` runs.
  const drawCategory = (r: number, perm: readonly number[], extra?: () => void): void => {
    const choices = choicesFrom(usedCats)
    const pick = choices[Math.floor(r * choices.length)]
    if (pick === undefined) {
      throw new RangeError(`drawCategory: r ${r} picks nothing from ${choices.length} categories`)
    }
    catIdx = pick
    extra?.()
    startRound(perm)
  }

  // "ابدأ الجولة الأولى" on room-ready — goWheel = () => this.drawCategory();
  // "نفس الفرق — مباراة جديدة" on match end —
  //   rematch = () => this.setState({round:1, tallyA:0, tallyB:0, log:[], usedCats:[]}, () => this.drawCategory());
  const startMatch = ({ r, perm }: MatchDraw): void => {
    if (screen === 'ready') {
      // goWheel
      drawCategory(r, perm)
      return
    }
    if (screen === 'match') {
      // rematch: `{round:1, tallyA:0, tallyB:0, log:[], usedCats:[]}`, then `drawCategory()`.
      round = 1
      tallyA = 0
      tallyB = 0
      log = []
      usedCats = []
      drawCategory(r, perm)
    }
    // Elsewhere: neither button is on screen.
  }

  // "الجولة التالية" on round end —
  //   nextRound = () => { const s = this.state; this.drawCategory({ round: s.round + 1,
  //     judgeIdx: s.rotateJudge ? (s.judgeIdx + 1) % Math.max(1, s.players.length) : s.judgeIdx }); };
  const nextRound = ({ r, perm }: MatchDraw): void => {
    if (screen !== 'roundEnd') return
    const nextRoundNumber = round + 1
    const nextJudge = rotateJudge ? (judgeIdx + 1) % Math.max(1, players) : judgeIdx
    drawCategory(r, perm, () => {
      round = nextRoundNumber
      judgeIdx = nextJudge
    })
  }

  // "رجوع للإعداد" on round end, "غيّر اللاعبين والفئات" on match end —
  //   resetAll = () => { this.stopClock();
  //     this.setState({screen:'setup', round:1, tallyA:0, tallyB:0, log:[], usedCats:[], catIdx:null, reveal:null}); };
  // It leaves the banks, `active`, the pool and its indices as they were.
  const resetAll = (): void => {
    if (screen !== 'roundEnd' && screen !== 'match') return
    stopClock()
    screen = 'setup'
    round = 1
    tallyA = 0
    tallyB = 0
    log = []
    usedCats = []
    catIdx = null
    reveal = false
  }

  const view = (): OracleView => ({
    screen,
    round,
    tallyA,
    tallyB,
    active,
    display: [u.display(banks.a.time), u.display(banks.b.time)],
    started: [banks.a.started, banks.b.started],
    revealUp: reveal,
    hintIndex: hintIdx,
    questionIndex: qi,
    category: catIdx,
    used: usedCats,
    judgeIndex: judgeIdx,
    log,
  })

  return {
    arithmetic,
    step(event) {
      switch (event) {
        case 'tick':
          tick()
          return
        case 'correct':
          markCorrect()
          return
        case 'skip':
          markSkip()
          return
        case 'hint':
          giveHint()
          return
        case 'resetMatch':
          resetAll()
          return
      }
      if (event.type === 'startMatch') startMatch(event)
      else nextRound(event)
    },
    observe() {
      const last = log[log.length - 1]
      return [
        screen,
        round,
        tallyA,
        tallyB,
        active,
        u.display(banks.a.time),
        u.display(banks.b.time),
        banks.a.started,
        banks.b.started,
        reveal,
        hintIdx,
        qi,
        catIdx,
        usedCats,
        judgeIdx,
        log.length,
        last === undefined ? '' : logEntryText(last),
      ]
    },
    screen: () => screen,
    view,
    drawable(type) {
      if (type === 'startMatch') {
        // goWheel draws with the used list as it is; rematch clears it first.
        if (screen === 'ready') return choicesFrom(usedCats)
        if (screen === 'match') return choicesFrom([])
        return null
      }
      return screen === 'roundEnd' ? choicesFrom(usedCats) : null
    },
    bank: (team) => banks[team].time,
  }
}
