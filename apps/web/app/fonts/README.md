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

| Family           | Upstream repository                       | File taken                                | Axis                          |
| ---------------- | ----------------------------------------- | ----------------------------------------- | ----------------------------- |
| Baloo Bhaijaan 2 | https://github.com/EkType/Baloo2-Variable | `fonts/variable/BalooBhaijaan2[wght].ttf` | `wght` 400–800                |
| Archivo          | https://github.com/Omnibus-Type/Archivo   | `fonts/variable/Archivo[wdth,wght].ttf`   | `wght` 100–900, `wdth` 62–125 |

Both cover the weights this phase needs on one variable file — Baloo Bhaijaan 2 at 500/600/700/800
and Archivo at 600/800 (REQ-2.3) — so the variable form is preferred over static instances
(`specs.md` §2.1).

Neither file was fetched from `https://fonts.googleapis.com/css2?…`: that endpoint returns
unicode-range-sliced subsets tied to the requesting user agent, which is neither reproducible nor
recordable as provenance.

## Committed font files

No font binary is committed yet. The binaries land at `specs/phase-2/specs.md` STEP 5, and this
table is filled in then — one row per committed file, with the SHA-256 computed **after** a commit
and a fresh checkout, never from the downloaded file. Hashing the download would prove nothing
about what git stored: `.gitattributes` disables EOL normalisation only for paths that match
`*.woff2`, and a mis-named binary is corrupted silently on a Windows checkout and fails only in a
browser.

| File               | Upstream file | Version | Retrieved | SHA-256 (post-checkout) |
| ------------------ | ------------- | ------- | --------- | ----------------------- |
| _(pending STEP 5)_ |               |         |           |                         |

## Dates

- Licence texts retrieved and read: **2026-08-20** (REQ-2.2, Gate 0 verdict gate).
