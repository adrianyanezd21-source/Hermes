// Hermes Control Panel — SPA (vanilla JS)
'use strict';

const state = { csrf: null, charts: {}, user: null };

function can(perm) {
  const u = state.user;
  if (!u) return false;
  if (u.role === 'admin') return true;
  return (u.permissions || []).includes(perm);
}

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
  if (me.authed) { state.csrf = me.csrf; state.user = me.user; startApp(); }
  else showLogin();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('#login-user').value.trim() || 'admin';
  const password = $('#login-pass').value;
  const res = await fetch('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (res.ok) { state.csrf = data.csrf; state.user = data.user; $('#login-pass').value = ''; $('#login-error').textContent = ''; startApp(); }
  else $('#login-error').textContent = data.error || 'Error';
});

$('#logout').addEventListener('click', async () => {
  await fetch('/auth/logout', { method: 'POST' });
  state.csrf = null; showLogin();
});

// ---------- navigation ----------
const PAGES = [
  { id: 'home', ic: '🏠', name: 'Inicio', perm: 'view_home', render: renderHome },
  { id: 'chat', ic: '💬', name: 'Chat', perm: 'view_chat', render: renderChat },
  { id: 'agents', ic: '🤖', name: 'Agentes', perm: 'view_agents', render: renderAgents },
  { id: 'agent', ic: '🤖', name: 'Agente', perm: 'view_agents', hidden: true, render: renderAgentDetail },
  { id: 'office', ic: '🏢', name: 'Office', perm: 'view_office', render: renderOffice },
  { id: 'workspace', ic: '🗂️', name: 'Workspace', perm: 'view_files', render: renderWorkspace },
  { id: 'skills', ic: '🧩', name: 'Skills', perm: 'view_skills', render: renderSkills },
  { id: 'cron', ic: '⏰', name: 'Cron', perm: 'view_cron', render: renderCron },
  { id: 'mcp', ic: '🔌', name: 'MCP', perm: 'view_mcp', render: renderMcp },
  { id: 'files', ic: '📁', name: 'Archivos', perm: 'view_files', render: renderFiles },
  { id: 'terminal', ic: '🖥️', name: 'Terminal', perm: 'use_terminal', render: renderTerminal },
  { id: 'monitor', ic: '📈', name: 'Monitor', perm: 'view_monitor', render: renderMonitor },
  { id: 'usage', ic: '📊', name: 'Uso', perm: 'view_usage', render: renderUsage },
  { id: 'logs', ic: '📜', name: 'Logs', perm: 'view_logs', render: renderLogs },
  { id: 'maintenance', ic: '🛠️', name: 'Mantenimiento', perm: 'manage_maintenance', render: renderMaintenance },
  { id: 'users', ic: '👥', name: 'Usuarios', perm: 'manage_users', render: renderUsers },
  { id: 'recommendations', ic: '💡', name: 'Recomendaciones', perm: 'view_home', render: renderRecs },
  { id: 'settings', ic: '⚙️', name: 'Ajustes', perm: 'view_home', render: renderSettings },
];

function visiblePages() {
  return PAGES.filter((p) => !p.hidden && can(p.perm));
}

function buildNav() {
  const nav = $('#nav'); nav.innerHTML = '';
  visiblePages().forEach((p) => {
    const a = el(`<a class="nav-item" href="#${p.id}"><span class="ic">${p.ic}</span><span>${p.name}</span></a>`);
    nav.appendChild(a);
  });
  // usuario en el pie
  const foot = $('.sidebar-foot');
  let u = $('#who', foot);
  if (!u && state.user) {
    u = el(`<span id="who" class="muted" style="font-size:11px; margin-right:auto">👤 ${esc(state.user.username)} <span class="badge">${esc(state.user.role)}</span></span>`);
    foot.insertBefore(u, foot.firstChild);
  }
}

function setActive(id) {
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.getAttribute('href') === '#' + id));
}

