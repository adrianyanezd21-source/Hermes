// Hermes Control Panel — SPA (vanilla JS)
'use strict';

const state = { csrf: null, charts: {} };

// ---------- helpers ----------
const $ = (sel, el = document) => el.querySelector(sel);
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast ' + kind;
  setTimeout(() => t.classList.add('hidden'), 2600);
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.csrf) headers['x-csrf-token'] = state.csrf;
  const res = await fetch('/api' + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (res.status === 401) { showLogin(); throw new Error('no autorizado'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('error ' + res.status));
  return data;
}

function fmtBytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}
function fmtUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}
function fmtNum(n) { return new Intl.NumberFormat('es').format(n); }

// ---------- auth ----------
function showLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); }
function showApp() { $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); }

async function initAuth() {
  const me = await fetch('/auth/me').then((r) => r.json());
  if (me.authed) { state.csrf = me.csrf; startApp(); }
  else showLogin();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = $('#login-pass').value;
  const res = await fetch('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (res.ok) { state.csrf = data.csrf; $('#login-pass').value = ''; $('#login-error').textContent = ''; startApp(); }
  else $('#login-error').textContent = data.error || 'Error';
});

$('#logout').addEventListener('click', async () => {
  await fetch('/auth/logout', { method: 'POST' });
  state.csrf = null; showLogin();
});

// ---------- navigation ----------
const PAGES = [
  { id: 'home', ic: '🏠', name: 'Inicio', render: renderHome },
  { id: 'chat', ic: '💬', name: 'Chat', render: renderChat },
  { id: 'agents', ic: '🤖', name: 'Agentes', render: renderAgents },
  { id: 'skills', ic: '🧩', name: 'Skills', render: renderSkills },
  { id: 'cron', ic: '⏰', name: 'Cron', render: renderCron },
  { id: 'mcp', ic: '🔌', name: 'MCP', render: renderMcp },
  { id: 'files', ic: '📁', name: 'Archivos', render: renderFiles },
  { id: 'usage', ic: '📊', name: 'Uso', render: renderUsage },
  { id: 'logs', ic: '📜', name: 'Logs', render: renderLogs },
  { id: 'recommendations', ic: '💡', name: 'Recomendaciones', render: renderRecs },
];

function buildNav() {
  const nav = $('#nav'); nav.innerHTML = '';
  PAGES.forEach((p) => {
    const a = el(`<a class="nav-item" href="#${p.id}"><span class="ic">${p.ic}</span><span>${p.name}</span></a>`);
    nav.appendChild(a);
  });
}

function setActive(id) {
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.getAttribute('href') === '#' + id));
}

async function router() {
  const id = (location.hash.slice(1) || 'home');
  const page = PAGES.find((p) => p.id === id) || PAGES[0];
  setActive(page.id);
  const view = $('#view');
  view.innerHTML = '<div class="loading">Cargando…</div>';
  try { await page.render(view); }
  catch (err) { view.innerHTML = `<div class="card"><p class="muted">No se pudo cargar: ${esc(err.message)}</p></div>`; }
}

async function startApp() {
  showApp();
  buildNav();
  window.addEventListener('hashchange', router);
  if (!location.hash) location.hash = '#home';
  await refreshMode();
  router();
}

async function refreshMode() {
  try {
    const s = await api('/status');
    const badge = $('#mode-badge');
    badge.textContent = s.mode === 'live' ? 'LIVE' : 'DEMO';
    badge.className = 'badge ' + (s.mode === 'live' ? 'ok' : 'warn');
    badge.title = s.version;
  } catch {}
}

function head(title, sub, actions = '') {
  return `<div class="page-head"><div><h1>${title}</h1><p>${sub}</p></div><div class="row">${actions}</div></div>`;
}

