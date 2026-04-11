# CrisisChain Map — Agent Instructions

## What this is
The map frontend for a hackathon project called CrisisChain — a decentralized
humanitarian aid platform. This repo contains ONLY the map component for now.
Blockchain, NGO portal, and backend services live in other repos.

## Stack (locked in — do not change)
- Vite + React + TypeScript
- Mapbox GL JS for the map (NOT Leaflet)
- No backend yet — all data comes from `seed/regions.json` until the live data script is implemented
- Node scripts in `scripts/` are TypeScript stubs for now

## Conventions
- All region data conforms to the `Region` type in `src/types/region.ts`.
  If you need a new field, add it to the type FIRST, then update seed/regions.json,
  then use it.
- Use the Mapbox token from `import.meta.env.VITE_MAPBOX_TOKEN`. Never hardcode it.
- Keep components in `src/components/`. One component per file.
- Don't install new dependencies. Vanilla CSS and useState are sufficient.
- Don't create a backend, API routes, or any server code. This repo is frontend-only.

## Data sources for the map (in priority order, for the future fetch script)
1. **ReliefWeb `/disasters` endpoint** — primary source for which crises are active
   right now. No auth, just `appname=crisischain-hackathon`. Filter for
   `status=current`. This drives the list of regions on the map.
2. **ACLED `/api/acled/read`** — secondary source for per-region incident detail
   (event counts, fatalities, sample events for the side drawer). Has a 12-month
   data lag on our access tier, so query a window ~13–15 months back. Uses OAuth
   as of September 2025 — POST to `https://acleddata.com/oauth/token` with
   username/password/grant_type=password/client_id=acled to get a bearer token.
   Do NOT use the old key= and email= URL parameters — they no longer work.
   Credentials live in `ACLED_USERNAME` and `ACLED_PASSWORD` env vars.
   Access tokens are 24h, refresh tokens are 14d. We don't persist tokens between
   script runs — just request a fresh one at the start of each invocation.
3. **INFORM Risk Index** — static CSV loaded once, used as a baseline severity
   multiplier per country. Annual update, no API needed.

## Mapbox tips
- Add the heatmap layer BEFORE the circle layer so circles render on top
- Use `interpolate` expressions for severity-based styling, not JS-side filtering
- Add layers inside the map's `load` event handler, not synchronously after
  creating the map
- Always clean up the map instance on component unmount

## What NOT to do
- Don't add Redux, Zustand, or any state management library. useState is fine.
- Don't add Tailwind, shadcn, or any CSS framework. Plain CSS or inline styles.
- Don't add a router. Single page is fine.
- Don't add tests. Hackathon scope.
- Don't refactor code that's already working.
- Don't call any external APIs in any phase of this initial build.