async function router() {
  const raw = (location.hash.slice(1) || 'home');
  const [id, arg] = raw.split('/');
  const page = PAGES.find((p) => p.id === id) || PAGES[0];
  if (page.perm && !can(page.perm)) {
    $('#view').innerHTML = `<div class="card"><h3>Acceso denegado</h3><p class="muted">No tienes permiso para ver esta sección.</p></div>`;
    return;
  }
  setActive(page.id);
  const view = $('#view');
  teardownTransient();
  view.innerHTML = '<div class="loading">Cargando…</div>';
  try { await page.render(view, arg); }
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
  const [agents, prov] = await Promise.all([
    api('/agents').catch(() => []),
    api('/chat/provider').catch(() => ({ label: 'Demo', free: true })),
  ]);
  const opts = agents.map((a) => `<option value="${esc(a.name)}">${esc(a.name)}</option>`).join('');
  const provBadge = `<span class="badge ${prov.free ? 'ok' : ''}" title="Proveedor de chat activo">${prov.free ? '🆓 ' : ''}${esc(prov.label || prov.provider)}</span>`;

  // Voz: TTS y reconocimiento por micrófono vía Web Speech API (gratis, en el navegador).
  const ttsOk = 'speechSynthesis' in window;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micOk = !!SR;

  view.innerHTML = head('Chat', 'Agente de IA: voz gratis, comandos slash, modo Plan y nivel de pensamiento',
    `${provBadge}
     <button class="btn sm" id="ch-plan" title="Modo Plan: propone un plan antes de actuar">📋 Plan: off</button>
     <select id="ch-think" title="Nivel de pensamiento"><option value="">🧠 normal</option><option value="low">🧠 bajo</option><option value="medium">🧠 medio</option><option value="high">🧠 alto</option></select>
     <button class="btn sm" id="ch-tts" title="Leer respuestas en voz alta">🔊 Voz: off</button>
     <select id="ch-voice" title="Voz" style="max-width:150px"></select>
     <select id="ch-profile">${opts || '<option>default</option>'}</select>
     <button class="btn sm" id="ch-new" title="Nueva sesión">✨ Nueva</button>`) + `
    <div class="chat-wrap">
      <div class="chat-log" id="ch-log"></div>
      <div class="chat-input">
        <button class="btn" id="ch-mic" title="Hablar (dictar)" ${micOk ? '' : 'disabled'}>🎤</button>
        <textarea id="ch-text" placeholder="Escribe, pulsa 🎤, o usa /help para ver comandos… (Enter para enviar)"></textarea>
        <button class="btn primary" id="ch-send">Enviar</button>
        <button class="btn danger" id="ch-stop" title="Detener" style="display:none">⏹</button>
      </div>
    </div>`;
  const log = $('#ch-log', view);
  function add(cls, text) { const m = el(`<div class="msg ${cls}"></div>`); m.textContent = text; log.appendChild(m); log.scrollTop = log.scrollHeight; return m; }

  // Modo Plan + nivel de pensamiento (inspirado en OpenCode / Claude Code)
  let planMode = false;
  $('#ch-plan', view).addEventListener('click', () => {
    planMode = !planMode;
    $('#ch-plan', view).textContent = planMode ? '📋 Plan: on' : '📋 Plan: off';
    $('#ch-plan', view).classList.toggle('primary', planMode);
  });
  $('#ch-new', view).addEventListener('click', () => { log.innerHTML = ''; add('bot', '✨ Nueva sesión. Escribe /help para ver los comandos.'); });

  const COMMANDS = {
    '/help': 'Comandos: /help, /clear, /new, /plan on|off, /think low|medium|high, /status, /model. El resto se envía al agente.',
    '/clear': '__clear__', '/new': '__clear__',
  };

  // ----- Text-to-speech (gratis) -----
  let ttsOn = false;
  const voiceSel = $('#ch-voice', view);
  function loadVoices() {
    if (!ttsOk) return;
    const voices = speechSynthesis.getVoices();
    const es = voices.filter((v) => /es(-|_)/i.test(v.lang));
    const list = (es.length ? es : voices);
    voiceSel.innerHTML = list.map((v) => `<option value="${esc(v.name)}">${esc(v.name)} (${esc(v.lang)})</option>`).join('') || '<option>—</option>';
  }
  if (ttsOk) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  } else {
    $('#ch-tts', view).disabled = true;
    voiceSel.style.display = 'none';
  }
  function speak(text) {
    if (!ttsOn || !ttsOk || !text.trim()) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = speechSynthesis.getVoices().find((x) => x.name === voiceSel.value);
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'es-ES'; }
    u.rate = 1; u.pitch = 1;
    speechSynthesis.speak(u);
  }
  $('#ch-tts', view).addEventListener('click', () => {
    ttsOn = !ttsOn;
    $('#ch-tts', view).textContent = ttsOn ? '🔊 Voz: on' : '🔊 Voz: off';
    $('#ch-tts', view).classList.toggle('primary', ttsOn);
    if (!ttsOn) speechSynthesis.cancel();
    else speak('Voz activada');
  });

  // ----- Micrófono / dictado (gratis) -----
  if (micOk) {
    let rec = null, listening = false;
    $('#ch-mic', view).addEventListener('click', () => {
      if (listening) { rec && rec.stop(); return; }
      rec = new SR();
      rec.lang = 'es-ES';
      rec.interimResults = true;
      rec.continuous = false;
      listening = true;
      $('#ch-mic', view).classList.add('primary');
      $('#ch-mic', view).textContent = '⏺';
      let finalText = '';
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const tr = e.results[i];
          if (tr.isFinal) finalText += tr[0].transcript;
          else interim += tr[0].transcript;
        }
        $('#ch-text', view).value = (finalText + interim).trim();
      };
      rec.onerror = () => toast('No se pudo usar el micrófono', 'err');
      rec.onend = () => {
        listening = false;
        $('#ch-mic', view).classList.remove('primary');
        $('#ch-mic', view).textContent = '🎤';
      };
      rec.start();
    });
  }

  if (prov.provider === 'demo') {
    add('bot', '⚠️ Modo demo: las respuestas son simuladas. Para respuestas reales gratis, configura un modelo :free de OpenRouter en .env (LLM_BASE_URL). La voz 🔊 y el micrófono 🎤 funcionan en cualquier modo (gratis, vía el navegador).');
  }

  if (chatWs) { try { chatWs.close(); } catch {} }
  chatWs = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  let cur = null;
  let speakBuf = '';
  function setBusy(b) { $('#ch-send', view).style.display = b ? 'none' : ''; $('#ch-stop', view).style.display = b ? '' : 'none'; }
  chatWs.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === 'start') { cur = add('bot', ''); speakBuf = ''; setBusy(true); }
    else if (m.type === 'chunk' && cur) { cur.textContent += m.text; speakBuf += m.text; log.scrollTop = log.scrollHeight; }
    else if (m.type === 'done') { speak(speakBuf); cur = null; setBusy(false); }
    else if (m.type === 'error') { add('bot', '⚠️ ' + m.error); setBusy(false); }
  };
  $('#ch-stop', view).addEventListener('click', () => {
    if (ttsOk) speechSynthesis.cancel();
    setBusy(false);
    if (cur) { cur.textContent += ' …(detenido)'; cur = null; }
  });

  function handleCommand(text) {
    const [cmd, ...rest] = text.split(/\s+/);
    const arg = rest.join(' ').trim();
    switch (cmd) {
      case '/help': add('bot', COMMANDS['/help']); return true;
      case '/clear': case '/new': log.innerHTML = ''; add('bot', '✨ Sesión limpiada.'); return true;
      case '/plan': planMode = (arg === 'on'); $('#ch-plan', view).textContent = planMode ? '📋 Plan: on' : '📋 Plan: off'; $('#ch-plan', view).classList.toggle('primary', planMode); add('bot', 'Modo Plan: ' + (planMode ? 'activado' : 'desactivado')); return true;
      case '/think': { const sel = $('#ch-think', view); if (['low', 'medium', 'high', ''].includes(arg)) { sel.value = arg; add('bot', 'Nivel de pensamiento: ' + (arg || 'normal')); } else add('bot', 'Uso: /think low|medium|high'); return true; }
      case '/status': add('bot', `Proveedor: ${prov.label || prov.provider} · Modelo: ${prov.model || '—'} · Plan: ${planMode ? 'on' : 'off'} · Pensamiento: ${$('#ch-think', view).value || 'normal'}`); return true;
      case '/model': add('bot', `Modelo actual: ${prov.model || '—'}. Cámbialo en .env (LLM_MODEL) y reinicia.`); return true;
      default: return false;
    }
  }

  function send() {
    const raw = $('#ch-text', view).value.trim();
    if (!raw) return;
    add('user', raw);
    $('#ch-text', view).value = '';
    if (raw.startsWith('/') && handleCommand(raw)) return;
    // Construir el prompt efectivo con directivas de Plan / pensamiento.
    let prompt = raw;
    const think = $('#ch-think', view).value;
    const directives = [];
    if (planMode) directives.push('Primero propón un PLAN numerado de los pasos antes de ejecutar nada; espera confirmación.');
    if (think === 'high') directives.push('Razona en profundidad antes de responder.');
    else if (think === 'medium') directives.push('Razona los puntos clave antes de responder.');
    if (directives.length) prompt = directives.join(' ') + '\n\n' + raw;
    if (chatWs.readyState === 1) chatWs.send(JSON.stringify({ type: 'chat', prompt, profile: $('#ch-profile', view).value }));
    else add('bot', '⚠️ conexión no disponible');
  }
  $('#ch-send', view).addEventListener('click', send);
  $('#ch-text', view).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

  // Handoff desde Workspace
  const handoff = sessionStorage.getItem('ws-handoff');
  if (handoff) { sessionStorage.removeItem('ws-handoff'); $('#ch-text', view).value = handoff; }
}

