import type { LlmClient, LlmRequest, LlmStats } from './types';
import { ExtractionError } from './types';

export interface AnthropicOptions { apiKey: string; model: string; timeoutMs?: number; fetchImpl?: typeof fetch }

/** Minimal Messages API client for image input. The key is only ever sent in the x-api-key header. */
export function anthropicClient(opts: AnthropicOptions): LlmClient {
  const doFetch = opts.fetchImpl ?? fetch;
  const timeout = opts.timeoutMs ?? 45_000;
  const stats: LlmStats = { calls: 0, inputTokens: 0, outputTokens: 0 };
  return {
    stats,
    async complete(req: LlmRequest): Promise<string> {
      const body = JSON.stringify({
        model: opts.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: 'user', content: [
          ...(req.image ? [{ type: 'image', source: { type: 'base64', media_type: req.image.mediaType, data: req.image.base64 } }] : []),
          { type: 'text', text: req.userText },
        ] }],
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await doFetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01' },
            body, signal: AbortSignal.timeout(timeout),
          });
          if (res.status === 429 || res.status >= 500) { if (attempt === 0) { await new Promise((r) => setTimeout(r, 1000)); continue; } }
          if (!res.ok) throw new ExtractionError('service_error', `status ${res.status}`);
          const data = (await res.json()) as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
          stats.calls++; stats.inputTokens += data.usage?.input_tokens ?? 0; stats.outputTokens += data.usage?.output_tokens ?? 0;
          const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n');
          if (!text) throw new ExtractionError('service_error', 'empty reply');
          return text;
        } catch (e) {
          if (e instanceof ExtractionError) throw e;
          if (attempt === 1) throw new ExtractionError('service_error', 'network');
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      throw new ExtractionError('service_error');
    },
  };
}
