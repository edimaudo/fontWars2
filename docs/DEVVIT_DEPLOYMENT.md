# Deploy fontWars to Reddit Devvit

This guide covers the actual Reddit version of fontWars. Use the Vercel browser preview first if you want to inspect the game screens and real font rendering without installing it on Reddit. The Vercel preview does not test Reddit authentication, Redis, community results, comments, flair, notifications or moderator permissions.

## 1. Requirements

- A Reddit account connected to the [Reddit Developer Platform](https://developers.reddit.com/).
- A subreddit where you have moderator access for installation and testing.
- Node.js **24.18.0 or later** and npm.
- The fontWars project files.
- At least four valid, licensed `.ttf` or `.otf` files in `public/fonts/`.
- At least five quoted, comma-separated words or phrases in `assets/word_library/words.txt`.

The project uses Devvit Web and Devvit Redis. You do not need to provision a separate server or database for the Reddit deployment.

## 2. Prepare the project

Open Terminal in the `fontwars` project folder and run:

```bash
nvm install
nvm use
node --version
npm install
```

Confirm that Node reports version 24.18.0 or later.

Add your assets before building:

```text
fontwars/
├── public/
│   └── fonts/
│       ├── Your First Typeface.ttf
│       ├── Your Second Typeface.otf
│       ├── Your Third Typeface.ttf
│       └── Your Fourth Typeface.otf
└── assets/
    └── word_library/
        └── words.txt
```

The word file must use double quotes and commas, for example:

```text
"aardvark", "aardwolf", "baboon", "badger", "crocodile"
```

The build discovers these files. Do not create or maintain a separate font catalogue, and do not edit `src/server/generated-content.ts` manually.

## 3. Run checks and build the Devvit app

Run:

```bash
npm run typecheck
npm test
npm run build
```

All three commands must finish successfully before you upload. The `devvit.json` build script also runs `npm run build` when Devvit uploads the app. The build generates `src/server/generated-content.ts` and the browser preview content file from the user-supplied assets. The Devvit app itself uses the server bundle in `dist/server` and the client files in `dist/client`.

## 4. Sign in to Devvit

Run:

```bash
npx devvit login
npx devvit whoami
```

Complete the browser sign-in and check that `whoami` shows the Reddit account that owns or manages the app.

This folder already contains a `devvit.json` file. If you have not registered the `fontwars` app yet, create/register it through the Devvit app-creation flow and link this project to the registered app. The CLI command is:

```bash
npx devvit init
```

Complete the browser setup and use the `fontwars` slug if it is available. If Devvit reports that this directory is already initialized, do not add `--force` blindly; first check the app name and registration in the Developer Platform. `--force` is for deliberately reinitializing an existing Devvit project and can replace its app association. The `name` field in `devvit.json` must match the registered app slug.

## 5. Upload the private app and start a playtest

First upload a private development version:

```bash
npx devvit upload
```

This does not make the app publicly listed. It uploads a private version that you can test.

Then start a playtest:

```bash
npx devvit playtest
```

The `devvit.json` development script starts Vite and esbuild in watch mode. Changes to the client or server are rebuilt while the playtest is running.

The CLI provides a link to the playtest subreddit. You can also specify a subreddit that you moderate and that has fewer than 200 subscribers:

```bash
npx devvit playtest YOUR_TEST_SUBREDDIT
```

Open the returned Reddit link. The game is installed in that test community. Keep the Terminal session running while you test so you can see server logs and playtest updates. Press `Ctrl + C` to end the playtest session. Ending the session does not uninstall the test version.

## 6. Set the daily puzzle secret

After the app has been uploaded and installed for the first time, generate a secret value:

```bash
openssl rand -hex 32
```

Copy the generated value. Set the global Devvit setting:

```bash
npx devvit settings set serverSalt
```

Paste the generated value when prompted. Confirm that the setting exists:

```bash
npx devvit settings list
```

Keep this value private and stable. Do not place it in source code or commit it to Git. Changing it changes the deterministic daily puzzle seed for dates whose puzzles have not already been cached.

## 7. Check subreddit settings and moderator permissions

The app defines these subreddit settings in `devvit.json`:

| Setting | Default | Purpose |
|---|---|---|
| `autoCreateDailyPost` | `true` | Enables the scheduled daily fontWars post. |
| `pushNotificationsEnabled` | `false` | Keeps reminders disabled until Reddit has approved the app for notification access. |

The daily post scheduler is configured for 00:00 UTC. The subreddit moderator menu also includes **Create today's fontWars post** for manual creation.

The app needs the appropriate moderator permissions to create and pin the daily score thread and to apply user flair. Test these permissions in the playtest subreddit. Do not enable push reminders unless Reddit has approved the app for the notifications beta and the subreddit setting is deliberately enabled.

## 8. Run the Reddit playtest checklist

Test the complete game with both a moderator account and a regular Reddit account.

- [ ] Daily fontWars post is created.
- [ ] The post opens the expanded game correctly.
- [ ] The target and all four choices load the actual supplied font files.
- [ ] Each of the five rounds runs with the 12-second timer.
- [ ] The first-round tip dismisses and stays dismissed.
- [ ] Reveal screens show the correct answer and anatomy observations.
- [ ] The five-stage observation instructions progress in order.
- [ ] Final score and result sheet are correct.
- [ ] The result thread is created once and pinned where permissions allow.
- [ ] Player sharing replies under the daily result thread only after the player presses the share button.
- [ ] Leaderboard and streak behavior work across multiple accounts.
- [ ] Flair controls work with the installed app's permissions.
- [ ] Data deletion removes the player's linked game records.
- [ ] Post and comment deletion triggers clean up their associated records.
- [ ] Mobile Reddit and desktop Reddit layouts are usable.
- [ ] Refresh, reconnect, timeout and duplicate-submission paths behave correctly.

Community averages and leaderboards need multiple real playtest players to be meaningful. The web preview uses no fake community statistics.

## 9. Inspect logs

The playtest command streams logs in the Terminal session. You can also use the CLI log command for the subreddit:

```bash
npx devvit logs YOUR_TEST_SUBREDDIT
```

Look for failed API requests, Redis errors, font asset loading errors, trigger failures and permission errors.

## 10. Submit for Reddit review

When the playtest is complete, submit an unlisted app version for review:

```bash
npx devvit publish
```

This submits the app for Reddit review; it is not an immediate public release. Reddit reviews the app code, example posts and documentation. Respond to any review requests before launch.

To request a public App Directory listing instead, use:

```bash
npx devvit publish --public
```

Use `--public` only when you want other communities to discover the app in the App Directory. The default publish request is unlisted.

## 11. Install or update the approved version

After Reddit approves the version, install it in the subreddit you moderate:

```bash
npx devvit install YOUR_SUBREDDIT
```

After a later version is approved, run the install command again to update that community. Publishing a new version does not automatically update every existing installation.

## 12. Keep the two deployment targets separate

| Target | What it is for | Backend behavior |
|---|---|---|
| Vercel browser preview | Testing screens, supplied fonts, round flow and browser layout | Browser-local practice data only. No Reddit backend. |
| Reddit Devvit | Actual game for Reddit communities | Devvit authentication, Redis, subreddit results, comments, moderator actions and scheduled posts. |

Do not point the Vercel preview at Devvit endpoints or treat its local results as real Reddit scores. The Devvit deployment is the production game environment.

## Official documentation

- [Devvit CLI](https://developers.reddit.com/docs/guides/tools/devvit_cli)
- [Playtest guide](https://developers.reddit.com/docs/guides/tools/playtest)
- [Devvit configuration](https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_configuration)
- [Launch guide](https://developers.reddit.com/docs/guides/launch/launch-guide)
