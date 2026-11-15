# fontWars font library

Place each licensed TrueType (`.ttf`) or OpenType (`.otf`) font in this directory using its actual typeface name as the filename. The filename must match the catalogue name exactly, followed by the matching extension.

Examples:
- `Inter.ttf`
- `Playfair Display.otf`
- `Bowlby One SC.ttf`

## Current catalogue filenames

| Font | Required filename |
|---|---|
| Playfair Display | `Playfair Display.ttf` |
| Bebas Neue | `Bebas Neue.ttf` |
| Pacifico | `Pacifico.ttf` |
| Roboto Slab | `Roboto Slab.ttf` |
| EB Garamond | `EB Garamond.ttf` |
| Libre Baskerville | `Libre Baskerville.ttf` |
| Cormorant Garamond | `Cormorant Garamond.ttf` |
| GFS Didot | `GFS Didot.ttf` |
| Inter | `Inter.ttf` |
| Work Sans | `Work Sans.ttf` |
| IBM Plex Sans | `IBM Plex Sans.ttf` |
| Public Sans | `Public Sans.ttf` |
| Jost | `Jost.ttf` |
| Montserrat | `Montserrat.ttf` |
| Manrope | `Manrope.ttf` |
| Lato | `Lato.ttf` |
| Bungee | `Bungee.ttf` |
| Bowlby One SC | `Bowlby One SC.ttf` |
| Shrikhand | `Shrikhand.ttf` |
| Cinzel | `Cinzel.ttf` |

## Adding a font

1. Add the font binary as `<Font Name>.ttf` or `<Font Name>.otf` in this folder, matching the selected format. Preserve spaces and punctuation in the typeface name.
2. In `assets/font_catalog.json`, set the matching `fontAssets[0].file` to the exact same filename and `format` to `truetype` for `.ttf` or `opentype` for `.otf`.
3. Keep the font licence and attribution information. Do not add fonts unless their licence permits redistribution in this app.
4. The server verifies that each catalogue filename exactly matches the font name plus its format-specific extension (`.ttf` for `truetype`, `.otf` for `opentype`). URLs are percent-encoded automatically, so spaces in filenames work in browsers.

The game does not use numbered or obfuscated filenames for font binaries. Opaque render-family names are still used in CSS to avoid exposing the target font name in the active round payload. A missing or invalid TTF/OTF file blocks the round before its timer starts.
