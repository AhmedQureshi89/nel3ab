# Fonts — provenance and licence

Both families are self-hosted (`tech-specs.md` §2.1 — "Google Fonts CDN is not used in
production"). This repository is **public** (`mission.md` A-1), so the binaries below are
redistributed to the world; REQ-2.2 makes that a licensed act rather than an assumed one.

Nothing here may be replaced or added to without repeating the licence check in
`specs/phase-2/verification.md` Gate 0 for the new file.

## Licences

Both families are under the **SIL Open Font License, Version 1.1**, read from each family's own
source of record — not from a summary, a blog, or an assumption about what Google Fonts ships.
The verbatim texts are committed beside the binaries as `LICENSE-BalooBhaijaan2.txt` and
`LICENSE-Archivo.txt`.

| Family           | Licence     | Copyright line                                                                         | Read from                                                                        |
| ---------------- | ----------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Baloo Bhaijaan 2 | SIL OFL 1.1 | `Copyright 2019 The Baloo 2 Project Authors (https://github.com/EkType/Baloo2)`        | `EkType/Baloo2-Variable`, `OFL.txt` @ `da4090c1dd5798a3e72d7138e379ee1f94d6349c` |
| Archivo          | SIL OFL 1.1 | `Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo)` | `Omnibus-Type/Archivo`, `OFL.txt` @ `b5d63988ce19d044d3e10362de730af00526b672`   |

The clause that grants redistribution is identical in both files, under `PERMISSION & CONDITIONS`:

> Permission is hereby granted, free of charge, to any person obtaining
> a copy of the Font Software, to use, study, copy, merge, embed, modify,
> **redistribute**, and sell modified and unmodified copies of the Font
> Software, subject to the following conditions:

The conditions that bind this repository:

1. **Not sold by itself.** The fonts are shipped as part of the application, never as a product.
2. **The notice travels with the copy** — "Each copy … must contain the above copyright notice
   and this license." This is why the two `LICENSE-*.txt` files sit in the same directory as the
   binaries rather than in a licences folder elsewhere.
3. **Reserved Font Names.** Neither copyright line declares one ("with Reserved Font Name" is
   absent from both), so a format conversion that keeps the family name is permitted. If either
   upstream ever adds an RFN, a converted file must be renamed — re-check before upgrading.
4. **No endorsement** is claimed from Ek Type or Omnibus-Type.
5. **Derivatives stay under the OFL** — so the converted `.woff2` files are OFL, not
   this repository's licence.

Neither licence restricts the medium of redistribution, so committing the files to a public
source repository is permitted on the same terms as shipping them in a build.

## Sources of record

`Baloo Bhaijaan 2` is the Arabic member of the Baloo 2 superfamily. Google Fonts' own
`ofl/baloobhaijaan2/METADATA.pb` names `EkType/Baloo2-Variable` as its upstream, which is the
repository read above — the Indic-only `EkType/Baloo2` is a different repository and does not
carry the Arabic family.

| Family           | Upstream repository                       | Files taken                                                                       | Form                       |
| ---------------- | ----------------------------------------- | --------------------------------------------------------------------------------- | -------------------------- |
| Baloo Bhaijaan 2 | https://github.com/EkType/Baloo2-Variable | `fonts/variable/BalooBhaijaan2[wght].ttf`                                         | variable, `wght` 400–800   |
| Archivo          | https://github.com/Omnibus-Type/Archivo   | `fonts/webfonts/Archivo-SemiBold.woff2`, `fonts/webfonts/Archivo-ExtraBold.woff2` | static, `wght` 600 and 800 |

Each upstream commit is the one whose `OFL.txt` was read above, so the licence and the binaries are
the same revision.

**Baloo Bhaijaan 2 ships as its variable file** — one file covers all four weights this phase needs
(500/600/700/800, REQ-2.3), which is what `specs.md` §2.1 prefers. Upstream publishes it only as
`.ttf`, so it is converted to `.woff2` (below).

**Archivo ships as two static instances, not its variable file** — a departure from `specs.md`
§2.1's preference, made at STEP 5 with the owner's approval of 2026-09-29, and replacing the plan
this README recorded at Gate 0. The variable file (`fonts/variable/Archivo[wdth,wght].ttf`,
658,596 bytes) carries a `wdth` axis nothing here uses and exists upstream only as `.ttf`, so it
would need converting. The static `fonts/webfonts/*.woff2` are the project's own web fonts: they
are committed **unmodified**, so their hashes are upstream's hashes (NFR-2.4 asks for exactly
that), and together they are 103,940 bytes.

