// Cliente de chat compatible con la API de OpenAI (streaming SSE).
//
// Funciona con cualquier endpoint OpenAI-compatible. Opción GRATIS
// recomendada para "hablarle" al agente:
//   OpenRouter modelos ":free":  base https://openrouter.ai/api/v1
import config from './config.js';

const SYSTEM_PROMPT =
  'Eres Hermes, un agente de IA autónomo, útil y conciso. Respondes en el idioma del usuario.';

// Comprueba si el proveedor LLM está configurado y accesible.
export async function llmAvailable() {
  if (!config.llmBaseUrl) return false;
  try {
    const res = await fetch(config.llmBaseUrl.replace(/\/$/, '') + '/models', {
      headers: authHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (config.llmApiKey) h['Authorization'] = 'Bearer ' + config.llmApiKey;
  return h;
}

// Stream de una respuesta de chat. Llama onChunk(texto) por fragmento.
export async function streamChat(prompt, { onChunk, onDone, onError }) {
  const url = config.llmBaseUrl.replace(/\/$/, '') + '/chat/completions';
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        model: config.llmModel,
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      }),
    });
  } catch (err) {
    return onError(new Error('No se pudo conectar con el proveedor LLM: ' + err.message));
  }
  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => '');
    return onError(new Error(`Proveedor LLM respondió ${res.status}: ${txt.slice(0, 300)}`));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) onChunk(delta);
        } catch {
          /* ignora fragmentos no-JSON */
        }
      }
    }
    onDone();
  } catch (err) {
    onError(err);
  }
}

export default { llmAvailable, streamChat };
