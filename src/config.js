import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

const repoRoot = process.cwd();

export const config = {
  port: parseInt(process.env.PORT || '10274', 10),
  password: process.env.HERMES_CONTROL_PASSWORD || 'hermes',
  secret: process.env.HERMES_CONTROL_SECRET || 'hermes-dev-secret-change-me',
  hermesHome: expandHome(process.env.HERMES_CONTROL_HOME || path.join(os.homedir(), '.hermes')),
  projectsRoot: expandHome(process.env.HERMES_PROJECTS_ROOT || path.dirname(repoRoot)),
  hermesBin: process.env.HERMES_BIN || 'hermes',
  apiUrl: process.env.HERMES_API_URL || '',
  apiKey: process.env.HERMES_API_KEY || '',
  forceDemo: String(process.env.HERMES_DEMO || 'false').toLowerCase() === 'true',
  // Proveedor de chat: auto | hermes | openai | demo
  chatProvider: process.env.CHAT_PROVIDER || 'auto',
  // Endpoint OpenAI-compatible para el chat gratuito (Ollama / OpenRouter).
  llmBaseUrl: process.env.LLM_BASE_URL || '',
  llmApiKey: process.env.LLM_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'llama3.2',
  dataDir: path.join(repoRoot, 'data'),
  publicDir: path.join(repoRoot, 'public'),
};

export default config;
