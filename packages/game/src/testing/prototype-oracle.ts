// Test support (Phase 3) — the prototype oracle. REQ-3.4, REQ-3.11.
// See specs/phase-3/specs.md §2.8 ("prototype-oracle.ts") and
// specs/phase-3/verification.md, "Pre-registered values", Tables A, B and D.
//
// A TRANSCRIPTION of the clock and spend code of the prototype's behaviour
// class in design/designs/Nel3ab - Arcade.dc.html — `startRound`, `startClock`
// (its interval body), `stopClock`, `spend`, `nextQuestion`, `markCorrect`,
// `markSkip`, `giveHint`, `endRound` and the `question` getter — with every
// branch commented with the method it comes from. It is written by reading the
// file, not by importing or executing it: design/ is HTML to reproduce, never
// code to copy (CLAUDE.md invariant 5), and what is taken from it is the
// control flow and the arithmetic only.
//
// ONE function, TWO arithmetics (specs.md §2.8). Only the numbers differ — they
// are `UNITS` below — and everything else, the `v <= 0` test included, is one
// piece of code, so the two cannot differ in control flow:
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
// ONE TURN. The oracle models what Phase 3's reducer covers: the starting
// team's bank runs, the other stays full. The prototype's `passTurn` (the
// reveal's 1000ms hold, the turn passing) is Phase 4's, so here a reveal, once
// up, stays up — as the engine's does (requirements.md §1.3).
//
// GUARD ORDER, per the prototype: every event is inert once the round has
// ended or the reveal is up (`stopClock` cleared the interval, and the judge
// handlers return on `!this.clockId || this.state.reveal`); a hint is inert
// when the current question — `pool[qi % length]` — has no hints left, BEFORE
// any spend; a spend that ends the round returns before advancing an index.
//
// Observation: the 6-tuple (display a, display b, ended, reveal up, hintIndex,
// questionIndex) — the same shape the harness reads off the engine.
//
// Test support: excluded from coverage (REQ-3.12's second exclusion), never
// exported from index.ts, imported only by `*.test.ts` and by other files
// under `testing/`.

import type { Question, Team } from '../types.js'
import type { Event } from './sequences.js'

export type Arithmetic = 'float' | 'exact'

/**
 * An observation (specs.md §2.8): the 6-tuple (display a, display b, ended,
 * reveal up, hintIndex, questionIndex). The oracle's and the engine's (read by
 * `testing/harness.ts`) have this one shape, which is what the lockstep
 * comparison compares.
 */
export type Observation = readonly [
  displayA: number,
  displayB: number,
  ended: boolean,
  revealUp: boolean,
  hintIndex: number,
  questionIndex: number,
]

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

/** One round of the prototype, one turn long, in one arithmetic. */
export interface PrototypeOracle {
  readonly arithmetic: Arithmetic
  /** Apply one event through the prototype's handler for it: `startClock`'s interval for 'tick', else `giveHint` · `markSkip` · `markCorrect`. */
  step(event: Event): void
  /** The observation now. */
  observe(): Observation
  /** The round has ended, or the reveal is up — the stop rule's trigger (specs.md §2.8). */
  terminal(): boolean
  /** `endRound`'s `loserKey` — the team whose bank emptied; `null` while the round has not ended. */
  loser(): Team | null
  /** A team's bank, in this arithmetic's own unit: seconds for 'float', tenths for 'exact'. */
  bank(team: Team): number
}

/**
 * The prototype's `startRound` for `startingTeam` with `pool` as its question
 * pool, in `arithmetic`: both banks full, only the starting team's running.
 */
