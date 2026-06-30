# Backend — `src/`

## Purpose

Server-side logic for the Hermes Control Panel: configuration, persistence, Hermes integration, auth, and the REST API.

## Ownership

Owns all backend modules. Consumed by the root `server.js`.

## Local Contracts

- `config.js` — single source of env config; expands `~`. Add new keys here and mirror them in root `.env.example`.
- `store.js` — atomic JSON read/write/update under `data/`. Files are gitignored (except `.gitkeep`).
- `hermes.js` — integration layer. Detects the `hermes` CLI (`--version`); when absent or `HERMES_DEMO=true`, every method must fall back to `demo.js`. Exposes: version, systemHealth, agents, gateway control, skills, mcp, logs, chatOnce, chatStream.
- `demo.js` — realistic fallback data; keep shapes identical to the live equivalents so the frontend is agnostic to mode.
- `auth.js` — bcrypt password gate + per-session CSRF (`requireAuth`, `requireCsrf`, `issueCsrf`). All mutating API methods stay behind both.
- `routes.js` — `/api` router; mounts under auth + CSRF. File explorer must keep path-traversal protection (`safeResolve`).
- `recommendations.js` — content shown on the Recommendations page; tagged `channel` vs `extra`.
- `llm.js` — OpenAI-compatible streaming client (SSE). Powers the FREE chat option: OpenRouter `:free` models. Reads `llmBaseUrl`/`llmApiKey`/`llmModel` from config.
- `chat.js` — chat orchestrator. `resolveProvider()` picks (auto): explicit `CHAT_PROVIDER` > Hermes CLI > LLM (`llm.js`) > demo. `stream()` is the single entry used by the server WebSocket; `providerInfo()` backs `/api/chat/provider`.
- Office endpoints in `routes.js` (`/office/agent-states`, `/office/kanban`, `/office/events`) are read-only and currently served from `demo.js` (`officeAgents`/`officeKanban`/`officeEvents`); replace with live Hermes data when available, keeping the same shapes.

## Work Guidance

- Any new live command in `hermes.js` must ship a matching `demo.js` fallback and never throw to the client.
- New endpoints go through `requireAuth`/`requireCsrf` automatically via the router-level middleware in `routes.js`.

## Verification

- After changes, hit the affected endpoint with a logged-in cookie + `x-csrf-token` and confirm both LIVE and DEMO shapes.

## Child DOX Index

No child docs. Single-level backend module folder.
