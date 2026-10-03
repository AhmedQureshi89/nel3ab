'use client'

// REQ-5.10, REQ-5.15 – REQ-5.21 — the judge app. See specs/phase-5/specs.md §2.11, `HostApp.tsx`.
//
// One room per page load, held for as long as the page is open (REQ-5.10): the local driver
// (`_lib/driver.ts`), created once by a lazy `useState` initialiser and read through
// `useSyncExternalStore`, whose server snapshot is the same `getState`. The effect's cleanup stops
// the driver's clock loop; the room stays usable, so React's development double-mount loses
// nothing (specs.md §2.9, `dispose`).
//
// Nothing random is rendered before the host's first action. The room code — the only random
// value created before then — shows on room-ready only, so the server-rendered page and the
// hydrated one are the same markup (REQ-5.10; specs.md §4, R4). `host-markup.test.tsx` renders
// this component under two different random sources and requires identical markup.
//
// It renders the frame — the prototype's screen root, its 440px column and its header row (the
// brand mark, "نلعب", the round label) — and, by the room's screen, the setup screen, the
// room-ready screen or the temporary placeholder. The prototype's debug top bar (judge / player,
// day / night) does not exist in any form (REQ-5.15): the theme follows the device.
//
// The share outcome is held here, above the screens, so it outlives a trip to setup exactly as
// the prototype's does (REQ-5.21). Pressing share hands the room code to `shareRoom` with the
// page's `navigator`; a dismissed share sheet (`null`) flashes nothing. The flash's countdown is
// cleared when the page goes.
//
// Every action a screen sends goes through the driver: the setup edits and `openRoom` /
// `backToSetup` through `dispatch`, the shuffle through `shuffleTeamName`, and the match's start
// through `startMatch`, which draws the round first (REQ-5.11, REQ-5.13).

import { useEffect, useState, useSyncExternalStore } from 'react'

import { CATALOG } from './_lib/catalog'
import { createLocalRoom } from './_lib/driver'
import { createFlash } from './_lib/flash'
import { shareRoom } from './_lib/share'
import { readyView, roundLabel, setupView } from './_lib/view'
import styles from './host.module.css'
import { PendingScreen } from './PendingScreen'
import { ReadyScreen } from './ReadyScreen'
import { SetupScreen } from './SetupScreen'

export function HostApp() {
  const [room] = useState(() => createLocalRoom())
  useEffect(() => () => room.dispose(), [room])
  const state = useSyncExternalStore(room.subscribe, room.getState, room.getState)
  const [shareLabel, setShareLabel] = useState<string | null>(null)
  const [flash] = useState(() => createFlash(setShareLabel))
  useEffect(() => () => flash.dispose(), [flash])

  const share = (): void => {
    void shareRoom(state.roomCode, navigator).then((label) => {
      if (label !== null) flash.show(label)
    })
  }

  return (
    <div className={styles.page} data-screen={state.screen}>
      <div className={styles.stage}>
        <div className={styles.column}>
          <div className={styles.header}>
            <div className={styles.brand}>
              <span className={styles.mark} />
              نلعب
            </div>
            <div className={styles.round}>{roundLabel(state)}</div>
          </div>

          {state.screen === 'setup' ? (
            <SetupScreen
              view={setupView(state, CATALOG)}
              onShuffleTeamName={room.shuffleTeamName}
              onRenameTeam={(team, name) => room.dispatch({ type: 'renameTeam', team, name })}
              onSwapTeam={(playerId) => room.dispatch({ type: 'swapTeam', playerId })}
              onRemovePlayer={(playerId) => room.dispatch({ type: 'removePlayer', playerId })}
              onSetJudge={(playerId) => room.dispatch({ type: 'setJudge', playerId })}
              onSetRotateJudge={(rotate) => room.dispatch({ type: 'setRotateJudge', rotate })}
              onPickCategory={(categoryId, picked) =>
                room.dispatch({ type: 'pickCategory', categoryId, picked })
              }
              onOpenRoom={() => room.dispatch({ type: 'openRoom' })}
            />
          ) : state.screen === 'ready' ? (
            <ReadyScreen
              view={readyView(state)}
              shareLabel={shareLabel}
              onShare={share}
              onStart={room.startMatch}
              onBack={() => room.dispatch({ type: 'backToSetup' })}
            />
          ) : (
            <PendingScreen state={state} />
          )}
        </div>
      </div>
    </div>
  )
}
