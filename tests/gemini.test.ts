import { afterAll, describe, expect, it } from 'vitest';
import { geminiClient, listGeminiModels, retryDelayMs } from '../src/extract/gemini';
import { configureLlm } from '../src/extract/provider';
import { ExtractionError } from '../src/extract/types';
import { loadManifest, runExtractionEval } from '../eval/extract-eval';
import { startFakeGemini } from './fake-gemini';
import { JPEG } from './helpers';

const req = { system: 'sys', userText: 'user', image: { base64: JPEG.toString('base64'), mediaType: 'image/jpeg' as const }, maxTokens: 1000, expectJson: true };
const ok = (parts: any[], extra: any = {}) => new Response(JSON.stringify({ candidates: [{ content: { parts }, finishReason: 'STOP' }], ...extra }));
const err = (status: number, message: string, details: any[] = [], headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: { code: status, message, status: 'X', details } }), { status, headers });
/** A fetch that replays responses and records calls. */
function seq(...rs: Array<Response | Error>) {
  const calls: Array<{ url: string; init: any }> = []; let i = 0;
  const fetchImpl = (async (url: string, init: any) => { calls.push({ url, init }); const r = rs[Math.min(i++, rs.length - 1)]; if (r instanceof Error) throw r; return r.clone(); }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}
const clock = () => { let t = 0; const slept: number[] = []; return { slept, now: () => t, sleep: async (ms: number) => { slept.push(ms); t += ms; } }; };

describe('gemini client: request', () => {
  it('sends a documented generateContent request with the key only in a header', async () => {
    const { fetchImpl, calls } = seq(ok([{ text: '{"a":1}' }]));
    const c = geminiClient({ apiKey: 'KEY-123', model: 'gemini-x', fetchImpl });
    expect(await c.complete(req)).toBe('{"a":1}');
    const { url, init } = calls[0]; const body = JSON.parse(init.body);
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent');
    expect(url).not.toMatch(/KEY-123|key=/); expect(init.headers['x-goog-api-key']).toBe('KEY-123');
    expect(body.systemInstruction.parts[0].text).toBe('sys');
    expect(body.contents[0].parts[0]).toEqual({ inline_data: { mime_type: 'image/jpeg', data: req.image.base64 } });
    expect(body.contents[0].parts[1]).toEqual({ text: 'user' });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(4096);
  });
  it('asks for JSON only when the caller expects JSON, so chat answers stay plain text', async () => {
    const { fetchImpl, calls } = seq(ok([{ text: 'x' }]));
    await geminiClient({ apiKey: 'k', model: 'm', fetchImpl }).complete({ system: 's', userText: 'q', maxTokens: 500 });
    expect(JSON.parse(calls[0].init.body).generationConfig.responseMimeType).toBeUndefined();
  });
  it('accepts a model name with or without the "models/" prefix', async () => {
    const { fetchImpl, calls } = seq(ok([{ text: 'x' }]));
    await geminiClient({ apiKey: 'k', model: 'models/gemini-y', fetchImpl }).complete(req);
    expect(calls[0].url).toContain('/models/gemini-y:generateContent');
  });
});

describe('gemini client: responses', () => {
  it('joins text parts, ignores "thought" parts, and records tokens and the resolved model', async () => {
    const { fetchImpl } = seq(ok([{ text: 'thinking...', thought: true }, { text: '{"x":' }, { text: '1}' }],
      { usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 80, thoughtsTokenCount: 300 }, modelVersion: 'gemini-x-001' }));
    const c = geminiClient({ apiKey: 'k', model: 'm', fetchImpl });
    expect(await c.complete(req)).toBe('{"x":\n1}');
    expect(c.stats).toEqual({ calls: 1, inputTokens: 1200, outputTokens: 380, modelVersion: 'gemini-x-001' });
  });
  it('turns a blocked prompt and an empty reply into clean errors', async () => {
    const blocked: any = await geminiClient({ apiKey: 'k', model: 'm', fetchImpl: seq(new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }))).fetchImpl }).complete(req).catch((e) => e);
    expect(blocked).toBeInstanceOf(ExtractionError); expect(blocked.message).toBe('blocked'); expect(blocked.detail).toBe('SAFETY');
    const empty: any = await geminiClient({ apiKey: 'k', model: 'm', fetchImpl: seq(ok([])).fetchImpl }).complete(req).catch((e) => e);
    expect(empty.code).toBe('service_error'); expect(empty.message).toBe('empty reply');
  });
});

