import type { LlmClient } from './types';
import { anthropicClient } from './anthropic';
import { geminiClient, listGeminiModels, type GeminiModel } from './gemini';
import { openaiCompatClient } from './openai-compat';

export type Provider = 'anthropic' | 'gemini' | 'local';
export type Tier = 'free' | 'paid' | 'n/a';
export interface LlmConfig { provider: Provider; /** true when nothing leaves your own infrastructure */ sovereign?: boolean; model: string; tier: Tier; minIntervalMs: number; client: LlmClient; listModels?: () => Promise<GeminiModel[]> }

export const DEFAULT_MODELS: Record<'anthropic' | 'gemini', string> = { anthropic: 'claude-sonnet-5-5', gemini: 'gemini-flash-latest' };
type Env = Record<string, string | undefined>;
const set = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

/** Free-tier default is deliberately slow (5 requests a minute) because Google no longer publishes per-model limits. Override with LLM_MAX_RPM. */
const FREE_GEMINI_RPM = 5;

/**
 * One switch picks the AI provider: LLM_PROVIDER=gemini or anthropic. With no switch, whichever key is present is used (Gemini first).
 * Returns null when no key is configured. Throws a plain-language error when the switch names a provider whose key is missing.
 */
export function configureLlm(env: Env, fetchImpl?: typeof fetch): LlmConfig | null {
  const geminiKey = set(env.GEMINI_API_KEY) ?? set(env.GOOGLE_API_KEY), anthropicKey = set(env.ANTHROPIC_API_KEY);
  const wanted = set(env.LLM_PROVIDER)?.toLowerCase();
  if (wanted && wanted !== 'gemini' && wanted !== 'anthropic' && wanted !== 'local') throw new Error(`LLM_PROVIDER must be "gemini", "anthropic" or "local", not "${wanted}"`);
  const provider = (wanted as Provider | undefined) ?? (geminiKey ? 'gemini' : anthropicKey ? 'anthropic' : undefined);
  if (!provider) return null;
  if (provider === 'local') {
    const model = set(env.LLM_MODEL);
    if (!model) throw new Error('LLM_PROVIDER=local needs LLM_MODEL, for example a vision model you pulled into Ollama. LLM_BASE_URL defaults to http://localhost:11434/v1');
    return { provider, sovereign: true, model, tier: 'n/a', minIntervalMs: 0, client: openaiCompatClient({ baseUrl: set(env.LLM_BASE_URL) ?? 'http://localhost:11434/v1', model, apiKey: set(env.LLM_API_KEY), fetchImpl }) };
  }
  const model = set(env.LLM_MODEL) ?? set(env.KAGOJREADY_MODEL) ?? DEFAULT_MODELS[provider as 'gemini' | 'anthropic'];
  if (provider === 'gemini') {
    if (!geminiKey) throw new Error('LLM_PROVIDER=gemini but GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey');
    const tier: Tier = set(env.GEMINI_TIER)?.toLowerCase() === 'paid' ? 'paid' : 'free';   // anything but an explicit "paid" is treated as free
    const rpm = env.LLM_MAX_RPM !== undefined && env.LLM_MAX_RPM !== '' ? Number(env.LLM_MAX_RPM) : tier === 'free' ? FREE_GEMINI_RPM : 0;
    if (!Number.isFinite(rpm) || rpm < 0) throw new Error('LLM_MAX_RPM must be a number (0 means no limit)');
    const minIntervalMs = rpm > 0 ? Math.ceil(60_000 / rpm) : 0;
    const baseUrl = set(env.GEMINI_BASE_URL);
    return { provider, model, tier, minIntervalMs, client: geminiClient({ apiKey: geminiKey, model, minIntervalMs, baseUrl, fetchImpl }), listModels: () => listGeminiModels(geminiKey, { baseUrl, fetchImpl }) };
  }
  if (!anthropicKey) throw new Error('LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set');
  return { provider, model, tier: 'n/a', minIntervalMs: 0, client: anthropicClient({ apiKey: anthropicKey, model, fetchImpl }) };
}
