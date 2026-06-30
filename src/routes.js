import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import config from './config.js';
import hermes from './hermes.js';
import demo from './demo.js';
import store from './store.js';
import { recommendations } from './recommendations.js';
import { requireAuth, requireCsrf } from './auth.js';

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

  return api;
}

export default apiRouter;
