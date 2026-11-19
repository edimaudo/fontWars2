# fontWars — Devvit Web

A Reddit-native daily typeface identification duel. Five deterministic rounds, twelve seconds per round, four live font choices, a crowd reveal, and a compact result sheet.

This is an implementation of the supplied `fontWars` PRD, using React + TypeScript in the Devvit Web client, a Hono server, and subreddit-scoped Redis state.

## What's implemented

- Inline feed card with edition/date, daily community accuracy, play count, streak, and expanded-mode CTA.
- Expanded five-round game with 12-second timer, four typographic option cards, mandatory five-face font-file preload before the timer, loupe rulers, and a 2.5-second reveal.
- Five-stage observation progression: silhouette, proportion, letterforms, stroke contrast, then spacing and rhythm.
- First-round instruction tip that dismisses on the first pointer or keyboard interaction and persists per browser.
- Reveal anatomy diagram measuring cap height, x-height, baseline and descender from the loaded target font, rather than using fixed illustrative measurements.
- Twelve rotating Friday themes with unique IDs and required learning notes, applied to the fifth round.
- Deterministic daily puzzle generation: SHA-256 date/salt seed + `mulberry32`, including Friday theme selection.
- Server-authoritative timing and scoring. Client submissions contain only the chosen font ID; the server calculates elapsed time.
- Redis-backed daily puzzle, per-post/per-user session, crowd split, completion stats, profile streaks, unique-player count, and subreddit leaderboard.
- Token-owned expiring Redis leases for session writes, daily puzzle generation, daily post creation and score-thread creation.
- Transactional once-only markers for play counts, completion counts and crowd/stat contributions; each round's saved session and reveal are committed together.
- Thirty-day sliding retention for identity-linked player records, with 45-day retention for anonymous daily aggregates and puzzle caches.
- Player-initiated deletion of profile and linked game records, plus idempotent post/comment deletion cleanup triggers.
- Archive mode that preserves old puzzle play without modifying today's crowd split, streaks, or leaderboard.
- Result sheet with five inspectable specimen tiles, crowd accuracy, diagnostic notes, a live top-ten leaderboard, unlocked flair actions, and the Devvit notification opt-in state.
- One pinned daily score-thread comment; players explicitly post their result as a reply rather than creating separate top-level comments.
- Devvit Journeys client events for explicit start, round milestones, and completion, plus a Redis sorted-set event mirror with server-verified receipts for App.Ready and the Journey lifecycle.
- Daily post scheduler, moderator manual-create action, and an optional paginated notification campaign.
- Automated tests for scoring, deterministic puzzle selection, content parsing and SFNT validation, TTF/OTF loading, onboarding persistence, anatomy metrics, Redis lease ownership, atomic once-only updates, accessibility contracts, payload sanitization, and streak milestones.

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
5. Journeys are included in the build. The client records `App.Ready` when the app becomes interactive, `Journey.Start` on the explicit play action, per-round `Journey.Progress`, and `Journey.End` on completion. The client inspects each SDK receipt and keeps a separate Redis event mirror for debugging. Reddit must approve the journey map before platform telemetry is active.

## Content libraries — required before playtesting or launch


### Difficulty calibration boundary

The five stages currently progress the **observation task**, not a claim that the underlying typeface pairs are objectively easy-to-hard. The font library is intentionally discovered from filenames and does not include a manually maintained catalogue or per-font difficulty metadata. Once the real font files are supplied, review and browser-render the candidate sets before setting any visual-difficulty claims or lookalike pairings.

### Font files

Put your licensed `.ttf` and `.otf` files directly in `public/fonts/`. Use the typeface name as the filename, for example `Inter.ttf`, `Playfair Display.otf`, or `Bowlby One SC.ttf`. The game discovers the files automatically and uses each filename (without its extension) as the display name. There is no `font_catalog.json` and no font metadata to maintain.

Use one file per typeface name and keep the directory flat. The game loads each font as a regular face at weight 400. Keep the font files' licence and attribution notices with the project where required. See `public/fonts/README.md` for details.

### Word list

Put your own words and phrases in `assets/word_library/words.txt` as comma-separated, double-quoted entries, for example `"aardvark", "aardwolf", "baboon"`. You can use multiple lines and include phrases. No sample words are included. Add at least five entries, each no longer than 80 characters. See `assets/word_library/README.md`.

### Content discovery

