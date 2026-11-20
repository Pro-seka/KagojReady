import type { LlmClient, LlmRequest, LlmStats } from './types';
import { ExtractionError } from './types';

export interface GeminiOptions {
  apiKey: string; model: string; baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch;
  /** Minimum gap between request starts. Keeps free-tier use under the per-minute limit. */
  minIntervalMs?: number; maxAttempts?: number; sleep?: (ms: number) => Promise<void>; now?: () => number;
}
const DEFAULT_BASE = 'https://generativelanguage.googleapis.com';
const MAX_WAIT_MS = 65_000;

const baseOf = (o: { baseUrl?: string }) => (o.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, '');
const modelPath = (m: string) => `models/${encodeURIComponent(m.replace(/^models\//, ''))}`;

/** Google's 429 bodies carry a RetryInfo delay such as "23s". */
export function retryDelayMs(body: any, header?: string | null): number | null {
  const d = (body?.error?.details ?? []).find((x: any) => String(x?.['@type'] ?? '').includes('RetryInfo'))?.retryDelay;
  const m = typeof d === 'string' ? /^(\d+(?:\.\d+)?)s$/.exec(d) : null;
  if (m) return Math.min(MAX_WAIT_MS, Math.ceil(parseFloat(m[1]) * 1000) + 250);
  const h = header ? Number(header) : NaN;
  return Number.isFinite(h) ? Math.min(MAX_WAIT_MS, h * 1000) : null;
}
const errorDetail = (body: any) => String(body?.error?.message ?? '').slice(0, 220);

/** Gemini generateContent client for image input. The key travels only in the x-goog-api-key header, never in the URL. */
export function geminiClient(o: GeminiOptions): LlmClient {
  const doFetch = o.fetchImpl ?? fetch;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = o.now ?? Date.now;
  const stats: LlmStats = { calls: 0, inputTokens: 0, outputTokens: 0 };
  let nextSlot = 0;
  const pace = async () => {
    if (!o.minIntervalMs) return;
    const t = now(), start = Math.max(t, nextSlot);
    nextSlot = start + o.minIntervalMs;
    if (start > t) await sleep(start - t);
  };
  return {
    stats,
    async complete(req: LlmRequest): Promise<string> {
      const url = `${baseOf(o)}/v1beta/${modelPath(o.model)}:generateContent`;
      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [...(req.image ? [{ inline_data: { mime_type: req.image.mediaType, data: req.image.base64 } }] : []), { text: req.userText }] }],
        // Room for any internal "thinking" tokens, which count against the output limit on some models.
        generationConfig: { maxOutputTokens: Math.max(req.maxTokens, 4096), ...(req.expectJson ? { responseMimeType: 'application/json' } : {}) },
      });
      const attempts = o.maxAttempts ?? 3;
      for (let a = 0; a < attempts; a++) {
        await pace();
        let res: Response;
        try {
          res = await doFetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': o.apiKey }, body, signal: AbortSignal.timeout(o.timeoutMs ?? 60_000) });
        } catch {
          if (a === attempts - 1) throw new ExtractionError('service_error', 'network');
          await sleep(1000 * (a + 1)); continue;
        }
        const json: any = await res.json().catch(() => null);
        if ((res.status === 429 || res.status >= 500) && a < attempts - 1) { await sleep(retryDelayMs(json, res.headers.get('retry-after')) ?? 1000 * 2 ** a); continue; }
        if (!res.ok) throw new ExtractionError('service_error', `status ${res.status}`, errorDetail(json));
        const cand = json?.candidates?.[0];
        const text = (cand?.content?.parts ?? []).filter((p: any) => typeof p?.text === 'string' && !p.thought).map((p: any) => p.text).join('\n');
        stats.calls++;
        stats.inputTokens += json?.usageMetadata?.promptTokenCount ?? 0;
        stats.outputTokens += (json?.usageMetadata?.candidatesTokenCount ?? 0) + (json?.usageMetadata?.thoughtsTokenCount ?? 0);
        if (typeof json?.modelVersion === 'string') stats.modelVersion = json.modelVersion;
        if (!text) throw new ExtractionError('service_error', json?.promptFeedback?.blockReason ? 'blocked' : 'empty reply', String(json?.promptFeedback?.blockReason ?? cand?.finishReason ?? ''));
        return text;
      }
      throw new ExtractionError('service_error');
    },
  };
}

export interface GeminiModel { name: string; methods: string[] }
/** Lists the models this key can use. Used by the setup check to find a valid model name. */
export async function listGeminiModels(apiKey: string, o: { baseUrl?: string; fetchImpl?: typeof fetch } = {}): Promise<GeminiModel[]> {
  const doFetch = o.fetchImpl ?? fetch; const out: GeminiModel[] = []; let token = '';
  for (let page = 0; page < 6; page++) {
    let res: Response;
    try { res = await doFetch(`${baseOf(o)}/v1beta/models?pageSize=200${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`, { headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(30_000) }); }
    catch { throw new ExtractionError('service_error', 'network'); }
    const json: any = await res.json().catch(() => null);
    if (!res.ok) throw new ExtractionError('service_error', `status ${res.status}`, errorDetail(json));
    for (const m of json?.models ?? []) out.push({ name: String(m.name).replace(/^models\//, ''), methods: m.supportedGenerationMethods ?? [] });
    token = json?.nextPageToken ?? ''; if (!token) break;
  }
  return out;
}
