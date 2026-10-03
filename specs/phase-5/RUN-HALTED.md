# Run halted — 2026-10-03

**Reason:** the 🚦 verdict gate (REQ-5.24, verification.md Gate 7) produced a measurement that shows
deviations, under conditions that differ from every earlier measurement, and whether that run counts —
and what it means — is the owner's decision. Nothing has been retried.
**At:** Gate 7 — 🚦 REQ-5.24 (Setup and room-ready match the prototype in both themes).
**Measured:** see below. The verdict box is **not** ticked.

## What was run

The production build of `d3c51a1` (the commit Gate 6 passed at; HEAD `8113a5c` changes only
verification.md), served by `next start` from a fresh clone of GitHub at
`C:\Users\aalsh\AppData\Local\Temp\claude\p5g`; the prototype served read-only from `design/designs/`;
both in the desktop app's built-in Chromium; Procedure M with Tables P–R loaded into the measuring
script as fixed expectations.

**Attempt 1 — void by Procedure M's step 2, no comparison made.** The browser pane was hidden: the
prototype's tab reported a viewport **0 px** wide at DPR 1, so the prototype laid out into nothing
(column 0 px wide, 2,136.98 px tall). The app's tab was valid (497 px, DPR 1.5). With no reference
measured, nothing about the app was compared.

**Attempt 2 — the configuration "setup, 480 px, light".** The pane, re-opened, was 316 px wide and
reported itself hidden — too narrow for 480 px without emulation — so both tabs were emulated at
480 × 900, light; both reported DPR 2. The prototype's tab had been loaded **before** emulation was
set; the app's tab was reloaded **after**.

| | Prototype | App (`d3c51a1`) |
|---|---|---|
| Table P, 48 rows, within 0.5 px | **0** deviations; column **915.55** | **69** field deviations over the 48 rows; column **921.89** |
| What deviates | — | text line boxes 1–2 px taller (round label 21 vs 20, chips 36 vs 35.33, choices 40 vs 39.33, judge line 22 vs 21.33, CTA 75 vs 73.33), team tiles 106 vs 107.33, inner widths 406 vs 406.67; vertical offsets from −0.67 px (the chips) to +5.67 px (the footnote), growing down the column |
| Glyph baselines (5 compared) | — | 3 off: ↺ on team A, and the CTA's label and ▶ |
| Borders painted (diagnostic, read after) | 3 px → 2.66667, 2.5 px → 2 | the same |

The page-against-page property comparison of attempt 2 is **void for a second reason**: an error in
this session's measuring script, introduced when it was taught that `text-align: start` equals the
prototype's `right`, flagged every non-geometry property as different, equal values included (it
reported 1,345 "differences" such as `16px/400` against `16px/400`). The Table P geometry check above
does not use that code and is unaffected.

## What is known, and what is not

- **Known:** under matched conditions — both tabs at the pane's natural DPR 1.5, both loaded the same
  way — Gate 5 measured this same code (`1f3a406` = `d3c51a1` for every source file) at **0**
  differences on both screens, at 480 and 375 px, light and dark (verification.md Gate 5, ticked).
- **Not known:** whether attempt 2's deviations are (a) an artefact of the two tabs being loaded in a
  different order relative to the emulation, or (b) a real difference that appears only when a page is
  laid out at device ratio 2 — for example the self-hosted variable Baloo Bhaijaan 2 and Google's
  static instances rounding their `normal` line height differently at that ratio. **(b) would matter:
  phones are DPR 2–3**, so a host's phone would show a layout slightly taller than the prototype.

## Completed before this halt
Gates 1–6, **44 / 46** boxes, each with measured values (Gate 6 at `8113a5c`; PR #32's `ci` green on
run 37143126118).

## Still unchecked
- Gate 7: 🚦 REQ-5.24 (the verdict) · 👁 REQ-5.24 (the owner's look)

## What the user needs to decide
Whether attempt 2 counts as the verdict's one evaluation. If it counts, it is a FAIL at the first
configuration, and the phase stops on it as a finding. If it does not — because the two pages were not
loaded the same way, and the session's own script was faulty — the verdict has still not been
evaluated, and the decision is how it is next run: either straight away under a written protocol (both
tabs loaded after the emulation is set, a parity check that both paint the same borders and that the
prototype reproduces Tables P–R before the app is measured, the script's comparison fixed and shown
to report zero on two identical pages), or only after a diagnostic, outside the verdict, that settles
whether the app differs from the prototype at device ratio 2 when both are loaded identically.