// ---------- Office (PixiJS isometric animated office) ----------
let officeApp = null;
let officeTimer = null;
let officeAgentSprites = {};

function teardownTransient() {
  if (window.__pageTimer) { clearInterval(window.__pageTimer); window.__pageTimer = null; }
  if (officeTimer) { clearInterval(officeTimer); officeTimer = null; }
  if (officeApp) { try { officeApp.destroy(true, { children: true }); } catch {} officeApp = null; }
  officeAgentSprites = {};
}

const STATE_META = {
  idle: { color: 0x8b97ad, emoji: '💤', label: 'Inactivo' },
  thinking: { color: 0xffb454, emoji: '💭', label: 'Pensando' },
  coding: { color: 0x41d6a0, emoji: '💻', label: 'Programando' },
  running: { color: 0x6c8cff, emoji: '🟢', label: 'Ejecutando' },
  blocked: { color: 0xff6b6b, emoji: '⚠️', label: 'Bloqueado' },
};

async function renderOffice(view) {
  view.innerHTML = head('Office', 'Oficina virtual animada de tus agentes (ZOO Swarm Monitor)') + `
    <div class="grid" style="grid-template-columns: 1fr 320px; gap:16px; align-items:start">
      <div class="card" style="padding:0; overflow:hidden">
        <div id="office-floor" style="width:100%; height:440px; background:#0a0e18"></div>
      </div>
      <div class="card"><h3>Agentes</h3><div id="office-agents"></div></div>
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <div class="card"><h3>📋 Pipeline (kanban)</h3><div id="office-kanban"></div></div>
      <div class="card"><h3>📡 Live Feed</h3><div class="console" id="office-feed" style="max-height:240px"></div></div>
    </div>`;

  if (!window.PIXI) { $('#office-floor', view).innerHTML = '<div class="loading">No se pudo cargar PixiJS</div>'; }

  const floor = $('#office-floor', view);
  const W = floor.clientWidth || 800, H = 440;

  officeApp = new PIXI.Application();
  await officeApp.init({ width: W, height: H, background: 0x0a0e18, antialias: true });
  floor.appendChild(officeApp.canvas);

  // --- Isometric floor ---
  const TILE_W = 92, TILE_H = 46, COLS = 5, ROWS = 4;
  const originX = W / 2, originY = 70;
  const toIso = (c, r) => ({ x: originX + (c - r) * (TILE_W / 2), y: originY + (c + r) * (TILE_H / 2) });

  const floorG = new PIXI.Graphics();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = toIso(c, r);
      floorG.moveTo(p.x, p.y)
        .lineTo(p.x + TILE_W / 2, p.y + TILE_H / 2)
        .lineTo(p.x, p.y + TILE_H)
        .lineTo(p.x - TILE_W / 2, p.y + TILE_H / 2)
        .lineTo(p.x, p.y)
        .fill({ color: (c + r) % 2 ? 0x131a29 : 0x172033 })
        .stroke({ color: 0x243049, width: 1 });
    }
  }
  officeApp.stage.addChild(floorG);

  // --- Desks (one per agent slot) ---
  const deskSlots = [{ c: 1, r: 0 }, { c: 3, r: 0 }, { c: 1, r: 2 }, { c: 3, r: 2 }];
  deskSlots.forEach((s) => {
    const p = toIso(s.c, s.r);
    const desk = new PIXI.Graphics();
    desk.rect(p.x - 26, p.y + 6, 52, 22).fill({ color: 0x2a3550 }).stroke({ color: 0x3a4a6b, width: 1 });
    officeApp.stage.addChild(desk);
  });

  // --- Agent characters ---
  function makeAgent(a, slot) {
    const cont = new PIXI.Container();
    const body = new PIXI.Graphics();
    body.circle(0, 0, 13).fill({ color: a.color || 0x6c8cff });
    body.circle(0, -3, 5).fill({ color: 0xffffff, alpha: 0.85 });
    const ring = new PIXI.Graphics();
    ring.circle(0, 0, 17).stroke({ color: STATE_META[a.state]?.color || 0x8b97ad, width: 3 });
    const label = new PIXI.Text({ text: a.name, style: { fontSize: 11, fill: 0xe6ebf5, fontFamily: 'monospace' } });
    label.anchor.set(0.5); label.y = 26;
    const emoji = new PIXI.Text({ text: STATE_META[a.state]?.emoji || '', style: { fontSize: 14 } });
    emoji.anchor.set(0.5); emoji.y = -24;
    cont.addChild(ring, body, emoji, label);
    const p = toIso(slot.c, slot.r);
    cont.x = p.x; cont.y = p.y - 6;
    cont._home = { x: p.x, y: p.y - 6 };
    cont._ring = ring; cont._emoji = emoji;
    officeApp.stage.addChild(cont);
    return cont;
  }

  // bob animation
  let tick = 0;
  officeApp.ticker.add(() => {
    tick += 0.05;
    Object.values(officeAgentSprites).forEach((s, i) => {
      s.y = s._home.y + Math.sin(tick + i) * 3;
    });
  });

  async function refresh() {
    let data;
    try { data = await api('/office/agent-states'); } catch { return; }
    const agents = data.agents || [];
    // floor sprites
    agents.forEach((a, i) => {
      const slot = deskSlots[i % deskSlots.length];
      if (!officeAgentSprites[a.name]) officeAgentSprites[a.name] = makeAgent(a, slot);
      const sp = officeAgentSprites[a.name];
      sp._ring.clear().circle(0, 0, 17).stroke({ color: STATE_META[a.state]?.color || 0x8b97ad, width: 3 });
      sp._emoji.text = STATE_META[a.state]?.emoji || '';
    });
    // side list
    $('#office-agents', view).innerHTML = agents.map((a) => {
      const m = STATE_META[a.state] || {};
      return `<div class="row" style="justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--line)">
        <div><strong>${esc(a.name)}</strong><div class="muted" style="font-size:12px">${esc(a.role || '')}</div></div>
        <div style="text-align:right"><span class="badge">${m.emoji || ''} ${esc(m.label || a.state)}</span><div class="muted" style="font-size:11px">${esc(a.task || '')}</div></div>
      </div>`;
    }).join('');

    // kanban + feed
    try {
      const kb = await api('/office/kanban?board=main');
      const cols = ['triage', 'todo', 'running', 'review', 'done'];
      const names = { triage: '🔍 Triage', todo: '📋 Todo', running: '🔄 Activo', review: '👁️ Review', done: '✅ Hecho' };
      $('#office-kanban', view).innerHTML = `<div class="row" style="align-items:flex-start; gap:8px">` + cols.map((c) => {
        const items = (kb.tasks || []).filter((t) => t.status === c);
        return `<div style="flex:1; min-width:0"><div class="muted" style="font-size:11px; margin-bottom:6px">${names[c]} (${items.length})</div>` +
          items.map((t) => `<div class="badge" style="display:block; margin-bottom:6px; white-space:normal; text-align:left">${esc(t.title)}<br><span class="muted">@${esc(t.agent)}</span></div>`).join('') + `</div>`;
      }).join('') + `</div>`;
    } catch {}
    try {
      const ev = await api('/office/events');
      $('#office-feed', view).innerHTML = (ev.events || []).map((e) =>
        `<div><span class="muted">${new Date(e.ts).toLocaleTimeString('es')}</span> <span class="lg-INFO">@${esc(e.agent)}</span> ${esc(e.text)}</div>`).join('');
    } catch {}
  }

  await refresh();
  officeTimer = setInterval(refresh, 4000);
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

