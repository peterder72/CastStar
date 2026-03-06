# CastStar

Interactive React + TypeScript app for exploring cast/title connections from TMDB in a force-directed graph.

Demo: [https://peterder72.github.io/CastStar/](https://peterder72.github.io/CastStar/)

> [!WARNING]
> This project is fully made by AI.

## What It Does

- Search people, movies, or TV shows.
- Add results to a graph and expand connections in batches.
- Traverse cast and (optionally) crew relationships.
- Hide, prune, delete, or manually add node relationships from the context menu.
- Tune global physics and interaction settings (mouse vs trackpad).

## Stack

- Node.js 22
- Vite 7
- TypeScript 5.9
- React 19
- Tailwind CSS 4
- Vitest + ESLint 9

## Local Development

```bash
npm ci
npm run dev
```

## Build and Validate

```bash
npm run build
npm run lint
npm run test:ui-render
npm run bench:physics
```

Preview production build:

```bash
npm run preview
```

## TMDB Integration

CastStar uses TMDB search and credits endpoints to discover and expand entities.

### Token Resolution Order

1. `VITE_TMDB_READ_ACCESS_TOKEN`
2. `VITE_TMDB_API_KEY`
3. `TMDB_API_KEY` (injected at build time by `vite.config.ts`)
4. Local override in browser `localStorage` key: `caststar_tmdb_token`

If no token is available, the app automatically runs in demo mode.

### Force Demo Mode

Set either of these to a truthy value (`true`, `1`, `yes`, `on`):

- `VITE_CASTSTAR_DEMO`
- `CASTSTAR_DEMO`

### Example `.env`

```env
# Preferred: TMDB v4 read access token (Bearer auth)
VITE_TMDB_READ_ACCESS_TOKEN=your_tmdb_read_access_token

# Optional alternatives:
# VITE_TMDB_API_KEY=your_v3_api_key
# TMDB_API_KEY=your_v3_api_key

# Optional:
# VITE_CASTSTAR_DEMO=true
```

You can also set/change the token from the app UI (`Settings -> Set Token`) when build-time token injection is not used.

## Layout Screenshots

Capture desktop + mobile screenshots:

```bash
npm run screenshot:layouts
```

Outputs:

- `artifacts/screenshots/desktop.png`
- `artifacts/screenshots/mobile.png`

If Playwright Chromium is missing:

```bash
npx playwright install chromium
```

## Notes

- Do not commit real TMDB credentials.
- This product uses the TMDB API but is not endorsed or certified by TMDB.
