# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done. Update the closest owning AGENTS.md when a change affects purpose, scope, ownership, durable structure, contracts, workflows, inputs/outputs, constraints, or the Child DOX Index. Update parents when parent-level structure changes; update children when parent changes alter local rules. Remove stale text immediately.

## Style

- Keep docs concise, current, and operational
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names

---

# Hermes Control Panel — Root

## Purpose

Self-hosted web panel to control the **Hermes** AI agent (Nous Research) from the browser: chat, agents, gateway, skills, cron, MCP, files, token usage, logs, an Office visualization, and a recommendations page. Inspired by the `xaspx/hermes-control-interface` project shown by Jack Roberts on YouTube.

## Ownership

- Root owns: project-wide conventions, the runtime entry (`server.js`), packaging (`package.json`), env contract (`.env.example`), and the Child DOX Index below.
- `server.js` wires Express, sessions, the security headers/CSP, `/auth/*` routes, the `/api` router, static SPA serving, and the chat WebSocket.

## Local Contracts

- Runtime: Node.js >= 20, ES modules (`"type": "module"`).
- No native dependencies — keep installs reliable (Express, express-session, ws, bcryptjs, dotenv).
- Persistence: JSON files in `data/` via `src/store.js` (no database).
- Hermes integration must always degrade gracefully to DEMO mode when the `hermes` CLI is absent.
- Security is mandatory on every mutating endpoint: session auth + CSRF; preserve CSP without `unsafe-eval`.

## Work Guidance

- Respond to the user in Spanish (project owner preference).
- Frontend is vanilla JS with a hash router in `public/js/app.js`; external libs only via CDN allowed by the CSP (`cdn.jsdelivr.net`).
- Keep `.env.example` in sync with any new config keys read in `src/config.js`.

## Verification

- `npm install` then `npm start`; start the server and run endpoint checks in the SAME shell command (each sandbox bash call uses an isolated PID namespace, so a backgrounded server does not survive across calls).

## Child DOX Index

- `src/AGENTS.md` — backend: config, store, Hermes integration, demo data, auth, API routes, chat orchestrator + LLM client, recommendations content.
- `public/AGENTS.md` — frontend SPA: HTML shell, CSS theme, and the JS app (router, auth, pages incl. the PixiJS Office, chat WebSocket client).

## User Preferences

- Communicate in Spanish.
- Replicate features of the reference panel faithfully; when a paid dependency is involved, prefer a free alternative.