// ---------- Agente (detalle) ----------
async function renderAgentDetail(view, profile) {
  if (!profile) { location.hash = '#agents'; return; }
  const [sessions, mem, cfg] = await Promise.all([
    api('/agents/' + encodeURIComponent(profile) + '/sessions').catch(() => []),
    api('/agents/' + encodeURIComponent(profile) + '/memory').catch(() => ({ files: {} })),
    api('/agents/' + encodeURIComponent(profile) + '/config').catch(() => ({ yaml: '' })),
  ]);
  const memFiles = Object.keys(mem.files || {});
  view.innerHTML = head('Agente: ' + esc(profile), 'Sesiones, memoria y configuración',
    `<a class="btn" href="#agents">← Agentes</a>`) + `
    <div class="tabs row" style="margin-bottom:14px">
      <button class="btn sm primary" data-tab="sessions">Sesiones</button>
      <button class="btn sm" data-tab="memory">Memoria</button>
      <button class="btn sm" data-tab="config">Config (YAML)</button>
    </div>
    <div id="ad-body"></div>`;
  const body = $('#ad-body', view);
  const tabs = {
    sessions: () => `<div class="card"><table><thead><tr><th>Sesión</th><th>Plataforma</th><th>Mensajes</th><th>Actualizada</th></tr></thead><tbody>` +
      sessions.map((s) => `<tr><td>${esc(s.title)}</td><td><span class="badge">${esc(s.platform)}</span></td><td>${s.messages}</td><td class="muted">${new Date(s.updated).toLocaleString('es')}</td></tr>`).join('') + `</tbody></table></div>`,
    memory: () => `<div class="grid cols-2">` + memFiles.map((f) => `
      <div class="card"><h3>${esc(f)}</h3>
        <textarea data-mem="${esc(f)}" style="width:100%;height:240px;font-family:ui-monospace,monospace">${esc(mem.files[f])}</textarea>
        <div style="margin-top:8px"><button class="btn primary sm" data-savemem="${esc(f)}">Guardar</button></div>
      </div>`).join('') + `</div>`,
    config: () => `<div class="card"><textarea id="ad-cfg" style="width:100%;height:340px;font-family:ui-monospace,monospace">${esc(cfg.yaml)}</textarea>
      <div style="margin-top:8px"><button class="btn primary" id="ad-savecfg">Guardar config</button></div></div>`,
  };
  function show(tab) {
    view.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('primary', b.dataset.tab === tab));
    body.innerHTML = tabs[tab]();
    body.querySelectorAll('[data-savemem]').forEach((b) => b.addEventListener('click', async () => {
      const f = b.dataset.savemem; const content = body.querySelector(`[data-mem="${f}"]`).value;
      try { const r = await api('/agents/' + encodeURIComponent(profile) + '/memory', { method: 'POST', body: { file: f, content } }); toast(r.output || 'Guardado'); } catch (e) { toast(e.message, 'err'); }
    }));
    const sc = $('#ad-savecfg', body);
    if (sc) sc.addEventListener('click', async () => {
      try { const r = await api('/agents/' + encodeURIComponent(profile) + '/config', { method: 'POST', body: { yaml: $('#ad-cfg', body).value } }); toast(r.output || 'Guardado'); } catch (e) { toast(e.message, 'err'); }
    });
  }
  view.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  show('sessions');
}

