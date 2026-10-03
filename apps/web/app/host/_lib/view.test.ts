import { createRoom, reduce } from '@nel3ab/game'
import type { Action, CategoryId, RoomState } from '@nel3ab/game'
import { describe, expect, test } from 'vitest'

import { CATALOG, catalogEntry } from './catalog'
import { readyView, roundLabel, setupView, SHARE_LABEL } from './view'
import { SEED_PICKED, SEED_PLAYERS, seedRoom } from './seed'

// REQ-5.16, REQ-5.17, REQ-5.18, REQ-5.19 — specs/phase-5/verification.md Gate 4, "The view":
// `setupView` and `readyView` give every label of specs.md §2.9's view table, for the seed and for
// rooms edited through the engine's own actions. See specs.md §2.12 (this file's row).
//
// Every edited room below is reached by `reduce` from the seed, never hand-built, except where a
// test says so: what the view is asserted on is what the screens will be handed.

const SEED: RoomState = seedRoom('SKZJ62')

/** The room after `actions`, each reduced in turn from `from`. */
const after = (from: RoomState, ...actions: Action[]): RoomState =>
  actions.reduce((state, action) => reduce(state, action), from)

/** The seed with every picked category unpicked. */
const NOTHING_PICKED: RoomState = after(
  SEED,
  ...SEED_PICKED.map((categoryId): Action => ({ type: 'pickCategory', categoryId, picked: false })),
)

/** A round's start action for `categoryId`, with that entry's questions in catalog order. */
const round = (type: 'startMatch' | 'nextRound', categoryId: CategoryId): Action => ({
  type,
  categoryId,
  questions: catalogEntry(categoryId).questions,
})

describe('REQ-5.16 – REQ-5.19: setupView on the seed', () => {
  const view = setupView(SEED, CATALOG)

  test('the teams card: "5 لاعبين", both tiles, every chip', () => {
    expect(view.playerCountLabel).toBe('5 لاعبين')
    expect(view.teams).toStrictEqual({
      a: { label: 'فريق ١', name: 'النمور', members: 'ريم، نورة، ماجد' },
      b: { label: 'فريق ٢', name: 'الصقور', members: 'سعد، خالد' },
    })
    expect(view.chips).toStrictEqual([
      { id: 'seed-1', name: 'ريم', team: 'a' },
      { id: 'seed-2', name: 'سعد', team: 'b' },
      { id: 'seed-3', name: 'نورة', team: 'a' },
      { id: 'seed-4', name: 'خالد', team: 'b' },
      { id: 'seed-5', name: 'ماجد', team: 'a' },
    ])
  })

  test('the judge card: the odd-count hint, ماجد selected, rotation off', () => {
    expect(view.judgeHint).toBe('العدد فردي — يفضّل التبديل')
    expect(view.judgeOptions).toStrictEqual([
      { id: 'seed-1', name: 'ريم', selected: false },
      { id: 'seed-2', name: 'سعد', selected: false },
      { id: 'seed-3', name: 'نورة', selected: false },
      { id: 'seed-4', name: 'خالد', selected: false },
      { id: 'seed-5', name: 'ماجد', selected: true },
    ])
    expect(view.rotateOn).toBe(false)
    expect(view.rotateLabel).toBe('○ بدّل الحكم كل جولة')
  })

  test('the categories rail: "8 من 11 مختارة" and each of the eleven tiles with its tag', () => {
    expect(view.pickedLabel).toBe('8 من 11 مختارة')
    expect(view.tiles).toStrictEqual([
      { id: 'industry', name: 'صناعة', emoji: '🏭', locked: false, selected: true, tag: 'مختارة' },
      { id: 'animals', name: 'حيوانات', emoji: '🦁', locked: false, selected: true, tag: 'مختارة' },
      { id: 'nature', name: 'طبيعة', emoji: '🌋', locked: false, selected: true, tag: 'مختارة' },
      {
        id: 'society',
        name: 'إنسان ومجتمع',
        emoji: '🌍',
        locked: false,
        selected: true,
        tag: 'مختارة',
      },
      {
        id: 'culture',
        name: 'ثقافة',
        emoji: '🎎',
        locked: true,
        selected: false,
        tag: '🔒 مدفوعة',
      },
      { id: 'proverbs', name: 'أمثال', emoji: '💬', locked: false, selected: true, tag: 'مختارة' },
      { id: 'history', name: 'تاريخ', emoji: '🏛️', locked: false, selected: true, tag: 'مختارة' },
      { id: 'religion', name: 'دين', emoji: '🕌', locked: false, selected: true, tag: 'مختارة' },
      { id: 'art', name: 'فن', emoji: '🎨', locked: true, selected: false, tag: '🔒 مدفوعة' },
      { id: 'movies', name: 'أفلام', emoji: '🎬', locked: true, selected: false, tag: '🔒 مدفوعة' },
      { id: 'science', name: 'علوم', emoji: '🔬', locked: false, selected: true, tag: 'مختارة' },
    ])
  })

  test('the start button and the footnote: canStart, and the note with 45', () => {
    expect(view.canStart).toBe(true)
    expect(view.setupNote).toBe('الحكم يشوف الإجابات · 45 ثانية لكل فريق · ما تحتاج تسجّل دخول')
  })

  test('the view holds exactly the fields of specs.md §2.9, and nothing of the room it does not show', () => {
    expect(Object.keys(view).sort()).toStrictEqual(
      [
        'playerCountLabel',
        'teams',
        'chips',
        'judgeHint',
        'judgeOptions',
        'rotateOn',
        'rotateLabel',
        'pickedLabel',
        'tiles',
        'canStart',
        'setupNote',
      ].sort(),
    )
    // The catalog's questions never reach a screen through the view.
    expect(JSON.stringify(view)).not.toContain('سؤال تجريبي')
  })
})