// ============================================================
//  PAGES
// ============================================================
async function renderHome(view) {
  const s = await api('/status');
  const h = s.health, g = s.gateway;
  const platforms = (g.platforms || []).map((p) =>
    `<span class="row" style="gap:6px"><span class="dot ${p.connected ? 'ok' : 'err'}"></span>${esc(p.name)}${p.latencyMs ? ` <span class="muted">${p.latencyMs}ms</span>` : ''}</span>`
  ).join('');

  view.innerHTML = head('Inicio', `Hermes ${esc(s.version)} · ${esc(h.hostname)}`) + `
    <div class="grid cols-4">
      <div class="card"><h3>CPU</h3><div class="stat">${h.cpuPct}%</div><div class="bar"><span style="width:${h.cpuPct}%"></span></div><div class="stat-sub">${h.cpuCount} núcleos · carga ${h.load1}</div></div>
      <div class="card"><h3>Memoria</h3><div class="stat">${h.memPct}%</div><div class="bar"><span style="width:${h.memPct}%"></span></div><div class="stat-sub">${fmtBytes(h.memUsed)} / ${fmtBytes(h.memTotal)}</div></div>
      <div class="card"><h3>Gateway</h3><div class="stat">${g.running ? '🟢 Activo' : '🔴 Parado'}</div><div class="stat-sub">${g.running ? 'uptime ' + fmtUptime(g.uptimeSec) + ' · pid ' + g.pid : 'detenido'}</div></div>
      <div class="card"><h3>Uptime sistema</h3><div class="stat">${fmtUptime(h.uptimeSec)}</div><div class="stat-sub">${esc(h.platform)}</div></div>
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <div class="card"><h3>Plataformas conectadas</h3><div class="row" style="gap:18px">${platforms || '<span class="muted">sin gateway</span>'}</div></div>
      <div class="card"><h3>Atajos</h3><div class="row">
        <a class="btn" href="#chat">💬 Abrir chat</a>
        <a class="btn" href="#agents">🤖 Agentes</a>
        <a class="btn" href="#usage">📊 Uso de tokens</a>
        <a class="btn" href="#recommendations">💡 Recomendaciones</a>
      </div></div>
    </div>`;
}

async function renderAgents(view) {
  const [agents, g] = await Promise.all([api('/agents'), api('/gateway')]);
  const rows = agents.map((a) => `
    <tr>
      <td><strong>${esc(a.name)}</strong></td>
      <td class="mono muted">${esc(a.model)}</td>
      <td>${esc(a.personality || '—')}</td>
      <td>${(a.gateways || []).map((x) => `<span class="badge">${esc(x)}</span>`).join(' ') || '<span class="muted">—</span>'}</td>
      <td>${a.sessions ?? 0}</td>
      <td><span class="badge ${a.status === 'online' ? 'ok' : 'warn'}">${esc(a.status)}</span></td>
    </tr>`).join('');

  view.innerHTML = head('Agentes', 'Perfiles y ciclo de vida del gateway',
    `<button class="btn primary" data-gw="restart">↻ Reiniciar gateway</button>
     <button class="btn ${g.running ? 'danger' : 'primary'}" data-gw="${g.running ? 'stop' : 'start'}">${g.running ? '⏹ Parar' : '▶ Iniciar'}</button>`) + `
    <div class="card"><table>
      <thead><tr><th>Perfil</th><th>Modelo</th><th>Personalidad</th><th>Gateways</th><th>Sesiones</th><th>Estado</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;

  view.querySelectorAll('[data-gw]').forEach((b) => b.addEventListener('click', async () => {
    try { const r = await api('/gateway/' + b.dataset.gw, { method: 'POST', body: {} }); toast(r.output || 'OK'); router(); }
    catch (e) { toast(e.message, 'err'); }
  }));
}

async function renderSkills(view) {
  const skills = await api('/skills');
  const rows = skills.map((s) => `
    <tr>
      <td><strong>${esc(s.name)}</strong></td>
      <td class="muted">${esc(s.desc || '')}</td>
      <td><span class="badge">${esc(s.source)}</span></td>
      <td>${s.installed ? '<span class="badge ok">instalada</span>' : '<span class="badge">disponible</span>'}</td>
      <td>${s.installed
        ? `<button class="btn sm danger" data-act="remove" data-name="${esc(s.name)}">Quitar</button>`
        : `<button class="btn sm primary" data-act="install" data-name="${esc(s.name)}">Instalar</button>`}</td>
    </tr>`).join('');

  view.innerHTML = head('Skills', 'Procedimientos reutilizables que Hermes carga bajo demanda') + `
    <div class="card"><table>
      <thead><tr><th>Skill</th><th>Descripción</th><th>Origen</th><th>Estado</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;

  view.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    try { const r = await api('/skills/' + b.dataset.act, { method: 'POST', body: { name: b.dataset.name } }); toast(r.output || 'OK'); router(); }
    catch (e) { toast(e.message, 'err'); }
  }));
}