describe('gemini client: errors, retries, pacing', () => {
  it('does not retry a bad key or unknown model, and surfaces Google’s message for the setup tool', async () => {
    const a = seq(err(400, 'API key not valid. Please pass a valid API key.'));
    const e: any = await geminiClient({ apiKey: 'k', model: 'm', fetchImpl: a.fetchImpl }).complete(req).catch((x) => x);
    expect(e.code).toBe('service_error'); expect(e.message).toBe('status 400'); expect(e.detail).toMatch(/API key not valid/); expect(a.calls.length).toBe(1);
    const b = seq(err(404, 'models/nope is not found for API version v1beta'));
    expect(((await geminiClient({ apiKey: 'k', model: 'nope', fetchImpl: b.fetchImpl }).complete(req).catch((x) => x)) as any).detail).toMatch(/not found/);
  });
  it('waits the delay Google asks for on a 429, then succeeds', async () => {
    const { fetchImpl, calls } = seq(err(429, 'quota', [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '2s' }]), ok([{ text: 'done' }]));
    const k = clock();
    expect(await geminiClient({ apiKey: 'k', model: 'm', fetchImpl, sleep: k.sleep, now: k.now }).complete(req)).toBe('done');
    expect(calls.length).toBe(2); expect(k.slept).toEqual([2250]);
  });
  it('gives up after the attempts, reporting the quota message', async () => {
    const { fetchImpl, calls } = seq(err(429, 'Quota exceeded for GenerateContent requests per day (free tier)'));
    const k = clock();
    const e: any = await geminiClient({ apiKey: 'k', model: 'm', fetchImpl, sleep: k.sleep, now: k.now }).complete(req).catch((x) => x);
    expect(calls.length).toBe(3); expect(e.message).toBe('status 429'); expect(e.detail).toMatch(/free tier/);
  });
  it('caps an absurd retry delay', () => {
    expect(retryDelayMs({ error: { details: [{ '@type': 'x.RetryInfo', retryDelay: '9999s' }] } })).toBe(65_000);
    expect(retryDelayMs({}, '7')).toBe(7000); expect(retryDelayMs({})).toBeNull();
  });
  it('retries a network failure, then reports a clean error without the key', async () => {
    const k = clock();
    const e: any = await geminiClient({ apiKey: 'SECRET-KEY', model: 'm', fetchImpl: seq(new TypeError('fetch failed')).fetchImpl, sleep: k.sleep, now: k.now }).complete(req).catch((x) => x);
    expect(e.code).toBe('service_error'); expect(JSON.stringify([e.message, e.detail, e.stack])).not.toMatch(/SECRET-KEY|inline_data|\/9j/);
  });
  it('spaces requests so a free-tier minute limit is never exceeded', async () => {
    // Frozen clock: three callers arrive at the same instant, as with concurrent photo uploads. Each must wait for its own slot.
    const { fetchImpl } = seq(ok([{ text: 'x' }])); const slept: number[] = [];
    const c = geminiClient({ apiKey: 'k', model: 'm', fetchImpl, minIntervalMs: 12_000, sleep: async (ms) => { slept.push(ms); }, now: () => 0 });
    await Promise.all([c.complete(req), c.complete(req), c.complete(req)]);
    expect(slept.sort((a, b) => a - b)).toEqual([12_000, 24_000]);
    // 20 requests at 5 per minute must take at least 19 slots, so no one-minute window can hold more than 5 requests.
    const slept2: number[] = []; const c2 = geminiClient({ apiKey: 'k', model: 'm', fetchImpl, minIntervalMs: 12_000, sleep: async (ms) => { slept2.push(ms); }, now: () => 0 });
    await Promise.all(Array.from({ length: 20 }, () => c2.complete(req)));
    expect(Math.max(...slept2)).toBe(19 * 12_000);
  });
});

describe('listGeminiModels', () => {
  it('pages through results and keeps the permitted methods', async () => {
    const pages = [new Response(JSON.stringify({ models: [{ name: 'models/a', supportedGenerationMethods: ['generateContent'] }], nextPageToken: 'p2' })),
      new Response(JSON.stringify({ models: [{ name: 'models/b', supportedGenerationMethods: ['embedContent'] }] }))];
    const { fetchImpl, calls } = seq(...pages);
    expect(await listGeminiModels('k', { fetchImpl })).toEqual([{ name: 'a', methods: ['generateContent'] }, { name: 'b', methods: ['embedContent'] }]);
    expect(calls[1].url).toContain('pageToken=p2'); expect(calls[0].url).not.toMatch(/key=/);
  });
  it('reports an unreachable network as a network problem, not a vague failure', async () => {
    const e: any = await listGeminiModels('k', { fetchImpl: seq(new TypeError('fetch failed')).fetchImpl }).catch((x) => x);
    expect(e).toBeInstanceOf(ExtractionError); expect(e.message).toBe('network');
  });
  it('reports a rejected key', async () => {
    const e: any = await listGeminiModels('k', { fetchImpl: seq(err(400, 'API key not valid')).fetchImpl }).catch((x) => x);
    expect(e.detail).toMatch(/API key not valid/);
  });
});

const manifest = loadManifest();
const fake = startFakeGemini(); const base = fake.url;
afterAll(() => fake.close());

describe('whole stack through the Gemini client (local fake server)', () => {
  it('reads all 60 specimen images with the real HTTP path, and scores 100% with no dangerous outcomes', async () => {
    const cfg = configureLlm({ GEMINI_API_KEY: 'good-key', GEMINI_TIER: 'paid', LLM_MODEL: 'gemini-test', GEMINI_BASE_URL: await base })!;
    const r = await runExtractionEval(cfg.client, manifest, { packPath: 'tests/fixtures/packs/bd-passport-adult-renewal.json', concurrency: 3 });
    expect(r.total).toMatchObject({ sets: manifest.length, exact: manifest.length, falseReady: 0, falsePass: 0 });
    expect(cfg.client.stats).toMatchObject({ calls: 60, inputTokens: 60 * 1300, modelVersion: 'gemini-test-001' });
  }, 60_000);
  it('a wrong key and a wrong model name fail cleanly and tell the setup tool why', async () => {
    const b = await base;
    const k = configureLlm({ GEMINI_API_KEY: 'bad-key', GEMINI_TIER: 'paid', LLM_MODEL: 'gemini-test', GEMINI_BASE_URL: b })!;
    expect(((await k.client.complete(req).catch((e) => e)) as any).detail).toMatch(/API key not valid/);
    const m = configureLlm({ GEMINI_API_KEY: 'good-key', GEMINI_TIER: 'paid', LLM_MODEL: 'gemini-old', GEMINI_BASE_URL: b })!;
    expect(((await m.client.complete(req).catch((e) => e)) as any).detail).toMatch(/not found/);
    expect((await listGeminiModels('good-key', { baseUrl: b })).filter((x) => x.methods.includes('generateContent')).map((x) => x.name)).toEqual(['gemini-test', 'gemini-test-pro']);
  });
});