// ---------- Workspace (Files + chat con cwd) ----------
async function renderWorkspace(view) {
  view.innerHTML = head('Workspace', 'Explora un proyecto y pídele cambios a Hermes con ese contexto') + `
    <div class="grid" style="grid-template-columns: 1fr 1fr; gap:16px; align-items:start">
      <div class="card"><h3>Archivos</h3><div id="ws-files"></div></div>
      <div class="card"><h3>Pídele al agente</h3>
        <p class="muted" style="font-size:12px">Escribe una instrucción; se enviará al chat con la ruta actual como contexto.</p>
        <textarea id="ws-prompt" style="width:100%;height:120px" placeholder="p.ej. Añade manejo de errores a este archivo"></textarea>
        <div style="margin-top:8px"><button class="btn primary" id="ws-send">Enviar al chat →</button></div>
        <div id="ws-cwd" class="muted mono" style="margin-top:8px"></div>
      </div>
    </div>`;
  let cwd = '';
  async function browse(p) {
    const data = await api('/files?path=' + encodeURIComponent(p));
    cwd = p; $('#ws-cwd', view).textContent = 'cwd: /' + (p || '');
    const list = $('#ws-files', view);
    list.innerHTML = `<ul class="file-list">` +
      (p ? `<li data-dir="${esc(p.split('/').slice(0, -1).join('/'))}">📁 ..</li>` : '') +
      data.entries.map((e) => `<li data-${e.dir ? 'dir' : 'file'}="${esc((p ? p + '/' : '') + e.name)}">${e.dir ? '📁' : '📄'} ${esc(e.name)}</li>`).join('') + `</ul>`;
    list.querySelectorAll('[data-dir]').forEach((li) => li.addEventListener('click', () => browse(li.dataset.dir)));
  }
  $('#ws-send', view).addEventListener('click', () => {
    const prompt = $('#ws-prompt', view).value.trim();
    if (!prompt) return;
    sessionStorage.setItem('ws-handoff', `[contexto: ${cwd || '/'}]\n${prompt}`);
    location.hash = '#chat';
  });
  browse('');
}

