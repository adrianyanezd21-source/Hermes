// Capa de integración con el agente Hermes (Nous Research).
//
// Si el CLI `hermes` está disponible en el PATH, el panel ejecuta comandos
// reales. Si no lo está (o HERMES_DEMO=true), se devuelven datos de demo
// realistas para que el panel sea totalmente navegable y demostrable.
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import config from './config.js';
import * as demo from './demo.js';

const execFileAsync = promisify(execFile);

let _cliAvailable = null;

export async function cliAvailable() {
  if (config.forceDemo) return false;
  if (_cliAvailable !== null) return _cliAvailable;
  try {
    await execFileAsync(config.hermesBin, ['--version'], { timeout: 4000 });
    _cliAvailable = true;
  } catch {
    _cliAvailable = false;
  }
  return _cliAvailable;
}

export async function mode() {
  return (await cliAvailable()) ? 'live' : 'demo';
}

// Ejecuta `hermes <args...>` y devuelve stdout. Lanza en error.
async function run(args, { timeout = 20000 } = {}) {
  const { stdout } = await execFileAsync(config.hermesBin, args, {
    timeout,
    maxBuffer: 1024 * 1024 * 8,
  });
  return stdout;
}

// Intenta parsear JSON; si falla, devuelve null.
function tryJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------
//  Estado / salud
// ----------------------------------------------------------------
export async function version() {
  if (!(await cliAvailable())) return demo.version();
  try {
    return (await run(['--version'])).trim();
  } catch {
    return 'desconocida';
  }
}

export function systemHealth() {
  const mem = { total: os.totalmem(), free: os.freemem() };
  const usedMem = mem.total - mem.free;
  const load = os.loadavg();
  const cpus = os.cpus().length || 1;
  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    uptimeSec: Math.round(os.uptime()),
    cpuCount: cpus,
    load1: +load[0].toFixed(2),
    cpuPct: Math.min(100, Math.round((load[0] / cpus) * 100)),
    memTotal: mem.total,
    memUsed: usedMem,
    memPct: Math.round((usedMem / mem.total) * 100),
  };
}

// ----------------------------------------------------------------
//  Agentes / perfiles + gateway
// ----------------------------------------------------------------
export async function agents() {
  if (!(await cliAvailable())) return demo.agents();
  try {
    const out = await run(['profiles', 'list', '--json']);
    return tryJson(out) || demo.agents();
  } catch {
    return demo.agents();
  }
}

export async function gatewayStatus() {
  if (!(await cliAvailable())) return demo.gatewayStatus();
  try {
    const out = await run(['gateway', 'status', '--json']);
    return tryJson(out) || demo.gatewayStatus();
  } catch {
    return demo.gatewayStatus();
  }
}

export async function gatewayControl(action, profile) {
  // action: start | stop | restart
  if (!(await cliAvailable())) return demo.gatewayControl(action, profile);
  const args = ['gateway', action];
  if (profile) args.push('--profile', profile);
  try {
    const out = await run(args, { timeout: 30000 });
    return { ok: true, output: out.trim() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ----------------------------------------------------------------
//  Skills
// ----------------------------------------------------------------
export async function skills() {
  if (!(await cliAvailable())) return demo.skills();
  try {
    const out = await run(['skills', 'list', '--json']);
    return tryJson(out) || demo.skills();
  } catch {
    return demo.skills();
  }
}

export async function skillAction(action, name) {
  // action: install | remove
  if (!(await cliAvailable())) return demo.skillAction(action, name);
  try {
    const out = await run(['skills', action, name], { timeout: 60000 });
    return { ok: true, output: out.trim() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ----------------------------------------------------------------
//  MCP
// ----------------------------------------------------------------
export async function mcpServers() {
  if (!(await cliAvailable())) return demo.mcpServers();
  try {
    const out = await run(['mcp', 'list', '--json']);
    return tryJson(out) || demo.mcpServers();
  } catch {
    return demo.mcpServers();
  }
}

export async function mcpControl(action, name) {
  if (!(await cliAvailable())) return demo.mcpControl(action, name);
  try {
    const out = await run(['mcp', action, name], { timeout: 30000 });
    return { ok: true, output: out.trim() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ----------------------------------------------------------------
//  Logs
// ----------------------------------------------------------------
export async function logs(kind = 'gateway', lines = 200) {
  if (!(await cliAvailable())) return demo.logs(kind, lines);
  try {
    const out = await run(['logs', kind, '--lines', String(lines)]);
    return out.split('\n').filter(Boolean);
  } catch {
    return demo.logs(kind, lines);
  }
}

// ----------------------------------------------------------------
//  Chat (one-shot). El streaming real lo gestiona el WebSocket usando
//  HERMES_API_URL si está configurado; en su defecto usa esta función.
// ----------------------------------------------------------------
export async function chatOnce(prompt, profile) {
  if (!(await cliAvailable())) return demo.chatReply(prompt);
  const args = ['-p', prompt];
  if (profile) args.push('--profile', profile);
  try {
    const out = await run(args, { timeout: 120000 });
    return out.trim();
  } catch (err) {
    return `⚠️ Error ejecutando Hermes: ${err.message}`;
  }
}

// Spawn en streaming para el WebSocket (línea a línea).
export function chatStream(prompt, profile, onChunk, onDone, onError) {
  cliAvailable().then((available) => {
    if (!available) {
      demo.chatStream(prompt, onChunk, onDone);
      return;
    }
    const args = ['-p', prompt];
    if (profile) args.push('--profile', profile);
    const child = spawn(config.hermesBin, args);
    child.stdout.on('data', (d) => onChunk(d.toString()));
    child.stderr.on('data', (d) => onChunk(d.toString()));
    child.on('close', () => onDone());
    child.on('error', (e) => onError(e));
  });
}

export default {
  cliAvailable,
  mode,
  version,
  systemHealth,
  agents,
  gatewayStatus,
  gatewayControl,
  skills,
  skillAction,
  mcpServers,
  mcpControl,
  logs,
  chatOnce,
  chatStream,
};