The build process scans the font folder and reads the word list, then generates `src/server/generated-content.ts`. This file is internal build output; do not edit it manually. `npm run build` and `npm run dev` refresh it automatically. The game requires at least four font files and five word-list entries.

## Important platform notes

- **Subreddit data boundaries:** Devvit Redis is namespaced per app installation. Each subreddit therefore gets an independent crowd split, leaderboard, and player state. It is not one global cross-subreddit leaderboard.
- **User result comments:** The app creates one daily score-thread comment and attempts to distinguish/pin it. Player sharing requires an explicit button press and replies to that comment using `runAs: 'USER'`. Until Reddit approves the app's user actions, playtesting may attribute comments to the app account or owner rather than the player. Pinning and flair application require moderator permissions in the installed subreddit.
- **Flair:** Applying user flair requires moderator scope and the app installation to have the appropriate subreddit permissions. It is an optional reward action; it does not gate play.
- **Push notifications:** Reddit's notification API is a gated experimental beta. The UI reports the capability as unavailable until the subreddit setting is enabled and the API is available. It does not create a custom push subscription system.
- **Journeys:** Client Journey events and the official server route adapter are included, but Reddit event delivery is subject to journey-map review/allowlisting. A separate Redis sorted-set mirror records App.Ready and Journey lifecycle events; the client checks each returned Redis receipt. No personal information is attached to custom Journey fields.
- **Concurrency and recovery:** Round submission writes the per-round reveal and updated session in a single Redis transaction. Marker fields and aggregate counters are updated together to prevent duplicate increments on retries. A stale legacy `processing` marker is cleared when encountered. Redis leases include an owner token and TTL so an expired worker cannot release a newer worker's lease.
- **Data retention and deletion:** Player session/profile/submission/contribution/share records use a 30-day sliding TTL. Anonymous crowd and daily statistics, daily puzzle data and leaderboard aggregates use a 45-day TTL. Players can select **Manage game data** on the feed card or **Delete my data** on the result sheet; this removes the player's linked fontWars records and leaderboard membership. Aggregate community counts may remain, and comments previously posted to Reddit remain governed by Reddit's own deletion controls.
- **Reddit deletion triggers:** `onPostDelete` removes per-post player/session and share indexes; `onCommentDelete` removes share references and resets the player's share state when their result comment is deleted. Handlers are idempotent and use the current trigger payload identifiers. A trigger can be delivered more than once, so cleanup is safe to repeat.
- **Account deletion limitation:** The Devvit Web trigger set used here does not expose a dependable Reddit account-deletion event. Identity-linked data therefore expires after 30 days without activity, and the app provides an immediate player-initiated deletion action. This is not a claim of instant automatic account-deletion cleanup.
- **Cross-system side effects:** Reddit actions and Redis writes cannot participate in one transaction. The app records a pending intent before creating a result comment or the pinned score thread; if the outcome is ambiguous, it asks the player to check the thread rather than automatically retrying and risking a duplicate. An interrupted pending share or pinned-thread creation may require moderator/developer review. The daily post scheduler is protected against concurrent cron/manual calls, but a process crash after Reddit accepts a new post and before Redis saves its ID remains an external side-effect recovery risk; inspect the subreddit before manually retrying a post-creation failure.
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
| `POST /api/privacy/delete-me` | Delete the current player's linked fontWars records |
| `POST /internal/triggers/post-delete` | Clean up records for a deleted/removed daily post |
| `POST /internal/triggers/comment-delete` | Clean up a deleted score-thread or player result comment |
| `GET /api/leaderboard` | Return the current daily top ten for the result sheet |
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
│   │   ├── atomicOnce.ts        # Atomic markers + aggregate increments
│   │   ├── redisLease.ts       # Token-owned expiring Redis leases
│   │   ├── generated-content.ts  # Auto-generated from your two libraries
│   │   ├── scheduler/dailyDrop.ts
│   │   ├── services/          # Puzzle, session, profile logic
│   │   └── index.ts
│   └── shared/                # Types, deterministic PRNG, scoring
├── tests/
├── devvit.json
└── package.json
```



## QA and release

Use [`docs/QA_RELEASE_CHECKLIST.md`](docs/QA_RELEASE_CHECKLIST.md) as the release gate. It separates locally runnable checks from validation requiring your actual font and word libraries, a Reddit test subreddit, platform permissions, and physical/mobile device testing.