export function prototypeOracle(
  arithmetic: Arithmetic,
  roundSeconds: number,
  startingTeam: Team,
  pool: readonly [Question, ...Question[]],
): PrototypeOracle {
  const u = UNITS[arithmetic]

  // The prototype's state, as far as one turn of one round reads it.
  /** `this.state.a.time`, `this.state.b.time`. */
  const time: Record<Team, number> = { a: 0, b: 0 }
  /** `this.state.active` — never changes in one turn (`passTurn` is Phase 4's). */
  const active: Team = startingTeam
  /** `this.clockId !== null`: the interval exists, so a tick fires and the judge's handlers pass their first guard. */
  let clockId = false
  /** `this.state.screen === 'play'`; `endRound` leaves it for 'roundEnd' or 'match' — both "ended" here. */
  let playing = false
  /** `this.state.reveal !== null`. */
  let reveal = false
  /** `this.state.qi`, `this.state.hintIdx`. */
  let qi = 0
  let hintIdx = 0
  /** The `loserKey` `endRound` was called with. */
  let loserKey: Team | null = null

  // get question(){ const p = this.state.pool; return p.length ? p[this.state.qi % p.length] : CATS[0].qs[0]; }
  // The `CATS[0].qs[0]` fallback is for an empty pool, which a round here
  // never has: the pool is a non-empty tuple, and the engine's `startRound`
  // throws on an empty one.
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

  // endRound(loserKey){ if(this.state.screen !== 'play') return; this.stopClock(); clearTimeout(this.revealId); … }
  const endRound = (key: Team): void => {
    // endRound: `if(this.state.screen !== 'play') return;`
    if (!playing) return
    // endRound: `this.stopClock();` — and `clearTimeout(this.revealId)`, the
    // reveal's hold timer, which one turn never reaches: once a reveal is up,
    // nothing below can run.
    stopClock()
    // endRound: `screen: done ? 'match' : 'roundEnd', …, reveal:null`. Which of
    // the two, and the tally, `roundWinner` and log entry, are Phase 4's.
    playing = false
    reveal = false
    loserKey = key
  }

  // spend(sec){ const key = this.state.active, cur = this.state[key];
  //   const time = Math.max(0, cur.time - sec); this.setState({[key]: {...cur, time}});
  //   if(time <= 0){ this.endRound(key); return true; } return false; }
  const spend = (sec: number): boolean => {
    const key = active
    const left = Math.max(0, time[key] - sec)
    time[key] = left
    // spend: `if(time <= 0){ this.endRound(key); return true; }`
    if (left <= 0) {
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
    // runs on a reveal (`markCorrect`) and on a round end (`endRound`).
    if (!clockId) return
    // startClock: `if(this.state.reveal) return;`
    if (reveal) return
    const key = active
    const left = Math.max(0, time[key] - u.tick)
    time[key] = left
    // startClock: the setState callback, `if(time <= 0) this.endRound(key);`
    if (left <= 0) endRound(key)
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
    // markCorrect: `setTimeout(() => this.passTurn(), 1000)` — the hold and the
    // turn passing are Phase 4's. One turn: the reveal stays up.
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

  // startRound = () => { … this.setState(s => ({ screen:'play', …, qi:0, hintIdx:0, reveal:null,
  //   active: start, [start]: {time:this.roundTime, started:true}, [other]: {time:this.roundTime, started:false}
  // }), () => this.startClock()); };
  // The category draw, the shuffle and `usedCats` are Phase 4's: the pool is
  // given, in order, as the engine's `startRound` takes it.
  time.a = u.full(roundSeconds)
  time.b = u.full(roundSeconds)
  playing = true
  qi = 0
  hintIdx = 0
  reveal = false
  startClock()

  return {
    arithmetic,
    step(event) {
      switch (event) {
        case 'tick':
          interval()
          return
        case 'hint':
          giveHint()
          return
        case 'skip':
          markSkip()
          return
        case 'correct':
          markCorrect()
          return
      }
    },
    observe: () => [u.display(time.a), u.display(time.b), !playing, reveal, hintIdx, qi],
    terminal: () => !playing || reveal,
    loser: () => loserKey,
    bank: (team) => time[team],
  }
}