// ---------- Terminal ----------
async function renderTerminal(view) {
  view.innerHTML = head('Terminal', 'Ejecuta comandos en el servidor (detrás de permiso)') + `
    <div class="card" style="padding:0">
      <div class="console" id="term-out" style="max-height:calc(100vh - 280px)">Bienvenido al terminal de Hermes Control Panel.\nEscribe un comando y pulsa Enter.\n</div>
      <div class="chat-input" style="padding:12px">
        <span class="mono" style="align-self:center">$</span>
        <textarea id="term-in" style="flex:1;height:40px" placeholder="ls -la"></textarea>
        <button class="btn primary" id="term-run">Run</button>
      </div>
    </div>`;
  const out = $('#term-out', view);
  function append(t) { out.textContent += t; out.scrollTop = out.scrollHeight; }
  async function run() {
    const cmd = $('#term-in', view).value.trim();
    if (!cmd) return;
    append(`\n$ ${cmd}\n`);
    $('#term-in', view).value = '';
    try { const r = await api('/terminal/exec', { method: 'POST', body: { cmd } }); append(r.output || (r.ok ? '(sin salida)\n' : 'error\n')); }
    catch (e) { append('⚠️ ' + e.message + '\n'); }
  }
  $('#term-run', view).addEventListener('click', run);
  $('#term-in', view).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } });
}

