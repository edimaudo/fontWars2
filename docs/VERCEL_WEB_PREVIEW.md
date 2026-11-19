# fontWars browser preview on Vercel

This deployment is a **browser-only preview of the game experience**. It lets you check your real font files, specimen rendering, five-round flow, reveal screens, responsive layout and local progress before installing the app on Reddit.

It is not the production Devvit backend. Reddit sign-in, Reddit comments, subreddit leaderboards, crowd statistics, user flair, push notifications, Redis persistence, scheduled posts and moderator actions are disabled in this preview. The browser preview stores its practice session in the current browser's `localStorage`.

## 1. Add the real content first

Add at least four licensed `.ttf` or `.otf` files to `public/fonts/`. Use one file per typeface and name each file after the typeface, for example `Inter.ttf` or `Playfair Display.otf`.

Add at least five entries to `assets/word_library/words.txt` using the quoted, comma-separated format:

```text
"aardvark", "aardwolf", "baboon", "badger", "crocodile"
```

Do not add a separate font catalogue. The build script discovers font files and generates the internal manifest and `public/preview-content.json` automatically.

Make sure you have the rights to host and redistribute every font file you put in `public/fonts/`. Vercel serves these files to anyone who can access the preview site.

## 2. Test the browser preview locally (optional)

Use Node.js 24.18.0 or later:

```bash
nvm install
nvm use
npm install
npm run dev:web-preview
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The preview uses the same React screens and font files as the Devvit build, with a local browser adapter in place of Reddit and Redis services.

## 3. Deploy to Vercel

1. Push this project to a Git repository.
2. In Vercel, select **Add New → Project** and import the repository.
3. Set the **Root Directory** to `fontwars` if the project is inside a larger repository folder. Leave it at `.` if the repository root is already this project.
4. Keep the Vite framework detection. The included `vite.config.ts` sets the Vite root to `src/client`, so the two HTML entrypoints are emitted directly as `dist/client/splash.html` and `dist/client/game.html`. The included `vercel.json` sets the build command to `npm run build:web-preview` and the output directory to `dist/client`.
5. In **Project Settings → Build and Deployment → Node.js Version**, select **24.x**. Vercel currently supports Node 24.x and automatically applies the latest patch release; the project requires Node 24.18.0 or later.
6. Deploy the project.

The build is strict. It stops if it cannot find at least four valid font files or five valid word entries. The supplied Python example is not copied literally: fontWars is a Vite/React TypeScript application, not a FastAPI application, so there is no `main.py`, `@vercel/python` function, function memory setting, or Python rewrite destination. Vercel serves the built multi-page frontend as static files. The two explicit rewrites provide clean `/` and `/game` routes; a duplicate catch-all rewrite is unnecessary. No database or Vercel environment variables are required for this static preview.

The generated files and routes are:

- `dist/client/splash.html` — the fontWars start screen (also served at `/` by the rewrite)
- `dist/client/game.html` — the game screen (also served at `/game` by the rewrite)
- `/splash.html` and `/game.html` — direct static-file URLs for the two pages

## 4. Preview behavior and limitations

- A fixed daily selection is generated in the browser from the supplied font and word libraries.
- Answers and scores are saved in browser-local storage for the current UTC date.
- The five-round timer, font loading, anatomy reveal, onboarding hint and result sheet can be tested.
- Community averages and leaderboard values are not fabricated. They are omitted or labelled as Devvit-only.
- Reddit sharing, flair, notifications and data services are unavailable in this preview. Those must be tested in a Devvit playtest subreddit.
- The browser preview is not authoritative for server-side timing, concurrent submissions, Redis recovery, subreddit isolation, moderator permissions or Reddit review behavior.

At the end of a practice session, select **Reset browser preview** to clear the local practice state and return to the start screen. Browser storage can also be cleared manually through the browser's site-data controls.

## 5. Build command

Vercel runs:

```bash
npm run build:web-preview
```

That command validates the user-provided content, generates the server and browser content manifests, and creates the static Vite build in `dist/client`. The Vite root is `src/client`; without that setting Vite would preserve the `src/client/` subdirectory in the emitted HTML paths, so Vercel and Devvit would not find their configured `splash.html` and `game.html` entrypoints. The Devvit production build remains separate and is documented in [DEVVIT_DEPLOYMENT.md](./DEVVIT_DEPLOYMENT.md).

## Official Vercel documentation

- [Vercel project configuration (`vercel.json`)](https://vercel.com/docs/project-configuration/vercel-json)
- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
