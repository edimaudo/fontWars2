# fontWars

A Reddit-native daily font identification duel. Five deterministic rounds, twelve seconds per round, four live font choices, a crowd reveal, and a compact result sheet.


## What's implemented

- Inline feed card with edition/date, daily community accuracy, play count, streak, and expanded-mode CTA.
- Expanded five-round game with 12-second timer, four typographic option cards, mandatory five-face font-file preload before the timer, loupe rulers, and 2.5-second reveal.
- Deterministic daily puzzle generation: SHA-256 date/salt seed + `mulberry32`, including Friday theme selection.
- Server-authoritative timing and scoring. Client submissions contain only the chosen font ID; the server calculates elapsed time.
- Redis-backed daily puzzle, per-post/per-user session, crowd split, completion stats, profile streaks, unique-player count, and subreddit leaderboard.
- Archive mode that preserves old puzzle play without modifying today's crowd split, streaks, or leaderboard.
- Result sheet with five inspectable specimen tiles, crowd accuracy, diagnostic notes, share-to-comments, unlocked flair actions, and the Devvit notification opt-in state.
- Devvit Journeys client events for explicit start, round milestones, and completion, plus a Redis sorted-set event mirror with server-verified receipts for App.Ready and the Journey lifecycle.
- Daily post scheduler, moderator manual-create action, and an optional paginated notification campaign.
- Automated tests for scoring, deterministic content, edition numbering, TTF/OTF asset mapping/loading, payload sanitization, and streak milestones.

## Requirements

- Node.js 24.18.0 (see `.nvmrc`).
- A Reddit account and a subreddit where you have moderator access for installation and testing.
- The current Devvit CLI and access to Devvit playtesting.

## Run locally and playtest

```bash
nvm install
nvm use
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

`npm run dev` starts `devvit playtest`. Follow the CLI prompts to choose the test subreddit. The application runs inside Reddit's Devvit Web post surface; it is not a standalone public website.

## Configure the app

1. Install the app in your test subreddit with moderator permissions.
2. Configure the global secret `serverSalt` to a long random value (at least 16 characters). Do not commit it to source control. The development fallback is intentionally visible in source and must be replaced before a public launch.
3. Leave `autoCreateDailyPost` enabled to publish the daily post at `00:00 UTC`. Use the subreddit moderator menu item **Create today's fontWars post** to create the current day's post manually.
4. The `pushNotificationsEnabled` subreddit setting defaults to `false`. Keep it disabled until Reddit has approved the app for the notifications beta and the notification copy is approved. After approval, enable the setting; users can then opt in or out in the result card.
5. Journeys are included in the build, but Reddit only emits events for apps on its Journeys allowlist. The official client methods instrument Journey Start, Progress, and End. The current public client docs describe `App.Ready` as an event but do not document a callable client method for it; the small `appReady()` adapter is deliberately isolated pending the supported SDK hook.

## Content libraries — required before playtesting or launch

### Font files

Put your licensed `.ttf` and `.otf` files directly in `public/fonts/`. Use the typeface name as the filename, for example `Inter.ttf`, `Playfair Display.otf`, or `Bowlby One SC.ttf`. The game discovers the files automatically and uses each filename (without its extension) as the display name. There is no `font_catalog.json` and no font metadata to maintain.

Use one file per typeface name and keep the directory flat. The game loads each font as a regular face at weight 400. Keep the font files' licence and attribution notices with the project where required. See `public/fonts/README.md` for details.

### Word list

Put your own words and phrases in `assets/word_library/words.txt` as comma-separated, double-quoted entries, for example `"aardvark", "aardwolf", "baboon"`. You can use multiple lines and include phrases. No sample words are included. Add at least five entries, each no longer than 80 characters. See `assets/word_library/README.md`.

### Content discovery

The build process scans the font folder and reads the word list, then generates `src/server/generated-content.ts`. This file is internal build output; do not edit it manually. `npm run build` and `npm run dev` refresh it automatically. The game requires at least four font files and five word-list entries.

## Important platform notes

- **Subreddit data boundaries:** Devvit Redis is namespaced per app installation. Each subreddit therefore gets an independent crowd split, leaderboard, and player state. It is not one global cross-subreddit leaderboard.
- **User result comments:** Sharing requires an explicit button press and uses `runAs: 'USER'`. Until Reddit approves the app's user actions, playtesting may attribute comments to the app account or owner rather than the player.
- **Flair:** Applying user flair requires moderator scope and the app installation to have the appropriate subreddit permissions. It is an optional reward action; it does not gate play.
- **Push notifications:** Reddit's notification API is a gated experimental beta. The UI reports the capability as unavailable until the subreddit setting is enabled and the API is available. It does not create a custom push subscription system.
- **Journeys:** Client Journey events and the official server route adapter are included, but Reddit event delivery is gated by the app allowlist/review. A separate Redis sorted-set mirror records App.Ready and Journey lifecycle events; the client checks each returned Redis receipt. No personal information is attached to custom Journey fields.
- **Timer fairness:** The server records round start and calculates elapsed time. The 500 ms network grace is accepted, but scoring is capped at the 12-second curve endpoint (600 points). A wrong answer or timeout scores zero.
- **Anti-cheat scope:** The target and choices use separate opaque CSS family aliases and reference the same font file URL, allowing the browser cache to reuse the binary; the target font ID/name is not returned in the active-round JSON. This is not DRM: any font loaded in a browser can be inspected or downloaded by a determined user. A stronger anti-cheat requirement would need server-generated raster specimens with font binaries kept server-side.
- **Daily content:** The first request for a date creates and caches that date's puzzle; the scheduler pre-warms it and creates the Reddit post. The global `serverSalt` must remain stable or previously uncached archive puzzles will not regenerate identically.

## API surface

| Route | Purpose |
|---|---|
| `GET /api/init` | Resolve current post date, session, safe round payload, stats, streak, and notification state |
| `POST /api/round/start` | Start the current round after font loading is complete |
| `POST /api/round/submit` | Validate option, calculate server elapsed time, score and reveal |
| `POST /api/share` | Explicitly submit the completed result as a Reddit comment |
| `POST /api/flair` | Equip an unlocked flair |
| `POST /api/notifications` | Subscribe/unsubscribe through Devvit's notification API |
| `GET /api/leaderboard` | Return the current daily top ten |
| `POST /api/journey-event` | Verify and mirror lifecycle events to a Redis sorted set |
| `POST /internal/scheduler/daily-drop` | Generate and publish the daily post |
| `POST /internal/scheduler/daily-push-batch` | Continue an optional daily notification campaign |

## Project map

```text
fontwars/
├── assets/
│   ├── friday_themes.json
│   └── word_library/
│       └── words.txt         # Add comma-separated, double-quoted words or phrases
├── public/fonts/             # Add your licensed TTF/OTF font files here
├── src/
│   ├── client/
│   │   ├── components/        # Specimen, reveal, result views
│   │   ├── api.ts
│   │   ├── game.tsx
│   │   ├── splash.tsx
│   │   ├── telemetry.ts
│   │   └── styles.css
│   ├── server/
│   │   ├── generated-content.ts  # Auto-generated from your two libraries
│   │   ├── scheduler/dailyDrop.ts
│   │   ├── services/          # Puzzle, session, profile logic
│   │   └── index.ts
│   └── shared/                # Types, deterministic PRNG, scoring
├── tests/
├── devvit.json
└── package.json
```