// ---------- Monitor ----------
async function renderMonitor(view) {
  view.innerHTML = head('Monitor', 'Métricas en vivo y procesos') + `
    <div class="grid cols-3">
      <div class="card"><h3>CPU</h3><div class="stat" id="mon-cpu">…</div><div class="bar"><span id="mon-cpu-bar"></span></div></div>
      <div class="card"><h3>Memoria</h3><div class="stat" id="mon-mem">…</div><div class="bar"><span id="mon-mem-bar"></span></div></div>
      <div class="card"><h3>Carga</h3><div class="stat" id="mon-load">…</div></div>
    </div>
    <div class="card" style="margin-top:16px"><h3>Procesos</h3><div id="mon-proc"></div></div>`;
  async function refresh() {
    try {
      const m = await api('/monitor/metrics');
      $('#mon-cpu', view).textContent = m.cpuPct + '%'; $('#mon-cpu-bar', view).style.width = m.cpuPct + '%';
      $('#mon-mem', view).textContent = m.memPct + '%'; $('#mon-mem-bar', view).style.width = m.memPct + '%';
      $('#mon-load', view).textContent = m.load1;
      const p = await api('/monitor/processes');
      $('#mon-proc', view).innerHTML = `<table><thead><tr><th>PID</th><th>Proceso</th><th>CPU%</th><th>MEM (MB)</th><th>Uptime</th></tr></thead><tbody>` +
        p.processes.map((x) => `<tr><td class="mono">${x.pid}</td><td>${esc(x.name)}</td><td>${x.cpu}</td><td>${x.mem}</td><td class="muted">${fmtUptime(x.uptimeSec)}</td></tr>`).join('') + `</tbody></table>`;
    } catch {}
  }
  await refresh();
  window.__pageTimer = setInterval(refresh, 4000);
}

// ---------- Maintenance ----------
async function renderMaintenance(view) {
  const doc = await api('/maintenance/doctor').catch(() => ({ checks: [] }));
  view.innerHTML = head('Mantenimiento', 'Backup, restauración, diagnóstico y actualización') + `
    <div class="grid cols-2">
      <div class="card"><h3>System doctor</h3><div id="mt-doctor">` +
      doc.checks.map((c) => `<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span><span class="dot ${c.status === 'ok' ? 'ok' : c.status === 'warn' ? 'warn' : 'err'}"></span> ${esc(c.name)}</span><span class="muted">${esc(c.detail)}</span></div>`).join('') + `</div></div>
      <div class="card"><h3>Acciones</h3><div class="row">
        <a class="btn" href="/api/maintenance/backup" download>⬇️ Backup</a>
        <button class="btn" id="mt-update">↻ Actualizar panel</button>
      </div>
      <div style="margin-top:14px"><label>Restaurar (pega un backup JSON)</label>
        <textarea id="mt-restore" style="width:100%;height:120px;font-family:ui-monospace,monospace" placeholder='{"cron":[...],"usage":{...}}'></textarea>
        <div style="margin-top:8px"><button class="btn primary" id="mt-restore-btn">Restaurar</button></div>
      </div></div>
    </div>`;
  $('#mt-update', view).addEventListener('click', async () => {
    try { const r = await api('/maintenance/update', { method: 'POST', body: {} }); toast(r.output || 'OK'); } catch (e) { toast(e.message, 'err'); }
  });
  $('#mt-restore-btn', view).addEventListener('click', async () => {
    let payload; try { payload = JSON.parse($('#mt-restore', view).value); } catch { return toast('JSON inválido', 'err'); }
    try { const r = await api('/maintenance/restore', { method: 'POST', body: payload }); toast(r.output || 'OK'); } catch (e) { toast(e.message, 'err'); }
  });
}

