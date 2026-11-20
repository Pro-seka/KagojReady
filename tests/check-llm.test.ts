import { afterAll, describe, expect, it } from 'vitest';
import { configureLlm } from '../src/extract/provider';
import { hintFor, runLlmCheck } from '../src/ops/check-llm';
import { startFakeGemini } from './fake-gemini';

const ok = startFakeGemini(), quota = startFakeGemini({ quota: true }), region = startFakeGemini({ region: true });
afterAll(() => { ok.close(); quota.close(); region.close(); });
const run = async (srv: { url: Promise<string> }, env: Record<string, string> = {}) => {
  const lines: string[] = [];
  const cfg = configureLlm({ GEMINI_API_KEY: 'good-key', GEMINI_TIER: 'paid', LLM_MODEL: 'gemini-test', GEMINI_BASE_URL: await srv.url, ...env })!;
  return { ok: await runLlmCheck(cfg, (l) => lines.push(l)), text: lines.join('\n') };
};

describe('first-run setup check', () => {
  it('passes with a good key and model, reading every sample field correctly', async () => {
    const r = await run(ok);
    expect(r.ok).toBe(true); expect(r.text).toMatch(/Key accepted/); expect(r.text).toMatch(/9 of 9 fields read correctly, 0 wrong/); expect(r.text).toMatch(/Setup looks good/);
    expect(r.text).not.toMatch(/good-key/);
  });
  it('says what to do about a rejected key', async () => {
    const r = await run(ok, { GEMINI_API_KEY: 'typo-key' });
    expect(r.ok).toBe(false); expect(r.text).toMatch(/key was rejected.*aistudio\.google\.com\/apikey/s); expect(r.text).not.toMatch(/typo-key/);
  });
  it('lists usable model names when the configured one does not exist', async () => {
    const r = await run(ok, { LLM_MODEL: 'gemini-retired' });
    expect(r.ok).toBe(false); expect(r.text).toMatch(/"gemini-retired" is not available/); expect(r.text).toMatch(/gemini-test\b/); expect(r.text).toMatch(/gemini-test-pro/);
    expect(r.text).not.toMatch(/embed-1/); expect(r.text).toMatch(/Set LLM_MODEL=/);
  });
  it('explains a regional block and a quota limit', async () => {
    expect((await run(region)).text).toMatch(/not available in your country or region/);
    const q = await run(quota); expect(q.ok).toBe(false); expect(q.text).toMatch(/rate or daily limit.*midnight Pacific/s);
  });
  it('warns on the free tier that only specimen photos are used', async () => {
    expect((await run(ok, { GEMINI_TIER: 'free', LLM_MAX_RPM: '0' })).text).toMatch(/Free tier:.*SPECIMEN/);
  });
});
describe('unreachable network', () => {
  it('tells the user to check their connection, VPN or firewall', async () => {
    const lines: string[] = [];
    const cfg = configureLlm({ GEMINI_API_KEY: 'k', GEMINI_TIER: 'paid', GEMINI_BASE_URL: 'http://127.0.0.1:1' })!;
    expect(await runLlmCheck(cfg, (l) => lines.push(l))).toBe(false);
    expect(lines.join('\n')).toMatch(/internet connection, VPN, proxy or firewall/);
  });
});
describe('hintFor', () => {
  it('gives a next step for every known failure', () => {
    for (const [input, expected] of [['status 400: API key not valid', /rejected/], ['status 403', /denied/], ['status 404: models/x is not found', /model name/], ['status 429: quota', /limit/],
      ['blocked: SAFETY', /safety/], ['network', /internet/], ['mystery', /error/]] as const) expect(hintFor(input)).toMatch(expected);
  });
});
