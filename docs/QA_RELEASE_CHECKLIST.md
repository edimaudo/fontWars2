# fontWars QA and release checklist

This checklist separates automated source checks from tests that require real assets, a Reddit installation, or physical devices. A source-level pass is not evidence that a production Devvit deployment or Reddit permission flow has passed.

## Local automated gates

- [ ] Use Node.js 24.18.0 or later (`nvm use`).
- [ ] Add at least four licensed `.ttf` / `.otf` files to `public/fonts/`.
- [ ] Add at least five specimen entries to `assets/word_library/words.txt`, as double-quoted comma-separated values.
- [ ] Run `npm run content:generate`; confirm the discovered font and word counts match the supplied files.
- [ ] Run `npm run typecheck` with all project dependencies installed.
- [ ] Run `npm test`; confirm scoring, puzzle determinism, content manifest, real font validation, Redis lease, atomic marker, onboarding, anatomy and accessibility contract tests pass.
- [ ] Run `npm run build`; confirm client and server bundles are produced.
- [ ] Inspect `dist/server/index.js` and `dist/client` for the expected bundle and static font files.
- [ ] Confirm `dist/client/splash.html` and `dist/client/game.html` exist at the client output root (not nested under `src/client/`).

## Real font and word-library QA

- [ ] Confirm every font file is licensed for the intended use and keep required notices.
- [ ] Confirm each filename stem is the intended display name; avoid duplicate names and duplicate binary files.
- [ ] Test every typeface in Chrome/Chromium, Safari (including iOS Safari), and the Reddit in-app browser.
- [ ] Verify the specimen's exact glyph set renders without missing-glyph boxes, silent substitution, or synthetic weight/style.
- [ ] Review accented characters, punctuation, ligatures, kerning pairs, long words and multi-word phrases.
- [ ] Review the measured cap-height, x-height, baseline and descender guide against each real face; confirm it remains legible at narrow viewport widths.
- [ ] Review all four answer choices for visual plausibility and unintended giveaway patterns. Do not label pairs objectively easy/hard without this review.
- [ ] Confirm the Friday theme rotation and the fifth-round theme content are understandable and factually appropriate.

## Gameplay and recovery QA

- [ ] Complete five rounds with all correct answers, all incorrect answers, and a mix of correct/incorrect answers.
- [ ] Verify the 12-second timer, timeout submission, 500 ms grace behavior, score cap and 2.5-second reveal transition.
- [ ] Refresh during font preload, active play, after timeout, during reveal, and after completion.
- [ ] Open two tabs or submit the same round twice; confirm one saved result and one aggregate increment.
- [ ] Interrupt a request during session saving; retry and verify the cached reveal and session stay consistent.
- [ ] Test concurrent first requests for a new date; confirm only one cached deterministic puzzle is used.
- [ ] Test a pending Reddit share; confirm the UI instructs the player to check the pinned thread rather than blindly posting another comment.
- [ ] Confirm archive play does not modify current-day crowd, streak or leaderboard data.

## Accessibility and responsive QA

- [ ] Complete the entire flow with keyboard only: tab, shift-tab, enter and space. Confirm visible focus and logical focus order.
- [ ] Test with VoiceOver (iOS/macOS) and NVDA (Windows): inspect progress, timer, loading, reveal, result selection, buttons and error announcements.
- [ ] Confirm the countdown does not produce a continuous screen-reader announcement stream.
- [ ] Test at 320 px, 375 px, 768 px and 1280 px viewport widths; confirm no clipped buttons, overlapping labels or horizontal page scroll.
- [ ] Test browser zoom at 200% and text scaling; confirm the content remains reachable and does not overlap.
- [ ] Verify contrast for muted copy, labels, focus rings, error states, and correct/incorrect states. Do not use colour alone to communicate correctness.
- [ ] Enable reduced motion and confirm transitions and animations are reduced.
- [ ] Verify the feed card can scroll when the data-deletion confirmation is expanded.

## Reddit installation and permissions

- [ ] Install the app in a test subreddit with the required moderator permissions.
- [ ] Set a random, stable `serverSalt` of at least 16 characters; do not use the source fallback in production.
- [ ] Verify the moderator menu action and scheduled daily post path do not create duplicate posts under concurrent calls. If post creation has an ambiguous failure, inspect the subreddit before manually retrying because Reddit submission and Redis persistence cannot be one transaction.
- [ ] Verify the app can create and pin/distinguish the daily score-thread comment; confirm moderator permissions.
- [ ] Verify result comments are user-attributed only in the approved `SUBMIT_COMMENT` state.
- [ ] Delete a daily post and a result comment; confirm the corresponding trigger cleanup is idempotent.
- [ ] Verify flair templates and permissions before using the flair control.
- [ ] Keep notifications disabled until Reddit grants the required beta access; test opt-in, opt-out and delivery only after approval.
- [ ] Submit the Journey map for review and verify platform telemetry receipts after approval.
- [ ] Confirm privacy/deletion wording, terms and privacy policy metadata before public launch.

## Device and network matrix

- [ ] Reddit iOS app on a current supported iPhone, including VoiceOver.
- [ ] Reddit Android app on a current supported Android device, including TalkBack.
- [ ] Desktop Reddit web in Chrome and Firefox; include Safari where supported by the target audience.
- [ ] Slow network, offline font request, request timeout, app refresh, and Reddit API permission failure.

## Current verification status in this source archive

- [x] TypeScript source syntax transpilation: no syntax diagnostics.
- [x] Redis lease ownership and atomic once-only behavior: focused in-memory concurrency harness.
- [x] Devvit trigger route and payload field source checks.
- [x] Accessibility source contracts and responsive CSS rules added.
- [x] Focused WCAG contrast calculations: specimen labels 5.14:1, dark-mode muted labels 6.91:1, anatomy labels 5.52:1, and the keyboard focus ring 10.44:1. These checks cover the named UI tokens, not every possible rendered colour combination.
- [x] TypeScript transpile syntax check: 36 source/test files, zero syntax diagnostics.
- [x] JSON configuration/content parsing, CSS brace structure, content-library boundary checks, and content-generator JavaScript syntax check.
- [ ] Full Vitest suite: dependencies are not installed in this environment.
- [ ] Full TypeScript typecheck: `@types/node`, `vite/client` and `vitest/globals` are unavailable until dependencies are installed.
- [ ] Production build and Devvit upload/playtest: not run in this environment.
- [ ] Actual font browser rendering and visual difficulty review: awaiting the real font library.