// ---------- Usuarios (RBAC) ----------
async function renderUsers(view) {
  const [list, perms] = await Promise.all([api('/users'), api('/permissions')]);
  view.innerHTML = head('Usuarios', 'Control de acceso por roles y perfiles') + `
    <div class="card" style="margin-bottom:16px">
      <h3>Nuevo usuario</h3>
      <div class="grid cols-4">
        <div><label>Usuario</label><input id="u-name"></div>
        <div><label>Contraseña</label><input id="u-pass" type="password"></div>
        <div><label>Rol</label><select id="u-role"><option value="custom">custom</option><option value="viewer">viewer</option><option value="admin">admin</option></select></div>
        <div><label>Perfiles permitidos (coma o *)</label><input id="u-prof" value="*"></div>
      </div>
      <div style="margin-top:10px"><button class="btn primary" id="u-add">+ Crear usuario</button></div>
    </div>
    <div class="card"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Perfiles</th><th>Permisos</th><th></th></tr></thead><tbody>` +
    list.map((u) => `<tr><td><strong>${esc(u.username)}</strong></td><td><span class="badge">${esc(u.role)}</span></td><td class="mono">${(u.allowed_profiles || []).join(', ')}</td><td class="muted" style="font-size:11px">${u.role === 'admin' ? 'todos' : (u.permissions || []).length + ' permisos'}</td>
      <td>${u.username === 'admin' ? '' : `<button class="btn sm danger" data-del="${esc(u.id)}">✕</button>`}</td></tr>`).join('') +
    `</tbody></table></div>
    <p class="muted" style="margin-top:8px;font-size:12px">Permisos disponibles: ${perms.permissions.join(', ')}</p>`;
  $('#u-add', view).addEventListener('click', async () => {
    const body = {
      username: $('#u-name', view).value.trim(),
      password: $('#u-pass', view).value,
      role: $('#u-role', view).value,
      allowed_profiles: $('#u-prof', view).value.split(',').map((s) => s.trim()).filter(Boolean),
    };
    if (!body.username || !body.password) return toast('Usuario y contraseña obligatorios', 'err');
    try { await api('/users', { method: 'POST', body }); toast('Usuario creado'); router(); } catch (e) { toast(e.message, 'err'); }
  });
  view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    try { await api('/users/' + b.dataset.del, { method: 'DELETE' }); toast('Eliminado'); router(); } catch (e) { toast(e.message, 'err'); }
  }));
}

// ---------- Ajustes ----------
async function renderSettings(view) {
  const [status, prov] = await Promise.all([api('/status'), api('/chat/provider').catch(() => ({}))]);
  view.innerHTML = head('Ajustes', 'Estado del panel y del agente') + `
    <div class="grid cols-2">
      <div class="card"><h3>Sistema</h3>
        <div class="row" style="justify-content:space-between"><span class="muted">Modo</span><span class="badge ${status.mode === 'live' ? 'ok' : 'warn'}">${esc(status.mode)}</span></div>
        <div class="row" style="justify-content:space-between"><span class="muted">Versión Hermes</span><span>${esc(status.version)}</span></div>
        <div class="row" style="justify-content:space-between"><span class="muted">Host</span><span>${esc(status.health.hostname)}</span></div>
        <div class="row" style="justify-content:space-between"><span class="muted">Usuario</span><span>${esc(state.user.username)} (${esc(state.user.role)})</span></div>
      </div>
      <div class="card"><h3>Chat / Agente</h3>
        <div class="row" style="justify-content:space-between"><span class="muted">Proveedor</span><span class="badge">${esc(prov.label || prov.provider || '—')}</span></div>
        <div class="row" style="justify-content:space-between"><span class="muted">Modelo</span><span class="mono">${esc(prov.model || '—')}</span></div>
        <p class="muted" style="font-size:12px;margin-top:10px">Para cambiar proveedor/modelo, edita <span class="mono">.env</span> (CHAT_PROVIDER, LLM_BASE_URL, LLM_MODEL) y reinicia. Ver README.</p>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><h3>Acerca de</h3>
      <p class="muted">Hermes Control Panel — inspirado en el panel del video (HCI) y en las mejores ideas de OpenClaw, OpenCode y Claude Code. Ver <a href="#recommendations">Recomendaciones</a> y el archivo PLAN.md del repo.</p>
    </div>`;
}

// ---------- boot ----------
initAuth();