async function renderMcp(view) {
  const servers = await api('/mcp');
  const rows = servers.map((s) => `
    <tr>
      <td><strong>${esc(s.name)}</strong></td>
      <td><span class="badge">${esc(s.transport)}</span></td>
      <td>${s.tools} tools</td>
      <td><span class="dot ${s.running ? 'ok' : 'err'}"></span> ${s.running ? 'activo' + (s.pid ? ' · pid ' + s.pid : '') : 'parado'}</td>
      <td class="row">
        <button class="btn sm" data-act="restart" data-name="${esc(s.name)}">↻</button>
        <button class="btn sm ${s.running ? 'danger' : 'primary'}" data-act="${s.running ? 'stop' : 'start'}" data-name="${esc(s.name)}">${s.running ? 'Parar' : 'Iniciar'}</button>
      </td>
    </tr>`).join('');

  view.innerHTML = head('MCP', 'Plano de control de servidores Model Context Protocol') + `
    <div class="card"><table>
      <thead><tr><th>Servidor</th><th>Transporte</th><th>Tools</th><th>Estado</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;

  view.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    try { const r = await api('/mcp/' + b.dataset.act, { method: 'POST', body: { name: b.dataset.name } }); toast(r.output || 'OK'); router(); }
    catch (e) { toast(e.message, 'err'); }
  }));
}

async function renderCron(view) {
  const jobs = await api('/cron');
  const rows = jobs.map((j) => `
    <tr>
      <td><strong>${esc(j.name)}</strong></td>
      <td class="mono">${esc(j.schedule || j.natural)}</td>
      <td>${j.skill ? `<span class="badge">${esc(j.skill)}</span>` : '<span class="muted">—</span>'}</td>
      <td>${esc(j.target)}</td>
      <td>${j.lastRun ? new Date(j.lastRun).toLocaleString('es') : '<span class="muted">nunca</span>'}</td>
      <td><span class="badge ${j.enabled ? 'ok' : ''}">${j.enabled ? 'activo' : 'pausado'}</span></td>
      <td class="row">
        <button class="btn sm" data-toggle="${j.id}">${j.enabled ? 'Pausar' : 'Activar'}</button>
        <button class="btn sm danger" data-del="${j.id}">✕</button>
      </td>
    </tr>`).join('');

  view.innerHTML = head('Cron', 'Tareas programadas en lenguaje natural o expresión cron') + `
    <div class="card" style="margin-bottom:16px">
      <h3>Nueva tarea</h3>
      <div class="grid cols-4">
        <div><label>Nombre</label><input id="c-name" placeholder="resumen-diario"></div>
        <div><label>Cuándo (natural o cron)</label><input id="c-when" placeholder="cada día a las 8:00"></div>
        <div><label>Skill (opcional)</label><input id="c-skill" placeholder="web-research"></div>
        <div><label>Destino</label><select id="c-target"><option>local</option><option>telegram</option><option>discord</option><option>slack</option></select></div>
      </div>
      <div style="margin-top:12px"><button class="btn primary" id="c-add">+ Crear tarea</button></div>
    </div>
    <div class="card"><table>
      <thead><tr><th>Nombre</th><th>Programación</th><th>Skill</th><th>Destino</th><th>Última ejecución</th><th>Estado</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;

  $('#c-add', view).addEventListener('click', async () => {
    const name = $('#c-name', view).value.trim();
    const when = $('#c-when', view).value.trim();
    if (!name || !when) return toast('Nombre y programación son obligatorios', 'err');
    const isCron = /[\d*]/.test(when) && when.split(' ').length >= 5;
    try {
      await api('/cron', { method: 'POST', body: { name, schedule: isCron ? when : '', natural: isCron ? '' : when, skill: $('#c-skill', view).value.trim(), target: $('#c-target', view).value } });
      toast('Tarea creada'); router();
    } catch (e) { toast(e.message, 'err'); }
  });
  view.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
    try { await api('/cron/' + b.dataset.toggle + '/toggle', { method: 'POST', body: {} }); router(); } catch (e) { toast(e.message, 'err'); }
  }));
  view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    try { await api('/cron/' + b.dataset.del, { method: 'DELETE' }); toast('Eliminada'); router(); } catch (e) { toast(e.message, 'err'); }
  }));
}

