import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import config from './config.js';
import hermes from './hermes.js';
import demo from './demo.js';
import store from './store.js';
import { recommendations } from './recommendations.js';
import chat from './chat.js';
import users from './users.js';
import { requireAuth, requireCsrf, requirePerm } from './auth.js';

export function apiRouter() {
  const api = express.Router();

  // Todas las rutas API requieren sesión + CSRF en mutaciones.
  api.use(requireAuth);
  api.use(requireCsrf);

  // -------- Estado / Home --------
  api.get('/status', async (req, res) => {
    res.json({
      mode: await hermes.mode(),
      version: await hermes.version(),
      health: hermes.systemHealth(),
      gateway: await hermes.gatewayStatus(),
    });
  });

  api.get('/health', (req, res) => res.json(hermes.systemHealth()));

  // -------- Agentes / Gateway --------
  api.get('/agents', async (req, res) => res.json(await hermes.agents()));
  api.get('/gateway', async (req, res) => res.json(await hermes.gatewayStatus()));
  api.post('/gateway/:action', async (req, res) => {
    const { action } = req.params;
    if (!['start', 'stop', 'restart'].includes(action)) {
      return res.status(400).json({ error: 'acción inválida' });
    }
    res.json(await hermes.gatewayControl(action, req.body?.profile));
  });

  // -------- Skills --------
  api.get('/skills', async (req, res) => res.json(await hermes.skills()));
  api.post('/skills/:action', async (req, res) => {
    const { action } = req.params;
    if (!['install', 'remove'].includes(action)) {
      return res.status(400).json({ error: 'acción inválida' });
    }
    const name = req.body?.name;
    if (!name) return res.status(400).json({ error: 'falta name' });
    res.json(await hermes.skillAction(action, name));
  });

  // -------- MCP --------
  api.get('/mcp', async (req, res) => res.json(await hermes.mcpServers()));
  api.post('/mcp/:action', async (req, res) => {
    const { action } = req.params;
    if (!['start', 'stop', 'restart'].includes(action)) {
      return res.status(400).json({ error: 'acción inválida' });
    }
    const name = req.body?.name;
    if (!name) return res.status(400).json({ error: 'falta name' });
    res.json(await hermes.mcpControl(action, name));
  });

  // -------- Logs --------
  api.get('/logs', async (req, res) => {
    const kind = (req.query.kind || 'gateway').toString();
    const lines = parseInt((req.query.lines || '200').toString(), 10);
    res.json({ lines: await hermes.logs(kind, lines) });
  });

  // -------- Uso de tokens --------
  api.get('/usage', (req, res) => {
    // Persistimos/leemos del store; si está vacío, sembramos con demo.
    let data = store.read('usage', null);
    if (!data) {
      data = demo.usage();
      store.write('usage', data);
    }
    res.json(data);
  });

  // -------- Cron --------
  function loadCron() {
    let jobs = store.read('cron', null);
    if (!jobs) {
      jobs = demo.defaultCron();
      store.write('cron', jobs);
    }
    return jobs;
  }

  api.get('/cron', (req, res) => res.json(loadCron()));

  api.post('/cron', (req, res) => {
    const { name, schedule, natural, skill, target } = req.body || {};
    if (!name || (!schedule && !natural)) {
      return res.status(400).json({ error: 'faltan campos (name y schedule o natural)' });
    }
    const job = {
      id: 'c' + crypto.randomBytes(4).toString('hex'),
      name,
      schedule: schedule || '',
      natural: natural || '',
      skill: skill || '',
      target: target || 'local',
      enabled: true,
      lastRun: null,
    };
    const jobs = loadCron();
    jobs.push(job);
    store.write('cron', jobs);
    res.json(job);
  });

  api.post('/cron/:id/toggle', (req, res) => {
    const jobs = loadCron();
    const job = jobs.find((j) => j.id === req.params.id);
    if (!job) return res.status(404).json({ error: 'no encontrado' });
    job.enabled = !job.enabled;
    store.write('cron', jobs);
    res.json(job);
  });

  api.delete('/cron/:id', (req, res) => {
    let jobs = loadCron();
    const before = jobs.length;
    jobs = jobs.filter((j) => j.id !== req.params.id);
    if (jobs.length === before) return res.status(404).json({ error: 'no encontrado' });
    store.write('cron', jobs);
    res.json({ ok: true });
  });

  // -------- Archivos (explorador con protección path traversal) --------
  function safeResolve(rel) {
    const root = path.resolve(config.projectsRoot);
    const target = path.resolve(root, '.' + path.sep + (rel || ''));
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error('ruta fuera del directorio permitido');
    }
    return target;
  }

  api.get('/files', (req, res) => {
    try {
      const rel = (req.query.path || '').toString();
      const abs = safeResolve(rel);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(abs, { withFileTypes: true })
          .filter((e) => !e.name.startsWith('.git') && e.name !== 'node_modules')
          .map((e) => ({ name: e.name, dir: e.isDirectory() }))
          .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
        return res.json({ type: 'dir', path: rel, entries, root: config.projectsRoot });
      }
      if (stat.size > 512 * 1024) {
        return res.json({ type: 'file', path: rel, content: '(archivo demasiado grande para previsualizar)', readOnly: true });
      }
      const content = fs.readFileSync(abs, 'utf8');
      return res.json({ type: 'file', path: rel, content });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  api.post('/files', (req, res) => {
    try {
      const { path: rel, content } = req.body || {};
      const abs = safeResolve(rel);
      fs.writeFileSync(abs, content ?? '');
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // -------- Recomendaciones --------
  api.get('/recommendations', (req, res) => res.json(recommendations));

  // -------- Office / ZOO Swarm Monitor --------
  api.get('/office/agent-states', (req, res) => res.json({ ok: true, agents: demo.officeAgents() }));
  api.get('/office/kanban', (req, res) => res.json(demo.officeKanban((req.query.board || 'main').toString())));
  api.get('/office/kanban/:id', (req, res) => res.json(demo.taskDetail(req.params.id)));
  api.post('/office/kanban/:id/action', requirePerm('manage_office'), (req, res) => {
    const action = (req.body?.action || '').toString();
    res.json({ ok: true, output: `[demo] tarea ${req.params.id} -> ${action}` });
  });
  api.get('/office/events', (req, res) => res.json(demo.officeEvents()));

  // -------- Detalle de agente --------
  api.get('/agents/:profile/sessions', (req, res) => res.json(demo.agentSessions(req.params.profile)));
  api.get('/agents/:profile/memory', (req, res) => res.json({ files: demo.agentMemory(req.params.profile) }));
  api.post('/agents/:profile/memory', requirePerm('manage_agents'), (req, res) => {
    res.json({ ok: true, output: `[demo] memoria de ${req.params.profile} (${req.body?.file}) guardada` });
  });
  api.get('/agents/:profile/config', (req, res) => res.json({ yaml: demo.agentConfig(req.params.profile) }));
  api.post('/agents/:profile/config', requirePerm('manage_agents'), (req, res) => {
    res.json({ ok: true, output: `[demo] config de ${req.params.profile} guardada` });
  });

  // -------- Monitor --------
  api.get('/monitor/processes', (req, res) => res.json({ processes: demo.processes() }));
  api.get('/monitor/metrics', (req, res) => res.json(hermes.systemHealth()));

  // -------- Maintenance --------
  api.get('/maintenance/doctor', (req, res) => res.json(demo.doctor()));
  api.get('/maintenance/backup', requirePerm('manage_maintenance'), (req, res) => {
    const dump = {
      generatedAt: new Date().toISOString(),
      cron: store.read('cron', []),
      usage: store.read('usage', {}),
      users: store.read('users', []).map(({ passwordHash, ...u }) => u),
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="hermes-panel-backup.json"');
    res.send(JSON.stringify(dump, null, 2));
  });
  api.post('/maintenance/restore', requirePerm('manage_maintenance'), (req, res) => {
    const { cron, usage } = req.body || {};
    if (Array.isArray(cron)) store.write('cron', cron);
    if (usage && typeof usage === 'object') store.write('usage', usage);
    res.json({ ok: true, output: 'restauración aplicada (cron/usage)' });
  });
  api.post('/maintenance/update', requirePerm('manage_maintenance'), (req, res) => {
    res.json({ ok: true, output: '[demo] git pull + npm install + restart simulado' });
  });

  // -------- Chat: proveedor activo --------
  api.get('/chat/provider', async (req, res) => res.json(await chat.providerInfo()));

  // -------- Terminal (ejecución de comandos, behind use_terminal) --------
  api.post('/terminal/exec', requirePerm('use_terminal'), (req, res) => {
    const cmd = (req.body?.cmd || '').toString().trim();
    if (!cmd) return res.status(400).json({ error: 'comando vacío' });
    exec(cmd, { cwd: config.projectsRoot, timeout: 20000, maxBuffer: 1024 * 1024 * 4, shell: '/bin/bash' },
      (err, stdout, stderr) => {
        res.json({
          ok: !err,
          code: err?.code ?? 0,
          output: (stdout || '') + (stderr || '') + (err && !stdout && !stderr ? err.message : ''),
        });
      });
  });

  // -------- Usuarios / RBAC (solo admin / manage_users) --------
  api.get('/permissions', (req, res) => res.json({ permissions: users.PERMISSIONS }));
  api.get('/users', requirePerm('manage_users'), (req, res) => res.json(users.listUsers()));
  api.post('/users', requirePerm('manage_users'), (req, res) => {
    try { res.json(users.createUser(req.body || {})); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  api.put('/users/:id', requirePerm('manage_users'), (req, res) => {
    try { res.json(users.updateUser(req.params.id, req.body || {})); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  api.delete('/users/:id', requirePerm('manage_users'), (req, res) => {
    try { res.json(users.deleteUser(req.params.id)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });

  return api;
}

export default apiRouter;
