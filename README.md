# fontWars — Devvit Web

A Reddit-native daily typeface identification duel. Five deterministic rounds, twelve seconds per round, four live font choices, a crowd reveal, and a compact result sheet.

This is an implementation of the supplied `fontWars` PRD, using React + TypeScript in the Devvit Web client, a Hono server, and subreddit-scoped Redis state.

## What's implemented

- Inline feed card with edition/date, daily community accuracy, play count, streak, and expanded-mode CTA.
- Expanded five-round game with 12-second timer, four typographic option cards, mandatory five-face TTF preload before the timer, loupe rulers, and 2.5-second reveal.
- Deterministic daily puzzle generation: SHA-256 date/salt seed + `mulberry32`, including Friday theme selection.
- Server-authoritative timing and scoring. Client submissions contain only the chosen font ID; the server calculates elapsed time.
- Redis-backed daily puzzle, per-post/per-user session, crowd split, completion stats, profile streaks, unique-player count, and subreddit leaderboard.
- Archive mode that preserves old puzzle play without modifying today's crowd split, streaks, or leaderboard.
- Result sheet with five inspectable specimen tiles, crowd accuracy, diagnostic notes, share-to-comments, unlocked flair actions, and the Devvit notification opt-in state.
- Devvit Journeys client events for explicit start, round milestones, and completion, plus a Redis sorted-set event mirror with server-verified receipts for App.Ready and the Journey lifecycle.
- Daily post scheduler, moderator manual-create action, and an optional paginated notification campaign.
- Automated tests for scoring, deterministic content, edition numbering, TTF asset mapping/loading, payload sanitization, and streak milestones.

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

## Font assets — required before judging or launch

The catalogue metadata is stored separately in `assets/font_catalog.json`. The actual typeface binaries belong in `public/fonts/`; the supplied project does **not** bundle font binaries.

Add the correctly licensed TrueType (`.ttf`) files to `public/fonts/` using these exact opaque names. The catalogue maps each typeface to its asset metadata, and Vite copies this directory to the Devvit client output.

```text
fw_face_01.ttf  Playfair Display
fw_face_02.ttf  Bebas Neue
fw_face_03.ttf  Pacifico
fw_face_04.ttf  Roboto Slab
fw_face_05.ttf  EB Garamond
fw_face_06.ttf  Libre Baskerville
fw_face_07.ttf  Cormorant Garamond
fw_face_08.ttf  GFS Didot
fw_face_09.ttf  Inter
fw_face_10.ttf  Work Sans
fw_face_11.ttf  IBM Plex Sans
fw_face_12.ttf  Public Sans
fw_face_13.ttf  Jost
fw_face_14.ttf  Montserrat
fw_face_15.ttf  Manrope
fw_face_16.ttf  Lato
fw_face_17.ttf  Bungee
fw_face_18.ttf  Bowlby One SC
fw_face_19.ttf  Shrikhand
fw_face_20.ttf  Cinzel
```

Verify every font's current licence, attribution obligations, and allowed redistribution for the specific TTF file you provide. Keep any required license files in `public/fonts/licenses/`. Do not assume that a font's open-source family name automatically clears every foundry build or subset for redistribution.

The client loads the target typeface and all four answer-choice typefaces for the active round using the browser FontFace API. A new round starts only after all five faces report successful loading. On a resumed round, the client refreshes the server-calculated remaining time after the font preload; missing files or load failures block gameplay rather than silently showing fallback fonts.

## Important platform notes

- **Subreddit data boundaries:** Devvit Redis is namespaced per app installation. Each subreddit therefore gets an independent crowd split, leaderboard, and player state. It is not one global cross-subreddit leaderboard.
- **User result comments:** Sharing requires an explicit button press and uses `runAs: 'USER'`. Until Reddit approves the app's user actions, playtesting may attribute comments to the app account or owner rather than the player.
- **Flair:** Applying user flair requires moderator scope and the app installation to have the appropriate subreddit permissions. It is an optional reward action; it does not gate play.
- **Push notifications:** Reddit's notification API is a gated experimental beta. The UI reports the capability as unavailable until the subreddit setting is enabled and the API is available. It does not create a custom push subscription system.
- **Journeys:** Client Journey events and the official server route adapter are included, but Reddit event delivery is gated by the app allowlist/review. A separate Redis sorted-set mirror records App.Ready and Journey lifecycle events; the client checks each returned Redis receipt. No personal information is attached to custom Journey fields.
- **Timer fairness:** The server records round start and calculates elapsed time. The 500 ms network grace is accepted, but scoring is capped at the 12-second curve endpoint (600 points). A wrong answer or timeout scores zero.
- **Anti-cheat scope:** The target and choices use separate opaque CSS family aliases and distinct opaque asset query aliases; the target catalogue ID/name is not returned in the active-round JSON. This is not DRM: any font loaded in a browser can be inspected or downloaded by a determined user. A stronger anti-cheat requirement would need server-generated raster specimens with font binaries kept server-side.
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
│   ├── font_catalog.json
│   └── friday_themes.json
├── public/fonts/             # Add licensed TTF binaries here
├── src/
│   ├── client/
│   │   ├── components/        # Specimen, reveal, result views
│   │   ├── api.ts
│   │   ├── game.tsx
│   │   ├── splash.tsx
│   │   ├── telemetry.ts
│   │   └── styles.css
│   ├── server/
│   │   ├── scheduler/dailyDrop.ts
│   │   ├── services/          # Puzzle, session, profile logic
│   │   └── index.ts
│   └── shared/                # Types, deterministic PRNG, scoring
├── tests/
├── devvit.json
└── package.json
```
