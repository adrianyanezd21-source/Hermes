# ⚡ Hermes Control Panel

Panel web auto-alojado para controlar el agente **[Hermes](https://github.com/NousResearch/hermes-agent)** de Nous Research desde el navegador: chat en tiempo real, agentes, gateway, skills, cron, MCP, archivos, uso de tokens, logs y una sección de **recomendaciones** para mejorar tu agente.

> Inspirado en el vídeo **["This OpenSource Repo will 10X Your Hermes Agent"](https://www.youtube.com/watch?v=yOZVYw9FIWc)** de **Jack Roberts** (`@Itssssss_Jack`), que presenta el _Hermes Control Interface_. Este panel reimplementa esas ideas con una base ligera y añade recomendaciones extra basadas en la documentación oficial de Hermes.

**Stack:** Node.js · Express · WebSocket (`ws`) · Vanilla JS · Chart.js — sin dependencias nativas.

---

## ✨ Funciones

| Página | Qué hace |
|--------|----------|
| **Inicio** | Salud del sistema (CPU/RAM/uptime), estado del gateway, plataformas conectadas |
| **Chat** | Conversación en tiempo real con streaming vía WebSocket, selector de perfil |
| **Agentes** | Lista de perfiles, modelo, personalidad; iniciar / parar / reiniciar gateway |
| **Skills** | Explorar, instalar y quitar skills (compatibles con agentskills.io) |
| **Cron** | Crear, pausar y borrar tareas programadas (lenguaje natural o expresión cron) |
| **MCP** | Plano de control de servidores MCP: iniciar / parar / reiniciar |
| **Archivos** | Explorar y editar ficheros del directorio de proyectos (con anti path-traversal) |
| **Uso** | Analítica de tokens, coste por modelo y proyección de presupuesto (Chart.js) |
| **Logs** | Registros de gateway / agente / error con resaltado por nivel |
| **Recomendaciones** | Consejos del canal + mejoras extra para sacarle 10× a Hermes |

### Seguridad
- Password gate con **bcrypt** y sesiones.
- **CSRF** en todos los endpoints mutadores.
- **CSP** sin `unsafe-eval`, cabeceras `X-Frame-Options`, `nosniff`.
- WebSocket protegido por sesión.
- Prevención de **path traversal** en el explorador de archivos.

---

## 🚀 Inicio rápido

```bash
git clone https://github.com/adrianyanezd21-source/Hermes.git
cd Hermes
cp .env.example .env          # define HERMES_CONTROL_PASSWORD + HERMES_CONTROL_SECRET
npm install
npm start                     # → http://localhost:10274
```

Abre `http://localhost:10274`, introduce la contraseña (por defecto `hermes`) y entra.

---

## 🔌 Modo LIVE vs DEMO

El panel detecta automáticamente el CLI de Hermes:

- **LIVE** — si el binario `hermes` está en el `PATH`, el panel ejecuta comandos reales
  (`hermes gateway`, `hermes skills list`, `hermes mcp list`, `hermes -p "…"`, etc.).
- **DEMO** — si no encuentra el CLI (o defines `HERMES_DEMO=true`), muestra datos
  realistas de demostración para que puedas navegar todo el panel sin Hermes instalado.

El badge en la barra lateral indica el modo actual.

### Chat en tiempo real
- Si defines `HERMES_API_URL` (endpoint OpenAI-compatible de `hermes serve`), el chat lo usa.
- Si no, usa el CLI en streaming (`hermes -p`), y en modo demo simula la respuesta.

---

## ⚙️ Configuración (`.env`)

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `HERMES_CONTROL_PASSWORD` | `hermes` | Contraseña de acceso (bcrypt) |
| `HERMES_CONTROL_SECRET` | — | Secreto de sesión (usa una cadena aleatoria larga) |
| `PORT` | `10274` | Puerto del panel |
| `HERMES_CONTROL_HOME` | `~/.hermes` | Directorio de estado de Hermes |
| `HERMES_PROJECTS_ROOT` | carpeta padre del repo | Raíz para el explorador de archivos |
| `HERMES_BIN` | `hermes` | Ruta/nombre del CLI de Hermes |
| `HERMES_API_URL` | — | Endpoint OpenAI-compatible para chat |
| `HERMES_API_KEY` | — | Clave del endpoint anterior |
| `HERMES_DEMO` | `false` | Fuerza el modo demo |

---

## 🧱 Arquitectura

```
public/                 SPA (HTML + CSS + JS vanilla, router por hash)
  index.html
  css/styles.css
  js/app.js
server.js               Express + sesiones + WebSocket (chat)
src/
  config.js             Configuración desde .env
  auth.js               Password gate (bcrypt) + CSRF
  routes.js             API REST (status, agents, gateway, skills, mcp, cron, files, usage, logs, recs)
  hermes.js             Integración con el CLI de Hermes (+ fallback demo)
  demo.js               Datos de demostración realistas
  store.js              Persistencia en JSON (cron, usage)
  recommendations.js    Consejos del canal + mejoras extra
data/                   Estado persistido (JSON)
```

---

## 💡 Recomendaciones para mejorar Hermes

La pestaña **Recomendaciones** del panel resume buenas prácticas:

- **Panel web** detrás de password + HTTPS; instalable como PWA.
- **Skills** enfocadas y reutilizables (progressive disclosure para ahorrar tokens).
- **Cron** que entrega resultados a Telegram/Discord/Slack.
- **MCP** para conectar GitHub, bases de datos, Composio… con filtrado de tools.
- **Gateway 24/7** como servicio systemd, un perfil por caso de uso.
- **Memoria** curada (`MEMORY.md` / `USER.md`) y archivos de contexto del proyecto.
- **Fiabilidad/coste**: fallback providers, credential pools, provider routing, prompt caching.
- **Escala**: subagentes (`delegate_task`), `execute_code`, batch processing.
- **Seguridad**: checkpoints + `/rollback`, event hooks/guardrails.
- **Observabilidad**: vigila tokens y coste por modelo a diario.

---

## 📄 Licencia

MIT.