async function renderUsage(view) {
  const u = await api('/usage');
  const pct = Math.min(100, Math.round((u.totalCost / u.monthlyBudget) * 100));
  view.innerHTML = head('Uso de tokens', 'Tendencias, coste por modelo y proyección de presupuesto') + `
    <div class="grid cols-3">
      <div class="card"><h3>Coste (14 días)</h3><div class="stat">$${u.totalCost}</div></div>
      <div class="card"><h3>Presupuesto mensual</h3><div class="stat">${pct}%</div><div class="bar"><span style="width:${pct}%;background:${pct > 85 ? 'var(--err)' : 'var(--accent)'}"></span></div><div class="stat-sub">$${u.totalCost} / $${u.monthlyBudget}</div></div>
      <div class="card"><h3>Tokens hoy</h3><div class="stat">${fmtNum((u.days.at(-1)?.inputTokens || 0) + (u.days.at(-1)?.outputTokens || 0))}</div></div>
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <div class="card"><h3>Tokens por día</h3><canvas id="ch-tokens" height="140"></canvas></div>
      <div class="card"><h3>Coste por modelo</h3><canvas id="ch-models" height="140"></canvas></div>
    </div>`;

  const labels = u.days.map((d) => d.date.slice(5));
  const gridColor = 'rgba(255,255,255,.06)';
  new Chart($('#ch-tokens', view), {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Entrada', data: u.days.map((d) => d.inputTokens), backgroundColor: '#6c8cff' },
      { label: 'Salida', data: u.days.map((d) => d.outputTokens), backgroundColor: '#41d6a0' },
    ]},
    options: { responsive: true, plugins: { legend: { labels: { color: '#8b97ad' } } }, scales: { x: { stacked: true, ticks: { color: '#8b97ad' }, grid: { color: gridColor } }, y: { stacked: true, ticks: { color: '#8b97ad' }, grid: { color: gridColor } } } },
  });
  new Chart($('#ch-models', view), {
    type: 'doughnut',
    data: { labels: u.byModel.map((m) => m.model), datasets: [{ data: u.byModel.map((m) => m.cost), backgroundColor: ['#6c8cff', '#41d6a0', '#ffb454', '#ff6b6b'] }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#8b97ad' } } } },
  });
}

async function renderLogs(view) {
  view.innerHTML = head('Logs', 'Registros del agente, gateway y errores',
    `<select id="lg-kind"><option value="gateway">gateway</option><option value="agent">agent</option><option value="error">error</option></select>
     <button class="btn" id="lg-refresh">↻ Actualizar</button>`) + `<div class="console" id="lg-out">cargando…</div>`;

  async function load() {
    const kind = $('#lg-kind', view).value;
    const data = await api('/logs?kind=' + kind + '&lines=200');
    $('#lg-out', view).innerHTML = data.lines.map((l) => {
      const m = l.match(/\[(INFO|DEBUG|WARN|ERROR)\]/);
      const cls = m ? 'lg-' + m[1] : '';
      return `<div class="${cls}">${esc(l)}</div>`;
    }).join('');
  }
  $('#lg-refresh', view).addEventListener('click', load);
  $('#lg-kind', view).addEventListener('change', load);
  load();
}

async function renderFiles(view) {
  view.innerHTML = head('Archivos', 'Explora y edita ficheros del directorio de proyectos') + `
    <div class="files-cols">
      <div class="card"><div id="f-crumb" class="muted mono" style="margin-bottom:8px"></div><ul class="file-list" id="f-list"></ul></div>
      <div class="card editor"><div id="f-title" class="muted mono" style="margin-bottom:8px">Selecciona un archivo</div>
        <textarea id="f-content" placeholder="(contenido del archivo)"></textarea>
        <div style="margin-top:10px"><button class="btn primary" id="f-save" disabled>Guardar</button></div>
      </div>
    </div>`;
  let cur = '';
  async function browse(p) {
    const data = await api('/files?path=' + encodeURIComponent(p));
    cur = p;
    $('#f-crumb', view).textContent = '/' + (p || '');
    const list = $('#f-list', view); list.innerHTML = '';
    if (p) list.appendChild(el(`<li data-dir="${esc(p.split('/').slice(0, -1).join('/'))}">📁 ..</li>`));
    data.entries.forEach((e) => list.appendChild(el(`<li data-${e.dir ? 'dir' : 'file'}="${esc((p ? p + '/' : '') + e.name)}">${e.dir ? '📁' : '📄'} ${esc(e.name)}</li>`)));
    list.querySelectorAll('[data-dir]').forEach((li) => li.addEventListener('click', () => browse(li.dataset.dir)));
    list.querySelectorAll('[data-file]').forEach((li) => li.addEventListener('click', () => openFile(li.dataset.file)));
  }
  async function openFile(p) {
    const data = await api('/files?path=' + encodeURIComponent(p));
    $('#f-title', view).textContent = '/' + p;
    $('#f-content', view).value = data.content;
    const btn = $('#f-save', view); btn.disabled = !!data.readOnly;
    btn.onclick = async () => {
      try { await api('/files', { method: 'POST', body: { path: p, content: $('#f-content', view).value } }); toast('Guardado'); }
      catch (e) { toast(e.message, 'err'); }
    };
  }
  browse('');
}

let chatWs = null;
async function renderChat(view) {
  const agents = await api('/agents').catch(() => []);
  const opts = agents.map((a) => `<option value="${esc(a.name)}">${esc(a.name)}</option>`).join('');
  view.innerHTML = head('Chat', 'Conversa con Hermes en tiempo real',
    `<select id="ch-profile">${opts || '<option>default</option>'}</select>`) + `
    <div class="chat-wrap">
      <div class="chat-log" id="ch-log"></div>
      <div class="chat-input">
        <textarea id="ch-text" placeholder="Escribe un mensaje… (Enter para enviar)"></textarea>
        <button class="btn primary" id="ch-send">Enviar</button>
      </div>
    </div>`;
  const log = $('#ch-log', view);
  function add(cls, text) { const m = el(`<div class="msg ${cls}"></div>`); m.textContent = text; log.appendChild(m); log.scrollTop = log.scrollHeight; return m; }

  if (chatWs) { try { chatWs.close(); } catch {} }
  chatWs = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  let cur = null;
  chatWs.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === 'start') cur = add('bot', '');
    else if (m.type === 'chunk' && cur) { cur.textContent += m.text; log.scrollTop = log.scrollHeight; }
    else if (m.type === 'done') cur = null;
    else if (m.type === 'error') add('bot', '⚠️ ' + m.error);
  };

  function send() {
    const text = $('#ch-text', view).value.trim();
    if (!text) return;
    add('user', text);
    $('#ch-text', view).value = '';
    if (chatWs.readyState === 1) chatWs.send(JSON.stringify({ type: 'chat', prompt: text, profile: $('#ch-profile', view).value }));
    else add('bot', '⚠️ conexión no disponible');
  }
  $('#ch-send', view).addEventListener('click', send);
  $('#ch-text', view).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
}

async function renderRecs(view) {
  const r = await api('/recommendations');
  const c = r.channel;
  const groups = r.groups.map((g) => `
    <div class="card rec-group">
      <h3>${esc(g.title)} <span class="tag ${g.from}">${g.from === 'channel' ? 'del canal' : 'mejora extra'}</span></h3>
      <ul class="rec-list">${g.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>`).join('');
  view.innerHTML = head('Recomendaciones', 'Consejos para sacarle 10× a Hermes') + `
    <div class="card" style="margin-bottom:16px">
      <h3>Fuente</h3>
      <p>Basado en el vídeo <strong>“${esc(c.title)}”</strong> de <strong>${esc(c.author)}</strong> (${esc(c.handle)}) — <a href="${esc(c.url)}" target="_blank" rel="noopener">ver en YouTube</a> — ampliado con mejoras de la documentación oficial de Hermes.</p>
    </div>
    <div class="grid cols-2">${groups}</div>`;
}

// ---------- boot ----------
initAuth();
