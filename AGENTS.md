# AGENTS.md

## Purpose
This repository is a React + TypeScript app (`CastStar`) for exploring cast/title connections from TMDB in an interactive force-directed graph.

Use this file as the default operating guide for coding agents working in this repo.

## Tech Stack
- Runtime/tooling: Node.js 22, Vite 7, TypeScript 5.9
- UI: React 19, Tailwind CSS 4 (via `@tailwindcss/vite`)
- Tests: Vitest (`tests/ui-render.test.tsx`)
- Linting: ESLint 9 (flat config)

## Repository Map
- `src/App.tsx`: top-level composition and wiring of workspace hooks/UI
- `src/features/graph/hooks/useGraphWorkspace.ts`: integration point for graph data/search/gestures/physics
- `src/features/graph/hooks/useGraphData.ts`: graph state, expansion, hiding, pruning, manual relation selection
- `src/features/graph/physics.ts`: physics step implementation (performance-sensitive)
- `src/features/graph/hooks/useGraphGestures.ts`: mouse/touch/trackpad camera interactions
- `src/features/graph/components/*`: canvas, node bubbles, context menu, performance HUD
- `src/tmdb.ts`: TMDB API + demo mode + token handling
- `scripts/benchmark-physics.ts`: physics micro-benchmark
- `.github/workflows/ci.yml`: CI/build/test/benchmark and pages deploy

## Setup and Commands
- Install: `npm ci`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`
- UI smoke test: `npm run test:ui-render`
- Physics benchmark: `npm run bench:physics`
- Layout screenshots (desktop + mobile): `npm run screenshot:layouts`

## Screenshot Workflow (Agent Capability)
- Preferred command: `npm run screenshot:layouts`
- Optional targeting:
  - Use a running app URL: `npm run screenshot:layouts -- --url http://127.0.0.1:5173 --route /`
  - Change output path: `npm run screenshot:layouts -- --out-dir artifacts/screenshots --route /`
- Default outputs:
  - `artifacts/screenshots/desktop.png`
  - `artifacts/screenshots/mobile.png`
- Inspection expectation:
  - After capture, inspect both files with the image viewer tool using absolute paths.
- One-time dependency setup:
  - If Playwright browsers are missing: `npx playwright install chromium`
- Troubleshooting:
  - If screenshot capture appears stuck, terminate stale runs with:
    - `pkill -f "scripts/capture-layout-screenshots.ts"`

## Browser Debug Workflow
- For UI regressions, inspect the current diff first (`git status --short`, `git diff --name-only`, then `git diff` for the relevant files) before changing code.
- If the task involves reproducing or verifying behavior in a real browser, use the `$playwright` skill and follow its CLI-first workflow.
- Required prerequisite for the Playwright CLI skill: `command -v npx >/dev/null 2>&1`
- Preferred Playwright CLI setup:
  - `export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"`
  - `export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"`
- Browser debugging expectations:
  - Start or reuse a local dev server.
  - Open the app in a headed browser when layout/rendering is part of the bug.
  - Use `snapshot` before interacting with element refs, and re-snapshot after significant UI changes.
  - Prefer demo-mode or local reproducible flows over external dependencies when possible.
  - Capture a regression screenshot before the fix and a verification screenshot after the fix.
- Artifact location for browser-debug runs:
  - Store screenshots in `output/playwright/`
- If Playwright cannot launch because browsers are missing:
  - `npx playwright install chromium`
  - If the Playwright CLI requires Chrome channel support on this machine: `npx playwright install chrome`

## Required Validation Before Finishing
Run the minimum checks that match your change scope:
- UI/logic change: `npm run test:ui-render` and `npm run build`
- Type/lint/config change: `npm run lint` and `npm run build`
- Physics or expansion algorithm change: `npm run bench:physics` plus `npm run build`
- Visual regression/UI rendering fix:
  - Reproduce the issue in-browser first.
  - Capture a pre-fix screenshot.
  - Apply the fix.
  - Run `npm run test:ui-render` and `npm run build`.
  - Capture a post-fix screenshot.
  - Inspect the final screenshot with the image viewer tool using an absolute path before finishing.

If you cannot run a check, explicitly report that in your final summary.

## Environment and Secrets
- TMDB token resolution in `src/tmdb.ts`:
  - build/runtime env: `VITE_TMDB_READ_ACCESS_TOKEN`, `VITE_TMDB_API_KEY`, `TMDB_API_KEY`
  - local override via localStorage key: `caststar_tmdb_token`
- Demo mode can be forced by `VITE_CASTSTAR_DEMO` / `CASTSTAR_DEMO`; it is also enabled when no token is available.
- Never commit real TMDB credentials or `.env` secrets.

## Behavioral Invariants (Do Not Break)
- Entity identity is `entityKey(kind, tmdbId)` from `src/types.ts`; preserve key stability.
- Edges are undirected and deduped by sorted endpoint keys (`source|target` pattern).
- Node expansion is batched (`EXPAND_BATCH_SIZE = 10`) and cursor-based (`expansionCursor`); do not introduce duplicate links/entities during expansion.
- Hidden entities are intentionally excluded from search/expansion until explicitly unhidden.
- `excludeSelfAppearances` and `includeCrewConnections` filters must affect both auto expansion and manual selection flows consistently.
- Touch long-press on node bubbles opens context menu; right-click does the same on pointer devices.

## Coding Guidelines
- Keep TypeScript strictness intact; avoid `any` unless unavoidable and justified.
- Prefer adding logic in hooks (`useGraph*`) and keep components mostly presentational.
- Reuse shared UI primitives from `src/components/ui/*` (`Button`, `PanelCard`, `cn`) instead of ad-hoc variants.
- Preserve current visual language (dark/cyan graph UI, rounded cards, dense information layout).
- Avoid broad refactors unrelated to the requested change.

## Performance Guidelines
- Treat `src/features/graph/physics.ts` and `useGraphPhysics.ts` as hot paths.
- Avoid unnecessary object churn and repeated full-graph scans in animation-frame code.
- If changing physics math/data structures, validate with `npm run bench:physics` and summarize impact.

## CI Expectations
CI currently runs:
- `npm run build`
- `npm run test:ui-render`
- `npm run bench:physics`

Keep changes compatible with this pipeline.
