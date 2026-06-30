// Datos de demostración realistas para cuando el CLI de Hermes no está
// disponible. Permiten navegar y demostrar el panel completo sin Hermes.

export function version() {
  return 'hermes 0.17.0 (modo demo)';
}

export function agents() {
  return [
    {
      name: 'jorah',
      model: 'anthropic/claude-opus-4',
      personality: 'Analista de investigación',
      gateways: ['discord', 'telegram'],
      sessions: 14,
      status: 'online',
    },
    {
      name: 'varys',
      model: 'openrouter/deepseek-chat',
      personality: 'Gestor de redes sociales',
      gateways: ['slack'],
      sessions: 6,
      status: 'online',
    },
    {
      name: 'samwell',
      model: 'nous/hermes-4-405b',
      personality: 'Documentalista',
      gateways: [],
      sessions: 2,
      status: 'idle',
    },
  ];
}

export function gatewayStatus() {
  return {
    running: true,
    pid: 48213,
    uptimeSec: 73820,
    platforms: [
      { name: 'discord', connected: true, latencyMs: 84 },
      { name: 'telegram', connected: true, latencyMs: 132 },
      { name: 'slack', connected: true, latencyMs: 96 },
      { name: 'whatsapp', connected: false, latencyMs: null },
    ],
  };
}

export function gatewayControl(action, profile) {
  return {
    ok: true,
    output: `[demo] gateway ${action}${profile ? ` --profile ${profile}` : ''} — OK`,
  };
}

export function skills() {
  return [
    { name: 'youtube-content', installed: true, source: 'agentskills.io', desc: 'Resumen y transcripción de vídeos de YouTube' },
    { name: 'web-research', installed: true, source: 'builtin', desc: 'Investigación web multi-fuente con citas' },
    { name: 'pdf-extract', installed: true, source: 'agentskills.io', desc: 'Extracción de texto y tablas de PDFs' },
    { name: 'image-gen', installed: true, source: 'builtin', desc: 'Generación de imágenes con FAL.ai' },
    { name: 'spreadsheet-ops', installed: false, source: 'agentskills.io', desc: 'Operaciones sobre hojas de cálculo' },
    { name: 'code-review', installed: false, source: 'agentskills.io', desc: 'Revisión de código y sugerencias' },
  ];
}

export function skillAction(action, name) {
  return { ok: true, output: `[demo] skill ${action} ${name} — OK` };
}

export function mcpServers() {
  return [
    { name: 'github', transport: 'stdio', running: true, tools: 26, pid: 51002 },
    { name: 'filesystem', transport: 'stdio', running: true, tools: 11, pid: 51010 },
    { name: 'postgres', transport: 'http', running: false, tools: 0, pid: null },
    { name: 'composio', transport: 'http', running: true, tools: 140, pid: 51044 },
  ];
}

export function mcpControl(action, name) {
  return { ok: true, output: `[demo] mcp ${action} ${name} — OK` };
}

const LEVELS = ['INFO', 'INFO', 'INFO', 'DEBUG', 'WARN', 'INFO', 'ERROR'];
const MSGS = [
  'gateway conectado a discord (guild=Nous)',
  'sesión iniciada profile=jorah user=adrian',
  'tool_call web_search query="hermes agent"',
  'memory.append MEMORY.md (+1 entrada)',
  'cron job "resumen-diario" ejecutado correctamente',
  'tool_call execute_code (python) 1.2s',
  'rate limit alcanzado, rotando credencial (pool=anthropic)',
  'fallback provider activado: openrouter',
  'subagente delegado: task=research id=a91f',
  'prompt cache HIT (ahorro 4.1k tokens)',
];

export function logs(kind = 'gateway', lines = 200) {
  const out = [];
  const now = Date.now();
  for (let i = 0; i < Math.min(lines, 120); i++) {
    const t = new Date(now - i * 45000).toISOString();
    const lvl = LEVELS[Math.floor(Math.random() * LEVELS.length)];
    const msg = MSGS[Math.floor(Math.random() * MSGS.length)];
    out.push(`${t} [${lvl}] [${kind}] ${msg}`);
  }
  return out;
}

export function usage() {
  const days = [];
  const today = new Date();
  let cumulative = 0;
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const inTok = 80000 + Math.round(Math.random() * 120000);
    const outTok = 20000 + Math.round(Math.random() * 50000);
    const cost = +((inTok / 1e6) * 3 + (outTok / 1e6) * 15).toFixed(2);
    cumulative += cost;
    days.push({
      date: d.toISOString().slice(0, 10),
      inputTokens: inTok,
      outputTokens: outTok,
      cost,
    });
  }
  return {
    days,
    totalCost: +cumulative.toFixed(2),
    monthlyBudget: 100,
    byModel: [
      { model: 'claude-opus-4', cost: +(cumulative * 0.55).toFixed(2) },
      { model: 'deepseek-chat', cost: +(cumulative * 0.18).toFixed(2) },
      { model: 'hermes-4-405b', cost: +(cumulative * 0.27).toFixed(2) },
    ],
  };
}

export function defaultCron() {
  return [
    { id: 'c1', name: 'resumen-diario', schedule: '0 8 * * *', natural: 'cada día a las 8:00', skill: 'web-research', target: 'telegram', enabled: true, lastRun: '2026-06-30T08:00:00Z' },
    { id: 'c2', name: 'backup-memoria', schedule: '0 */6 * * *', natural: 'cada 6 horas', skill: '', target: 'local', enabled: true, lastRun: '2026-06-30T06:00:00Z' },
    { id: 'c3', name: 'informe-redes', schedule: '0 18 * * 5', natural: 'viernes a las 18:00', skill: 'youtube-content', target: 'slack', enabled: false, lastRun: null },
  ];
}

const REPLIES = [
  'Entendido. He revisado el contexto del proyecto y propongo dividir la tarea en tres pasos.',
  'Hecho. He guardado esa preferencia en MEMORY.md para futuras sesiones.',
  'He buscado en la web y encontré varias fuentes relevantes. ¿Quieres que prepare un resumen con citas?',
  'Puedo delegar esto a un subagente para ejecutarlo en paralelo mientras seguimos aquí.',
  'Programé la tarea con cron. Se ejecutará según lo indicado y te avisaré por el gateway.',
];

export function chatReply(prompt) {
  const base = REPLIES[Math.floor(Math.random() * REPLIES.length)];
  return `${base}\n\n(respuesta de demostración — conecta el CLI de Hermes o HERMES_API_URL para respuestas reales)\n\nTu mensaje: "${prompt}"`;
}

export function chatStream(prompt, onChunk, onDone) {
  const text = chatReply(prompt);
  const tokens = text.split(/(\s+)/);
  let i = 0;
  const timer = setInterval(() => {
    if (i >= tokens.length) {
      clearInterval(timer);
      onDone();
      return;
    }
    onChunk(tokens[i]);
    i++;
  }, 25);
}

export default {
  version,
  agents,
  gatewayStatus,
  gatewayControl,
  skills,
  skillAction,
  mcpServers,
  mcpControl,
  logs,
  usage,
  defaultCron,
  chatReply,
  chatStream,
};
