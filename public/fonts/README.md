# Font library

Place the font files you want fontWars to use directly in this folder:

- TrueType: `.ttf`
- OpenType: `.otf`

Use the typeface's name as the filename. For example:

```text
Inter.ttf
Playfair Display.otf
Bowlby One SC.ttf
IBM Plex Sans.otf
```

The game discovers font files automatically. The filename (without the extension) becomes the typeface label shown to players. There is no `font_catalog.json` to maintain and no numbered filenames or manual metadata are needed.

Keep the folder flat rather than placing fonts in subfolders. Use one file per typeface name; do not include both `Typeface Name.ttf` and `Typeface Name.otf` in the same library. The app uses each file as a regular face at weight 400. Other weights and styles are not yet separate choices.

The content generator checks the TrueType/OpenType file signature, table directory, core character-map/metrics/name tables, glyph-outline table, duplicate names, and identical binary files. These structural checks catch truncated, malformed, or duplicated files; they do not verify browser rendering, glyph coverage for every word, ligature appearance, visual similarity between typefaces, or redistribution rights.

Before adding files, verify that their licences permit redistribution in a Reddit app. Keep any required licence and attribution notices alongside your project assets.

The build process scans this folder and generates an internal manifest automatically. Run `npm run content:generate` to refresh that manifest. `npm run build` and `npm run dev` refresh it automatically and require at least four font files.
