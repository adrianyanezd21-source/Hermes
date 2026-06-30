# 📐 Plan extenso: construir la página del video (Hermes Control Interface) con sus herramientas

> Objetivo: replicar de forma fiel el panel web que muestra el video
> **"This OpenSource Repo will 10X Your Hermes Agent"** (canal **Jack Roberts**,
> `@Itssssss_Jack`, https://www.youtube.com/watch?v=yOZVYw9FIWc), que presenta el
> proyecto open source [`xaspx/hermes-control-interface`](https://github.com/xaspx/hermes-control-interface)
> (HCI) para controlar el agente **Hermes** de Nous Research desde el navegador.
>
> Este documento es la hoja de ruta. Lo que ya está hecho en este repo se marca
> con ✅; lo pendiente con ⬜.

---

## 1. Resumen del producto

HCI es un **dashboard web auto-alojado** que se ejecuta en la misma máquina que el
agente Hermes y lo controla a través de su CLI, su gateway y sus ficheros de estado
(`~/.hermes`). Todo detrás de un **password gate** y, en producción, tras nginx + HTTPS.

Versión de referencia analizada: **HCI v3.6.1** (MIT).

---

## 2. Stack y herramientas (las del video)

| Capa | Herramienta del repo original | Nuestra elección | Estado |
|------|-------------------------------|------------------|--------|
| Runtime | Node.js 20+ | Node.js 20+ | ✅ |
| Servidor | Express | Express | ✅ |
| Tiempo real | `ws` (WebSocket) | `ws` | ✅ |
| Frontend | Vanilla JS + **Vite** (build) | Vanilla JS (sin build) | ✅ (sin Vite) |
| Gráficas | **Chart.js** | Chart.js (CDN) | ✅ |
| Terminal | **xterm.js** + **node-pty** | xterm.js + node-pty | ⬜ |
| Visualización Office | **PixiJS** (WebGL) | PixiJS (CDN) | ✅ |
| Base de datos | **better-sqlite3** (kanban.db) | JSON store (migrar a SQLite) | ✅ (JSON) / ⬜ (SQLite) |
| Config Hermes | **js-yaml** / `yaml` | (pendiente leer config.yaml real) | ⬜ |
| Subida de ficheros | **multer** | — | ⬜ |
| Seguridad cabeceras | **helmet** | CSP/headers manuales | ✅ (equivalente) |
| Rate limiting | **express-rate-limit** | — | ⬜ |
| Precios de tokens | **@pydantic/genai-prices** | tabla propia / demo | ✅ (demo) |
| Auth | **bcrypt** + sesiones | bcryptjs + express-session | ✅ |
| i18n | JSON (en/ja) | — | ⬜ |
| PWA | manifest + service worker | — | ⬜ |
| Tests | **Playwright** | — | ⬜ |

> Nota de licencia: HCI es MIT. Podemos inspirarnos y adaptar citando el origen.
> Este repo es una reimplementación propia y ligera, no una copia literal.

---

## 3. Arquitectura objetivo

```
Navegador (SPA, ~13 páginas)
      │  HTTPS :10274
      ▼
Express  ── Auth (bcrypt, sesiones, CSRF)
         ── RBAC (20 permisos, 3 roles: admin/viewer/custom)
         ── REST API (30+ rutas)
         ── WebSocket (chat, terminal, eventos en vivo)
         │
         ├── Hermes CLI        (estados de agente, gateway, skills, cron)
         ├── node-pty          (terminales reales del servidor)
         ├── SQLite (kanban.db)(pipeline de tareas del swarm)
         ├── Filesystem        (config.yaml, logs, skills, ficheros)
         └── Externos          (servidores MCP, precios de tokens)
```

---

## 4. Mapa de páginas (feature-by-feature)

Leyenda de estado: ✅ hecho · 🟡 parcial · ⬜ pendiente

### 4.1 Login / Password gate ✅
- Una sola contraseña (bcrypt) + sesión + token CSRF. **Hecho.**
- ⬜ Multi-usuario con roles (ver 4.12).

### 4.2 Home / Inicio ✅
- Salud del sistema (CPU, RAM, uptime), estado del gateway, plataformas conectadas, atajos.
- 🟡 Resumen de uso de tokens del día embebido (ampliar con mini-gráfica).

### 4.3 Chat ✅ (+ voz 🆓)
- Streaming en tiempo real por WebSocket, selector de perfil, badge de proveedor.
- Voz gratis del navegador: TTS (leer respuestas) + micrófono (dictar). **Hecho.**
- ⬜ Tarjetas de "tool call" con visor JSON plegable.
- ⬜ Botón Stop, reanudar sesión, "fork" desde un mensaje.

### 4.4 Workspace ⬜
- Explorar/editar ficheros **acotado a un directorio de proyecto** y chatear con Hermes
  con ese contexto. (Combina Files + Chat con `cwd`.)

### 4.5 Agentes ✅ / 🟡
- Lista de perfiles (modelo, personalidad, gateways, sesiones, estado). **Hecho.**
- Ciclo de vida del gateway: start/stop/restart. **Hecho.**
- ⬜ CRUD de perfiles (crear/editar/borrar).
- ⬜ Sub-páginas por agente: Dashboard, Sesiones, Gateway, Config (editor YAML), Memoria, Skills, Cron.

### 4.6 Office / ZOO Swarm Monitor ✅ / 🟡
- Visualización **PixiJS**: oficina isométrica animada, agentes-personaje con estado. **Hecho.**
- Paneles: Agentes, Kanban (pipeline), Live Feed. **Hecho (demo).**
- ⬜ Kanban real con 8 carriles (triage→done), flechas de dependencia, selector de tablero.
- ⬜ Popup de tarea: historial de runs, explorador de ficheros del workspace, timeline.

### 4.7 Monitor ⬜
- Logs del gateway + métricas CPU/RAM en vivo + vista de procesos.

### 4.8 Usage / Uso ✅ / 🟡
- Analítica de tokens, coste por modelo, proyección y alerta de presupuesto (Chart.js). **Hecho (demo).**
- ⬜ Datos reales desde los logs/uso de Hermes y precios con `@pydantic/genai-prices`.

### 4.9 Logs ✅
- Logs de gateway/agente/error con filtro por nivel. **Hecho.**
- ⬜ Streaming en vivo (tail por WebSocket/SSE) en lugar de polling.

### 4.10 Skills ✅
- Listar, instalar y quitar skills (agentskills.io). **Hecho.**
- ⬜ Ver el contenido (SKILL.md) y editar.

### 4.11 Files / Archivos ✅
- Explorador + editor con prevención de path traversal. **Hecho.**
- ⬜ Subida de ficheros (multer) y borrado/renombrado.

### 4.12 MCP ✅ / 🟡
- Listar, start/stop/restart de servidores MCP. **Hecho.**
- ⬜ Tail de logs en vivo + editor de configuración (JSON/YAML) desde el navegador.

### 4.13 Terminal ⬜
- Terminal real del servidor con **xterm.js** + **node-pty** sobre WebSocket.
  (Dependencia nativa: requiere build de node-pty.)

### 4.14 Maintenance ⬜
- Backup/restore del estado, actualización del panel, "system doctor".

### 4.15 Users / RBAC ⬜
- Multi-usuario: 3 roles (admin/viewer/custom), 20 permisos, **aislamiento por perfil**
  (`allowed_profiles`), middleware `requireProfileAccess`, ocultar tabs según permisos.

### 4.16 Recomendaciones ✅ (mejora propia)
- Consejos del canal + mejoras extra del ecosistema. **Hecho.**

---

## 5. API REST (objetivo)

Ya implementadas (✅): `/auth/*`, `/api/status`, `/health`, `/agents`, `/gateway/:action`,
`/skills`, `/skills/:action`, `/mcp`, `/mcp/:action`, `/logs`, `/usage`, `/cron` (CRUD),
`/files` (GET/POST), `/recommendations`, `/office/agent-states|kanban|events`, `/chat/provider`.

Pendientes (⬜):
- `/api/agents` CRUD completo + sub-recursos (`/:profile/sessions`, `/:profile/memory`, `/:profile/config`).
- `/api/office/kanban/:id` (detalle de tarea), `/:id/action` (acciones), `/:id/workspace-file`.
- `/api/terminal` (WebSocket pty), `/api/files/upload`, `/api/mcp/:name/logs`, `/api/mcp/:name/config`.
- `/api/maintenance/{backup,restore,update,doctor}`.
- `/api/users` (RBAC) + `requireProfileAccess`.

---

## 6. Seguridad (paridad con el original)

- ✅ Password gate (bcrypt), sesiones, CSRF en mutaciones.
- ✅ CSP sin `unsafe-eval`, `X-Frame-Options`, `nosniff`, WebSocket protegido por sesión.
- ✅ Prevención de path traversal en el explorador.
- ⬜ Rate limiting global + chat (`express-rate-limit`).
- ⬜ RBAC con 20 permisos / 3 roles y aislamiento por perfil.
- ⬜ Endurecer con `helmet`.

---

## 7. Modelo de datos

- Hoy: ficheros JSON en `data/` (cron, usage) vía `src/store.js`. ✅
- Objetivo: **SQLite** (`better-sqlite3`) para `kanban.db` (tareas, runs, eventos, comentarios,
  enlaces de dependencia) y para usuarios/permisos. ⬜
- Estado de Hermes: leer `~/.hermes/config.yaml` (perfiles) y logs reales. ⬜

---

## 8. Roadmap por fases

**Fase 0 — Base (✅ HECHA)**
Login, Home, Chat (+voz), Agentes, Skills, Cron, MCP, Files, Usage, Logs, Office (PixiJS),
Recomendaciones; integración Hermes con modo demo; chat gratis (OpenRouter) + voz gratis.

**Fase 1 — Datos reales de Hermes**
1. Leer `~/.hermes/config.yaml` con `yaml` → perfiles/agentes reales.
2. Mapear comandos reales del CLI (`hermes gateway`, `skills`, `cron`, `sessions`) y validar.
3. Uso de tokens real + precios con `@pydantic/genai-prices`.

**Fase 2 — Terminal y Workspace**
4. Terminal con `node-pty` + `xterm.js` por WebSocket.
5. Workspace (Files acotado a proyecto + chat con `cwd`).
6. Subida de ficheros con `multer`.

**Fase 3 — Swarm/Office completo**
7. Migrar a SQLite (`kanban.db`): tareas, runs, eventos, dependencias.
8. Kanban con 8 carriles, flechas de dependencia, selector de tablero, popup de tarea.
9. Live feed real desde logs del gateway (SSE/WebSocket).

**Fase 4 — Multiagente y permisos**
10. CRUD de perfiles + sub-páginas por agente (sesiones, memoria, config YAML, cron).
11. RBAC (3 roles, 20 permisos) + aislamiento por perfil + página Users.

**Fase 5 — Operación y pulido**
12. Monitor (métricas en vivo + procesos), Maintenance (backup/restore/doctor/update).
13. Rate limiting + helmet. PWA (manifest + service worker). i18n (es/en).
14. Tests con Playwright. Scripts de despliegue (systemd + nginx).

---

## 9. Despliegue (objetivo)

- `systemd` para el panel y para `hermes gateway` (servicio 24/7).
- nginx como reverse proxy + HTTPS (Let's Encrypt) o Cloudflare Tunnel.
- Variables en `.env` (ya documentadas en `.env.example`).

---

## 10. Investigación del canal y más mejoras para Hermes

**Sobre el canal (Jack Roberts, `@Itssssss_Jack`):** el video analizado promociona HCI como
la forma de "10×" tu agente. No fue posible enumerar de forma fiable todo su listado de
videos con las herramientas disponibles (las páginas de YouTube no son extraíbles), así que
las mejoras de abajo se apoyan en el **ecosistema oficial de Hermes** y proyectos de la
comunidad, alineados con los temas del canal.

Mejoras recomendadas para Hermes (más allá del panel):

1. **Voice Mode oficial de Hermes** — además de la voz del navegador (ya integrada), Hermes
   tiene voz nativa: bucle de micrófono en CLI, respuestas habladas en Telegram/Discord y
   bot en canales de voz de Discord. Nous Portal incluye LLM + TTS con un solo OAuth
   (voz de extremo a extremo sin credenciales extra). TTS gratis: **Edge TTS** y **Piper**.
   [Docs](https://hermes-agent.nousresearch.com/docs/guides/use-voice-mode-with-hermes)
2. **Memoria autoalojada (Honcho)** — proyecto comunitario `elkimek/honcho-self-hosted`
   para una capa de memoria self-hosted con OpenRouter, sin cambios de código.
3. **Skills auto-mejorables** — el bucle de aprendizaje crea/mejora skills con el uso;
   conviene revisarlas y versionarlas.
4. **MCP** — conectar GitHub, bases de datos, Composio, etc., con filtrado de tools.
5. **Cron + entrega por mensajería** — informes automáticos a Telegram/Discord/Slack.
6. **Fiabilidad/coste** — fallback providers, credential pools, provider routing, prompt caching.
7. **Escala** — subagentes (`delegate_task`), `execute_code`, batch processing.
8. **Seguridad** — checkpoints + `/rollback`, event hooks/guardrails.

> Nota de compliance: el contenido del ecosistema se ha resumido/parafraseado; ver enlaces
> originales para el detalle. (Contenido reformulado para cumplir con licencias.)

---

## 11. Estado actual de este repo (resumen)

- ✅ Fase 0 completa y verificada (servidor arranca, endpoints responden, sintaxis OK).
- 🟡 Datos en modo demo; integración real de Hermes pendiente (Fase 1).
- ⬜ Fases 2–5 según el roadmap.

Siguiente paso sugerido: **Fase 1** (leer `config.yaml` real + mapear comandos del CLI),
porque desbloquea datos reales en casi todas las páginas.


---

## 12. Síntesis del mejor agente personal/código (HCI + OpenClaw + OpenCode + Claude Code)

Además del panel del video (HCI), se incorporan las mejores ideas de tres agentes open source:

### OpenClaw (asistente personal) — `github.com/openclaw/openclaw`
- **Comandos de chat** (`/status`, `/new`, `/reset`, `/compact`, `/think <nivel>`, `/verbose`) → implementados en el Chat como **slash commands** (`/help`, `/clear`, `/new`, `/plan`, `/think`, `/status`, `/model`). ✅
- **Multi-agente / multi-canal**: enrutar canales a agentes aislados (workspaces + sesiones por agente) → reflejado en Agentes + detalle por perfil (sesiones/memoria/config). 🟡
- **Voice Wake / Talk Mode** → voz gratis del navegador (TTS + micrófono) ya integrada. ✅
- **Sandbox de herramientas** (allow/deny por sesión) → modelo de permisos RBAC del panel. 🟡
- **Pairing/seguridad de DMs** (tratar la entrada como no confiable) → idea para el endurecimiento del gateway. ⬜

### OpenCode (agente de código en terminal) — `opencode.ai`
- **Plan-then-Build**: proponer plan y revisar diffs antes de tocar ficheros → **modo Plan** en el Chat (prepende la directiva de plan). ✅ (revisión de diffs ⬜)
- **75+ proveedores con un solo config** → capa LLM OpenAI-compatible configurable (`LLM_BASE_URL`). 🟡
- **Modelos gratis incluidos** → OpenRouter `:free` documentado. ✅
- **Terminal-first + shell** → página Terminal con ejecución real de comandos. ✅
- **Diagnósticos LSP** → pendiente (requiere servidores LSP). ⬜

### Claude Code (agente de código) — Anthropic
- **Slash commands + plan mode + thinking levels** → integrados (Plan + 🧠 bajo/medio/alto). ✅
- **Memoria del proyecto (CLAUDE.md/AGENTS.md)** → DOX instalado (AGENTS.md jerárquico) + memoria por agente editable. ✅
- **Checkpoints / rollback** → checkpoints nativos de Hermes (documentado en Recomendaciones). 🟡
- **Subagentes / delegación** → `delegate_task` de Hermes (documentado). 🟡
- **Permisos / allowlist de herramientas** → RBAC (20 permisos, 3 roles, aislamiento por perfil). ✅

> Atribución: OpenClaw (MIT), OpenCode (MIT) y Claude Code son de sus respectivos autores.
> Aquí se reimplementan ideas/patrones de forma propia, no su código. (Contenido reformulado
> para cumplir con licencias.)

## 13. Estado actualizado (esta entrega)

Completado además de la Fase 0: **RBAC + Usuarios**, **detalle de agente** (sesiones/memoria/config),
**Office** con kanban de 8 carriles + detalle de tarea, **Monitor** (métricas+procesos),
**Terminal** (ejecución real), **Maintenance** (backup/restore/doctor/update), **Workspace**,
**Ajustes**, y **Chat avanzado** (slash commands, modo Plan, nivel de pensamiento, Stop, voz).

Pendiente real: integración LIVE con Hermes (config.yaml/CLI), SQLite para kanban, LSP, PWA,
i18n, tests Playwright, terminal con pty persistente y revisión de diffs.
