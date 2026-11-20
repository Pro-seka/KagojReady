import type { LlmClient, LlmRequest, LlmStats } from './types';
import { ExtractionError } from './types';

export interface OpenAiCompatOptions { baseUrl: string; model: string; apiKey?: string; timeoutMs?: number; fetchImpl?: typeof fetch }

/**
 * Client for any OpenAI-compatible chat endpoint: Ollama, vLLM, LM Studio, or a government sovereign-cloud gateway.
 * With a local server nothing leaves your own infrastructure. Image input needs a vision-capable model.
 */
export function openaiCompatClient(o: OpenAiCompatOptions): LlmClient {
  const doFetch = o.fetchImpl ?? fetch;
  const base = o.baseUrl.replace(/\/+$/, '');
  const stats: LlmStats = { calls: 0, inputTokens: 0, outputTokens: 0 };
  return {
    stats,
    async complete(req: LlmRequest): Promise<string> {
      const user = req.image
        ? [{ type: 'image_url', image_url: { url: `data:${req.image.mediaType};base64,${req.image.base64}` } }, { type: 'text', text: req.userText }]
        : req.userText;
      const body = JSON.stringify({ model: o.model, max_tokens: Math.max(req.maxTokens, 2048), stream: false, messages: [{ role: 'system', content: req.system }, { role: 'user', content: user }] });
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (o.apiKey) headers.authorization = `Bearer ${o.apiKey}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        let res: Response;
        try { res = await doFetch(`${base}/chat/completions`, { method: 'POST', headers, body, signal: AbortSignal.timeout(o.timeoutMs ?? 120_000) }); }
        catch { if (attempt === 1) throw new ExtractionError('service_error', 'network'); await new Promise((r) => setTimeout(r, 1000)); continue; }
        const json: any = await res.json().catch(() => null);
        if ((res.status === 429 || res.status >= 500) && attempt === 0) { await new Promise((r) => setTimeout(r, 1000)); continue; }
        if (!res.ok) throw new ExtractionError('service_error', `status ${res.status}`, String(json?.error?.message ?? json?.error ?? '').slice(0, 220));
        const text = json?.choices?.[0]?.message?.content;
        stats.calls++; stats.inputTokens += json?.usage?.prompt_tokens ?? 0; stats.outputTokens += json?.usage?.completion_tokens ?? 0;
        if (typeof text !== 'string' || !text) throw new ExtractionError('service_error', 'empty reply');
        return text;
      }
      throw new ExtractionError('service_error');
    },
  };
}
