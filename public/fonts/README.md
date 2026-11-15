# fontWars typeface assets (TTF)

Place the licensed TrueType font files (`.ttf`) in this directory. The game reads font metadata from `assets/font_catalog.json`; binary font files stay separate in this folder.

## Required regular-weight files

Use these exact filenames so the existing catalogue resolves them:

| File | Typeface |
|---|---|
| `fw_face_01.ttf` | Playfair Display |
| `fw_face_02.ttf` | Bebas Neue |
| `fw_face_03.ttf` | Pacifico |
| `fw_face_04.ttf` | Roboto Slab |
| `fw_face_05.ttf` | EB Garamond |
| `fw_face_06.ttf` | Libre Baskerville |
| `fw_face_07.ttf` | Cormorant Garamond |
| `fw_face_08.ttf` | GFS Didot |
| `fw_face_09.ttf` | Inter |
| `fw_face_10.ttf` | Work Sans |
| `fw_face_11.ttf` | IBM Plex Sans |
| `fw_face_12.ttf` | Public Sans |
| `fw_face_13.ttf` | Jost |
| `fw_face_14.ttf` | Montserrat |
| `fw_face_15.ttf` | Manrope |
| `fw_face_16.ttf` | Lato |
| `fw_face_17.ttf` | Bungee |
| `fw_face_18.ttf` | Bowlby One SC |
| `fw_face_19.ttf` | Shrikhand |
| `fw_face_20.ttf` | Cinzel |

## Adding fonts

1. Add the `.ttf` file using its mapped filename.
2. Keep the font's licence and attribution notice. Put licence files in `public/fonts/licenses/` and record the licence URL in `assets/font_catalog.json`.
3. Do not commit fonts unless their licence permits redistribution in this app.
4. The catalogue supports multiple assets per family. Add another `fontAssets` entry for additional weights or styles, specifying `file`, `format`, `weight`, and `style`. The game currently selects the regular (`400`, `normal`) face for the live specimen.

The app intentionally does not substitute a system font when a required TTF is missing or invalid. A failed asset blocks the round before its timer starts so players are not scored against an inaccurate specimen.