describe('REQ-5.16 – REQ-5.19: setupView on edited rooms', () => {
  test('a player removed: "4 لاعبين", the even-count hint, ماجد still selected', () => {
    const view = setupView(after(SEED, { type: 'removePlayer', playerId: 'seed-2' }), CATALOG)
    expect(view.playerCountLabel).toBe('4 لاعبين')
    expect(view.judgeHint).toBe('ثابت طول المباراة')
    expect(view.teams.b.members).toBe('خالد')
    expect(view.chips.map(({ name }) => name)).toStrictEqual(['ريم', 'نورة', 'خالد', 'ماجد'])
    expect(view.judgeOptions.filter(({ selected }) => selected)).toStrictEqual([
      { id: 'seed-5', name: 'ماجد', selected: true },
    ])
  })

  test('ريم swapped: her chip on b, the members "نورة، ماجد" / "ريم، سعد، خالد"', () => {
    const view = setupView(after(SEED, { type: 'swapTeam', playerId: 'seed-1' }), CATALOG)
    expect(view.teams.a.members).toBe('نورة، ماجد')
    expect(view.teams.b.members).toBe('ريم، سعد، خالد')
    expect(view.chips[0]).toStrictEqual({ id: 'seed-1', name: 'ريم', team: 'b' })
    expect(view.playerCountLabel).toBe('5 لاعبين')
  })

  test('a team with nobody: "بدون لاعبين", on either side', () => {
    const noA = after(
      SEED,
      { type: 'swapTeam', playerId: 'seed-1' },
      { type: 'swapTeam', playerId: 'seed-3' },
      { type: 'swapTeam', playerId: 'seed-5' },
    )
    expect(setupView(noA, CATALOG).teams).toStrictEqual({
      a: { label: 'فريق ١', name: 'النمور', members: 'بدون لاعبين' },
      b: { label: 'فريق ٢', name: 'الصقور', members: 'ريم، سعد، نورة، خالد، ماجد' },
    })
    const noB = after(
      SEED,
      { type: 'removePlayer', playerId: 'seed-2' },
      { type: 'removePlayer', playerId: 'seed-4' },
    )
    expect(setupView(noB, CATALOG).teams.b.members).toBe('بدون لاعبين')
  })

  test('no players at all: "0 لاعبين", both teams empty, no chips, no choices', () => {
    const empty = after(
      SEED,
      ...SEED_PLAYERS.map(({ id }): Action => ({ type: 'removePlayer', playerId: id })),
    )
    const view = setupView(empty, CATALOG)
    expect(view.playerCountLabel).toBe('0 لاعبين')
    expect([view.teams.a.members, view.teams.b.members]).toStrictEqual([
      'بدون لاعبين',
      'بدون لاعبين',
    ])
    expect(view.judgeHint).toBe('ثابت طول المباراة')
    expect(view.chips).toStrictEqual([])
    expect(view.judgeOptions).toStrictEqual([])
  })

  test('the teams renamed: each tile shows its name as typed — "x" and "" included', () => {
    const view = setupView(
      after(
        SEED,
        { type: 'renameTeam', team: 'a', name: 'x' },
        { type: 'renameTeam', team: 'b', name: '' },
      ),
      CATALOG,
    )
    expect([view.teams.a.name, view.teams.b.name]).toStrictEqual(['x', ''])
    expect([view.teams.a.label, view.teams.b.label]).toStrictEqual(['فريق ١', 'فريق ٢'])
  })

  test('another judge chosen: only ريم selected', () => {
    const view = setupView(after(SEED, { type: 'setJudge', playerId: 'seed-1' }), CATALOG)
    expect(view.judgeOptions.map(({ selected }) => selected)).toStrictEqual([
      true,
      false,
      false,
      false,
      false,
    ])
  })

  test('a judge index past the end selects no choice — `===`, not modulo, as the prototype writes it', () => {
    // Hand-built: no action produces it; the prototype's `i === s.judgeIdx` against its getter's modulo.
    const past: RoomState = { ...SEED, judgeIndex: 7 }
    expect(setupView(past, CATALOG).judgeOptions.some(({ selected }) => selected)).toBe(false)
    expect(readyView(past).judgeName).toBe('نورة')
  })

  test('rotation on, then off again: both labels', () => {
    const on = after(SEED, { type: 'setRotateJudge', rotate: true })
    expect([setupView(on, CATALOG).rotateOn, setupView(on, CATALOG).rotateLabel]).toStrictEqual([
      true,
      '✔ بدّل الحكم كل جولة',
    ])
    const off = after(on, { type: 'setRotateJudge', rotate: false })
    expect([setupView(off, CATALOG).rotateOn, setupView(off, CATALOG).rotateLabel]).toStrictEqual([
      false,
      '○ بدّل الحكم كل جولة',
    ])
  })

  test('nothing picked: "0 من 11 مختارة", no free tile tagged, the locked still "🔒 مدفوعة", canStart false', () => {
    const view = setupView(NOTHING_PICKED, CATALOG)
    expect(view.pickedLabel).toBe('0 من 11 مختارة')
    expect(view.tiles.map(({ tag }) => tag)).toStrictEqual([
      '',
      '',
      '',
      '',
      '🔒 مدفوعة',
      '',
      '',
      '',
      '🔒 مدفوعة',
      '🔒 مدفوعة',
      '',
    ])
    expect(view.tiles.some(({ selected }) => selected)).toBe(false)
    expect(view.canStart).toBe(false)
  })

  test('one unpicked: "7 من 11 مختارة", its tag ""; re-picked: "8 من 11 مختارة", "مختارة" again', () => {
    const unpicked = after(SEED, { type: 'pickCategory', categoryId: 'industry', picked: false })
    const view = setupView(unpicked, CATALOG)
    expect(view.pickedLabel).toBe('7 من 11 مختارة')
    expect(view.tiles[0]).toMatchObject({ id: 'industry', selected: false, tag: '' })
    const repicked = setupView(
      after(unpicked, { type: 'pickCategory', categoryId: 'industry', picked: true }),
      CATALOG,
    )
    expect(repicked.pickedLabel).toBe('8 من 11 مختارة')
    expect(repicked.tiles[0]).toMatchObject({ id: 'industry', selected: true, tag: 'مختارة' })
    expect(repicked.canStart).toBe(true)
  })

  test('a locked category picked (the engine records it): selected, and still tagged "🔒 مدفوعة"', () => {
    const view = setupView(
      after(SEED, { type: 'pickCategory', categoryId: 'culture', picked: true }),
      CATALOG,
    )
    expect(view.pickedLabel).toBe('9 من 11 مختارة')
    expect(view.tiles[4]).toStrictEqual({
      id: 'culture',
      name: 'ثقافة',
      emoji: '🎎',
      locked: true,
      selected: true,
      tag: '🔒 مدفوعة',
    })
  })

  test('the counts are the room and the catalog given: "1 من 2 مختارة" over a two-tile catalog', () => {
    const two = [catalogEntry('industry'), catalogEntry('culture')]
    const view = setupView(
      after(NOTHING_PICKED, { type: 'pickCategory', categoryId: 'industry', picked: true }),
      two,
    )
    expect(view.pickedLabel).toBe('1 من 2 مختارة')
    expect(view.tiles.map(({ id, tag }) => [id, tag])).toStrictEqual([
      ['industry', 'مختارة'],
      ['culture', '🔒 مدفوعة'],
    ])
  })

  test("the footnote reads the room's round length: 60 in a room of 60 s", () => {
    const sixty: RoomState = {
      ...createRoom({
        roomCode: 'SKZJ62',
        teamA: 'النمور',
        teamB: 'الصقور',
        config: { roundSeconds: 60, winsNeeded: 3 },
      }),
      players: SEED_PLAYERS,
      pickedCategories: SEED_PICKED,
    }
    expect(setupView(sixty, CATALOG).setupNote).toBe(
      'الحكم يشوف الإجابات · 60 ثانية لكل فريق · ما تحتاج تسجّل دخول',
    )
  })

  test('on room-ready the engine refuses setup edits, so the view does not change', () => {
    const ready = after(SEED, { type: 'openRoom' })
    const edited = after(ready, { type: 'removePlayer', playerId: 'seed-2' })
    expect(edited).toBe(ready)
    // canStart reads the screen as well: the guard is the engine's, on setup only. Every other
    // field is the seed's.
    expect(setupView(ready, CATALOG)).toStrictEqual({
      ...setupView(SEED, CATALOG),
      canStart: false,
    })
  })
})

