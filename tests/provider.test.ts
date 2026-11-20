import { describe, expect, it } from 'vitest';
import { configureLlm, DEFAULT_MODELS } from '../src/extract/provider';

describe('provider switch', () => {
  it('returns null when no key is set', () => { expect(configureLlm({})).toBeNull(); expect(configureLlm({ GEMINI_API_KEY: '  ', ANTHROPIC_API_KEY: '' })).toBeNull(); });
  it('uses Gemini on the free tier by default, paced to 5 requests a minute', () => {
    const c = configureLlm({ GEMINI_API_KEY: 'k' })!;
    expect(c).toMatchObject({ provider: 'gemini', tier: 'free', model: DEFAULT_MODELS.gemini, minIntervalMs: 12_000 });
  });
  it('treats anything except an explicit "paid" as free, and removes the pacing on paid', () => {
    expect(configureLlm({ GEMINI_API_KEY: 'k', GEMINI_TIER: 'yes' })!.tier).toBe('free');
    expect(configureLlm({ GEMINI_API_KEY: 'k', GEMINI_TIER: 'PAID' })).toMatchObject({ tier: 'paid', minIntervalMs: 0 });
  });
  it('lets LLM_MAX_RPM override the pacing, and rejects nonsense', () => {
    expect(configureLlm({ GEMINI_API_KEY: 'k', LLM_MAX_RPM: '15' })!.minIntervalMs).toBe(4000);
    expect(configureLlm({ GEMINI_API_KEY: 'k', LLM_MAX_RPM: '0' })!.minIntervalMs).toBe(0);
    expect(() => configureLlm({ GEMINI_API_KEY: 'k', LLM_MAX_RPM: 'fast' })).toThrow(/LLM_MAX_RPM/);
  });
  it('switches back and forth with one line', () => {
    const both = { GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' };
    expect(configureLlm(both)!.provider).toBe('gemini');
    expect(configureLlm({ ...both, LLM_PROVIDER: 'anthropic' })).toMatchObject({ provider: 'anthropic', tier: 'n/a', model: DEFAULT_MODELS.anthropic });
    expect(configureLlm({ ...both, LLM_PROVIDER: 'GEMINI' })!.provider).toBe('gemini');
    expect(configureLlm({ ANTHROPIC_API_KEY: 'a' })!.provider).toBe('anthropic');
  });
  it('explains a missing key or a bad provider name in plain language', () => {
    expect(() => configureLlm({ LLM_PROVIDER: 'gemini' })).toThrow(/GEMINI_API_KEY.*aistudio/);
    expect(() => configureLlm({ LLM_PROVIDER: 'anthropic', GEMINI_API_KEY: 'g' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => configureLlm({ LLM_PROVIDER: 'openai' })).toThrow(/"gemini", "anthropic" or "local"/);
  });
  it('accepts GOOGLE_API_KEY as an alias', () => expect(configureLlm({ GOOGLE_API_KEY: 'k' })!.provider).toBe('gemini'));
  it('picks the model from LLM_MODEL, then KAGOJREADY_MODEL, then the default', () => {
    expect(configureLlm({ GEMINI_API_KEY: 'k', LLM_MODEL: 'm1', KAGOJREADY_MODEL: 'm2' })!.model).toBe('m1');
    expect(configureLlm({ GEMINI_API_KEY: 'k', KAGOJREADY_MODEL: 'm2' })!.model).toBe('m2');
    expect(configureLlm({ GEMINI_API_KEY: 'k', LLM_MODEL: '' })!.model).toBe(DEFAULT_MODELS.gemini);
  });
  it('local provider (Ollama, vLLM, sovereign gateway) needs a model, defaults to Ollama, and is marked sovereign', () => {
    expect(() => configureLlm({ LLM_PROVIDER: 'local' })).toThrow(/LLM_MODEL/);
    expect(configureLlm({ LLM_PROVIDER: 'local', LLM_MODEL: 'llama-vision' })).toMatchObject({ provider: 'local', sovereign: true, tier: 'n/a', model: 'llama-vision', minIntervalMs: 0 });
  });
});
