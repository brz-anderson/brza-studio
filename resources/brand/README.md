# BrzA brand assets

The BrzA mark, its variants and the lockups (PLN-007). Every SVG here is generated: edit
`config/scripts/brza-brand-build.mjs` and run it, never the SVG.

```bash
node config/scripts/brza-brand-build.mjs
```

## The master

`brza-symbol.svg` is a 1024 canvas with a 824 px tile (rx 185) at (100, 100), the Apple icon grid, and the flame in
the `brza-fire` gradient on top. The flame is the S1 trace of `resources/brza-flame-mono.svg`: the first nine
subpaths are the flame, the tenth is the `}`, and the `{` and the loose `}` are `<use>` of that `}` (mirrored, and at
scale 1.143). There is no light tongue and no sparks. The tile edge is a 24 px (12 visible) stroke in the gradient.

## The colors

| Use         | Color                                                  |
| :---------- | :----------------------------------------------------- |
| Fire        | `#FFAA44` 0, `#F4902A` .30, `#F26228` .65, `#E04A2B` 1 |
| Tile, dark  | `#373A41` 0, `#2C2D32` .6, `#19161D` 1                 |
| Tile, light | `#FFFFFF` 0, `#F6F6F8` 1                               |
| Dev badge   | `#1447E6` disc with a white "D"                        |
| Text, dark  | "Brz" `#FAFAFA`, daughter `#BCBCBC`                    |
| Text, light | "Brz" `#0A0A0A`, daughter `#474747`                    |

## What is generated from what

| File                                                   | From                                                                          |
| :----------------------------------------------------- | :---------------------------------------------------------------------------- |
| `brza-symbol.svg`                                      | the master                                                                    |
| `brza-symbol-light.svg`                                | the master with the light tile                                                |
| `brza-symbol-dev.svg`                                  | the master plus the blue "D" badge                                            |
| `brza-app-icon.svg`                                    | the master with the flame raised and the `seal` ("BrzA STUDIO")               |
| `brza-symbol-mono.svg`                                 | the S1 `d` as is, in `currentColor`                                           |
| `brza-tray-template.svg`                               | the S1 in black on a 22x14 canvas                                             |
| `brza-*-lockup-{horizontal,vertical}-{dark,light}.svg` | the master, "BrzA" (Geist 750) and the daughter (Geist 500, +0.14em) as paths |
| `../logo.svg`                                          | a copy of `brza-symbol.svg`                                                   |

The text is converted to paths by `config/scripts/brza-brand-text.swift` (CoreText, so macOS with Xcode's `swift`),
reading `src/renderer/src/assets/fonts/Geist-Variable.woff2`. The generated SVG is committed: run the build again only
when the S1 trace, the text or the font changes.

The app icons (`.icns`, `.ico`, the PNG and the tray) are rendered from these SVG by `pnpm build:icons`
(`resources/icon-source/generate.sh`, which needs `rsvg-convert`).
