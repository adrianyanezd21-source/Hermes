# Frontend — `public/`

## Purpose

Browser SPA for the Hermes Control Panel. Served as static assets by `server.js`.

## Ownership

Owns the HTML shell, styles, and client JS. Talks only to the backend `/api` and `/auth` endpoints plus the chat WebSocket.

## Local Contracts

- `index.html` — single shell; loads `css/styles.css`, `js/app.js`, and from `https://cdn.jsdelivr.net`: Chart.js and PixiJS v8 (global `PIXI`, used by the Office page).
- `css/styles.css` — dark dashboard theme; CSS variables at `:root` are the design tokens.
- `js/app.js` — vanilla SPA: hash router (`PAGES` array), `api()` helper that attaches the CSRF header, auth flow, page renderers, and the chat WebSocket client.

## Pages of note

- **Office** (`renderOffice`) — PixiJS isometric animated office: floor tiles, desks, one character per agent with a status-colored ring + bob animation; polls `/api/office/agent-states` (4s) plus kanban and live-feed panels. Its Pixi app + interval MUST be torn down by `teardownTransient()` (called at the top of `router()`), or the WebGL ticker leaks across navigations.
- **Chat** (`renderChat`) — shows the active provider badge from `/api/chat/provider` and warns when in demo mode. The CSP must keep `blob:` in `script-src`/`img-src` and a `worker-src 'self' blob:` for PixiJS.

## Work Guidance

- Add a page by appending to `PAGES` and writing a `renderX(view)` function; never introduce a build step or framework.
- Escape all user/dynamic strings with `esc()` before inserting into HTML.
- Keep mutations going through `api()` so CSRF and 401-redirect handling stay centralized.

## Verification

- Load `/`, log in, and exercise the new page; confirm no CSP violations in the console.

## Child DOX Index

No child docs.