Neither file was fetched from `https://fonts.googleapis.com/css2?…`: that endpoint returns
unicode-range-sliced subsets tied to the requesting user agent, which is neither reproducible nor
recordable as provenance.

## Committed font files

One row per committed file. The SHA-256 was computed **after** the binaries were committed (commit
`d85508578d1cbb6b0df9f93d856805631f71057b`) and cloned fresh with `git clone --no-local`, never
from the downloaded file. Hashing the download would prove nothing about what git stored:
`.gitattributes` disables EOL normalisation only for paths that match `*.woff2`, and a mis-named
binary is corrupted silently on a Windows checkout and fails only in a browser.

| File                            | Bytes   | Upstream file (at the commit in the table above)                 | Font version | Retrieved  | SHA-256 (post-checkout)                                            |
| ------------------------------- | ------- | ---------------------------------------------------------------- | ------------ | ---------- | ------------------------------------------------------------------ |
| `BalooBhaijaan2-Variable.woff2` | 105,244 | `fonts/variable/BalooBhaijaan2[wght].ttf` — converted, see below | 1.701        | 2026-09-29 | `6c9220d84ae3185c601fc648e7081658130421e24c8b4d727ca9f68427d7fe8c` |
| `Archivo-SemiBold.woff2`        | 51,104  | `fonts/webfonts/Archivo-SemiBold.woff2` — unmodified             | 2.001        | 2026-09-29 | `5eb4dd14550d2c8771c20a8907fb17f0e9bcf57aa017fbc2cf571897b23a4135` |
| `Archivo-ExtraBold.woff2`       | 52,836  | `fonts/webfonts/Archivo-ExtraBold.woff2` — unmodified            | 2.001        | 2026-09-29 | `8cc0e60eef220aac8cbd4835928eb7bb89514f2e1458d130004a9f0283ad1c79` |

**Checking a file against upstream.** Each download was compared with the upstream tree entry
before use: its git blob id (`git hash-object`) equals the blob id upstream records for that path.

| Upstream file                             | Bytes   | Git blob (upstream = download)             | SHA-256 of the download                                            |
| ----------------------------------------- | ------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `fonts/variable/BalooBhaijaan2[wght].ttf` | 285,508 | `153e138c83079da5eb374f8de4637d1c0df5f2a4` | `3e9f07fbc796c0ddcb3e6e0aa26f9c86741d9f5b7f5cb72f4ed3c06e55a19336` |
| `fonts/webfonts/Archivo-SemiBold.woff2`   | 51,104  | `8e0f912ad0b7c7c5549bd2a5585ab3fb5c6ae77b` | `5eb4dd14550d2c8771c20a8907fb17f0e9bcf57aa017fbc2cf571897b23a4135` |
| `fonts/webfonts/Archivo-ExtraBold.woff2`  | 52,836  | `dfa845b9e174c9f64f84153c574be88a73841dd8` | `8cc0e60eef220aac8cbd4835928eb7bb89514f2e1458d130004a9f0283ad1c79` |

The two Archivo files are unmodified, so their post-checkout SHA-256 equals the download's and
their committed blob equals upstream's.

### The Baloo Bhaijaan 2 conversion

`.ttf` → `.woff2` with **fontTools 4.66.0** and **brotli 1.2.0** (Python 3.14.3):

```python
from fontTools.ttLib import TTFont

font = TTFont('BalooBhaijaan2[wght].ttf', recalcTimestamp=False)
font.flavor = 'woff2'
font.save('BalooBhaijaan2-Variable.woff2', reorderTables=False)
```

- **Lossless.** Decompressed again, all 20 tables compare equal to the source's as TTX, with two
  expected exceptions in `head`: `flags` gains bit 11, which OpenType defines as "font data is
  lossless as a result of having been subjected to optimizing transformation and/or compression
  (… WOFF 2.0 …)", and `checkSumAdjustment` follows from that. The `wght` axis (400–800), its five
  named instances, 1,278 glyphs, 103 Arabic code points (U+0600–06FF) and the OFL name records all
  survive.
- **Reproducible.** `recalcTimestamp=False` keeps upstream's `head.modified`, so the output does
  not carry the conversion time: two runs gave the same SHA-256. Re-running the snippet with the
  same tool versions reproduces the hash above.
- **The family name is kept**, which the OFL permits because neither family declares a Reserved
  Font Name (see _Licences_).

## Dates

- Licence texts retrieved and read: **2026-08-20** (REQ-2.2, Gate 0 verdict gate).
- Font files retrieved, converted and committed: **2026-09-29** (REQ-2.2, STEP 5).