describe('REQ-5.15, REQ-5.20: roundLabel and readyView', () => {
  const READY = after(SEED, { type: 'openRoom' })

  test('readyView on room-ready: "إعداد", the code, ماجد judging, five chips', () => {
    expect(readyView(READY)).toStrictEqual({
      roundLabel: 'إعداد',
      roomCode: 'SKZJ62',
      judgeName: 'ماجد',
      chips: [
        { id: 'seed-1', name: 'ريم', team: 'a' },
        { id: 'seed-2', name: 'سعد', team: 'b' },
        { id: 'seed-3', name: 'نورة', team: 'a' },
        { id: 'seed-4', name: 'خالد', team: 'b' },
        { id: 'seed-5', name: 'ماجد', team: 'a' },
      ],
    })
    // The screen writes "الحكم: " before the name.
    expect(`الحكم: ${readyView(READY).judgeName}`).toBe('الحكم: ماجد')
  })

  test('another judge, the fill, and no judge at all ("—")', () => {
    const judgedByRim = after(SEED, { type: 'setJudge', playerId: 'seed-1' }, { type: 'openRoom' })
    expect(readyView(judgedByRim).judgeName).toBe('ريم')
    // Only ريم and سعد left: no fill needed, one a and one b — the judge index follows the removals.
    const pair = after(
      SEED,
      { type: 'removePlayer', playerId: 'seed-3' },
      { type: 'removePlayer', playerId: 'seed-4' },
      { type: 'removePlayer', playerId: 'seed-5' },
      { type: 'openRoom' },
    )
    expect(readyView(pair).chips.map(({ name }) => name)).toStrictEqual(['ريم', 'سعد'])
    expect(readyView(pair).judgeName).toBe('سعد')
    // Everyone removed, then opened: the prototype's fill — "لاعب ١" and "لاعب ٢".
    const none = after(
      SEED,
      ...SEED_PLAYERS.map(({ id }): Action => ({ type: 'removePlayer', playerId: id })),
    )
    expect(readyView(none).judgeName).toBe('—')
    expect(readyView(none).chips).toStrictEqual([])
    const filled = readyView(after(none, { type: 'openRoom' }))
    expect(filled.chips).toStrictEqual([
      { id: 'fill-1', name: 'لاعب ١', team: 'a' },
      { id: 'fill-2', name: 'لاعب ٢', team: 'b' },
    ])
    expect(filled.judgeName).toBe('لاعب ١')
  })

  test('"إعداد" on setup and room-ready; "جولة N — أول 3 جولات" on play, round end and match end', () => {
    expect(roundLabel(SEED)).toBe('إعداد')
    expect(roundLabel(READY)).toBe('إعداد')

    const play1 = after(READY, round('startMatch', 'proverbs'))
    expect(play1.screen).toBe('play')
    expect(roundLabel(play1)).toBe('جولة 1 — أول 3 جولات')
    // Team a's bank runs out: b takes round 1.
    const end1 = after(play1, { type: 'tick', ms: 45_000 })
    expect([end1.screen, end1.tallyB]).toStrictEqual(['roundEnd', 1])
    expect(roundLabel(end1)).toBe('جولة 1 — أول 3 جولات')
    const play2 = after(end1, round('nextRound', 'society'))
    expect([play2.screen, play2.round]).toStrictEqual(['play', 2])
    expect(roundLabel(play2)).toBe('جولة 2 — أول 3 جولات')
    expect(readyView(play2).roundLabel).toBe('جولة 2 — أول 3 جولات')

    // Rounds 2–5 run out in turn — a, b, a, b — and b takes the match 3–2 in round 5.
    let state = play2
    const categories: CategoryId[] = ['history', 'nature', 'religion']
    for (const next of categories) {
      state = after(state, { type: 'tick', ms: 45_000 }, round('nextRound', next))
    }
    state = after(state, { type: 'tick', ms: 45_000 })
    expect([state.screen, state.round, state.tallyA, state.tallyB]).toStrictEqual([
      'match',
      5,
      2,
      3,
    ])
    expect(roundLabel(state)).toBe('جولة 5 — أول 3 جولات')
    // Back to setup from the match: "إعداد" again.
    expect(roundLabel(after(state, { type: 'resetMatch' }))).toBe('إعداد')
  })

  test("the round label reads the room's wins needed: 'أول 2 جولات' in a room of 2", () => {
    const two: RoomState = {
      ...createRoom({
        roomCode: 'SKZJ62',
        teamA: 'النمور',
        teamB: 'الصقور',
        config: { roundSeconds: 45, winsNeeded: 2 },
      }),
      players: SEED_PLAYERS,
      pickedCategories: SEED_PICKED,
    }
    const play = after(two, { type: 'openRoom' }, round('startMatch', 'proverbs'))
    expect(roundLabel(play)).toBe('جولة 1 — أول 2 جولات')
  })

  test('the share button reads "مشاركة" while no outcome is flashing', () => {
    expect(SHARE_LABEL).toBe('مشاركة')
  })
})
