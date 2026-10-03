// TEMPORARY — Phase 6 replaces this on `play`, and Phase 7 on `roundEnd` and `match`.
//
// REQ-5.15 — specs/phase-5/specs.md §2.11, `PendingScreen.tsx`. What the column shows once a
// match has started, until the play, round-end and match-end screens exist: the screen's key,
// the round, and each team's name, clock and tally — plain text in a `Panel`. It has no
// prototype counterpart and is not compared with one.
//
// No button, no question, no answer and no hint: nothing on it can be pressed (requirements.md
// §4), and the round's question content stays off it. The clock is the engine's
// `displaySeconds(remainingMs(clock, team))`, re-rendered on every 100 ms step of the driver's
// loop. The screen key and the numbers are Latin runs inside Arabic text, isolated by
// `.ltr-num` (NFR-5.8).

import { displaySeconds, remainingMs } from '@nel3ab/game'
import type { RoomState, Team } from '@nel3ab/game'
import { Panel } from '@nel3ab/ui'

export interface PendingScreenProps {
  readonly state: RoomState
}

export function PendingScreen({ state }: PendingScreenProps) {
  const teams: readonly { readonly team: Team; readonly name: string; readonly tally: number }[] = [
    { team: 'a', name: state.teamA, tally: state.tallyA },
    { team: 'b', name: state.teamB, tally: state.tallyB },
  ]
  return (
    <Panel>
      <p>
        <span className="ltr-num">{state.screen}</span>
      </p>
      <p>
        الجولة <span className="ltr-num">{state.round}</span>
      </p>
      {teams.map(({ team, name, tally }) => (
        <p key={team} data-team={team}>
          {name} — الوقت{' '}
          <span className="ltr-num">{displaySeconds(remainingMs(state.clock, team))}</span> ·
          الجولات <span className="ltr-num">{tally}</span>
        </p>
      ))}
    </Panel>
  )
}
