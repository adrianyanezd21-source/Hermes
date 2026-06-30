// Orquestador de chat: decide con qué proveedor "hablarle" al agente.
//
// Prioridad (auto):
//   1. CHAT_PROVIDER explícito en .env (hermes | openai | demo)
//   2. CLI de Hermes disponible      -> hermes
//   3. LLM_BASE_URL configurado      -> openai (Ollama / OpenRouter :free)
//   4. fallback                      -> demo
import config from './config.js';
import hermes from './hermes.js';
import llm from './llm.js';
import * as demo from './demo.js';

export async function resolveProvider() {
  const p = (config.chatProvider || 'auto').toLowerCase();
  if (p === 'hermes' || p === 'openai' || p === 'demo') return p;
  if (await hermes.cliAvailable()) return 'hermes';
  if (await llm.llmAvailable()) return 'openai';
  return 'demo';
}

export async function providerInfo() {
  const provider = await resolveProvider();
  const labels = {
    hermes: 'Hermes CLI',
    openai: `LLM (${config.llmModel || 'modelo'})`,
    demo: 'Demo',
  };
  return { provider, label: labels[provider], model: config.llmModel || null, free: provider === 'openai' || provider === 'demo' };
}

// Stream unificado.
export async function stream(prompt, profile, { onChunk, onDone, onError }) {
  const provider = await resolveProvider();
  if (provider === 'openai') {
    return llm.streamChat(prompt, { onChunk, onDone, onError });
  }
  if (provider === 'hermes') {
    return hermes.chatStream(prompt, profile, onChunk, onDone, onError);
  }
  // demo
  return demo.chatStream(prompt, onChunk, onDone);
}

export default { resolveProvider, providerInfo, stream };
