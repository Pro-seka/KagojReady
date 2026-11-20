import { afterAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readdirSync, readFileSync } from 'node:fs';
import { createApp } from '../src/server/app';
import { parsePack } from '../src/pack/load';
import { buildKb, Retriever } from '../src/kb/load';
import { Metrics } from '../src/insights/metrics';
import { dataUrl, fakeLlm, JPEG, PNG } from './helpers';

const packs = readdirSync('tests/fixtures/packs').map((f) => parsePack(JSON.parse(readFileSync(`tests/fixtures/packs/${f}`, 'utf8'))));
const retriever = new Retriever(buildKb(packs));
const open: Server[] = [];
const start = (o: object = {}) => new Promise<{ url: string; metrics: Metrics }>((r) => {
  const metrics = new Metrics(); const s = createApp({ llm: null, packs, retriever, metrics, log: () => {}, ...o }); open.push(s);
  s.listen(0, '127.0.0.1', () => r({ url: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, metrics }));
});
afterAll(() => open.forEach((s) => s.close()));
const post = (url: string, path: string, body: unknown, headers: Record<string, string> = {}) => fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

describe('POST /api/chat', () => {
  it('answers from the sources with passages, status and source links, and stores nothing', async () => {
    const { url } = await start(); const r = await post(url, '/api/chat', { message: 'How long does NID correction take', lang: 'en' }); const d = await r.json();
    expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('no-store'); expect(d.stored).toBe(false);
    expect(d.mode).toBe('extractive'); expect(d.passages[0]).toMatchObject({ id: 'nid-slow', status: 'unconfirmed' }); expect(d.passages[0].source.url).toMatch(/^https:/);
  });
  it('hides personal numbers in the response as well as before the model', async () => {
    const { url } = await start(); const d = await (await post(url, '/api/chat', { message: 'NID 1234567890 date of birth is different on passport', lang: 'en' })).json();
    expect(JSON.stringify(d)).not.toContain('1234567890'); expect(d.redactions).toEqual([{ type: 'nid', count: 1 }]);
  });
  it('uses the model when one is configured, still validated', async () => {
    const llm = { async complete() { return 'Corrections can be slow [1].'; } };
    const { url } = await start({ llm }); const d = await (await post(url, '/api/chat', { message: 'How long does NID correction take', lang: 'en' })).json();
    expect(d.mode).toBe('grounded'); expect(d.usedLlm).toBe(true);
  });
  it('can answer from the sources alone even when a model is configured for documents (demo mode)', async () => {
    const llm = { async complete() { throw new Error('must not be called for chat'); } };
    const { url } = await start({ llm, chatLlm: null }); const d = await (await post(url, '/api/chat', { message: 'How long does NID correction take', lang: 'en' })).json();
    expect(d.mode).toBe('extractive'); expect(d.usedLlm).toBe(false); expect(d.steps).toContain('no_llm');
  });
  it('rejects malformed, empty and oversized messages, and a missing language', async () => {
    const { url } = await start();
    for (const b of ['not json', {}, { message: '', lang: 'en' }, { message: '   ', lang: 'en' }, { message: 'x'.repeat(601), lang: 'en' }, { message: 'hi', lang: 'fr' }, { message: 5, lang: 'en' }])
      expect((await post(url, '/api/chat', b)).status, JSON.stringify(b)).toBe(400);
    expect((await fetch(url + '/api/chat', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' })).status).toBe(400);
    expect((await post(url, '/api/chat', { message: 'y'.repeat(20_000), lang: 'en' })).status).toBe(413);
  });
  it('is off when there is no knowledge base, and rate limited per client', async () => {
    expect((await post((await start({ retriever: null })).url, '/api/chat', { message: 'hi there', lang: 'en' })).status).toBe(404);
    const { url } = await start({ rateLimit: { max: 2, windowMs: 60_000, chatMax: 3 } });
    const codes: number[] = []; for (let i = 0; i < 5; i++) codes.push((await post(url, '/api/chat', { message: 'passport fee', lang: 'en' })).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
  });
  it('advertises chat in the service list so the UI can switch it on', async () => {
    expect((await (await fetch((await start()).url + '/api/services')).json()).chat).toBe(true);
    expect((await (await fetch((await start({ retriever: null })).url + '/api/services')).json()).chat).toBe(false);
  });
});

describe('which service "check my documents" opens', () => {
  it('is the headline service by display order, not whichever pack comes first alphabetically', async () => {
    const { url } = await start({ packs: [...packs].sort((a, b) => b.display_order - a.display_order) });
    const d = await (await post(url, '/api/chat', { message: 'Please check my documents', lang: 'en' })).json();
    expect(d.mode).toBe('action'); expect(d.actions).toEqual([{ type: 'check_documents', packId: 'bd-passport-adult-renewal' }]);
  });
});

describe('POST /api/feedback', () => {
  it('accepts only fixed fields, and counts them', async () => {
    const { url, metrics } = await start();
    expect((await post(url, '/api/feedback', { kind: 'answer', helpful: true, topic: 'bd-passport-adult-renewal' })).status).toBe(200);
    expect(metrics.snapshot(1).totals.feedback).toBe(1);
  });
  it('refuses free text, extra fields and anything that could carry personal data', async () => {
    const { url, metrics } = await start();
    const bad: unknown[] = [{ kind: 'answer', helpful: true, topic: 'x', comment: 'my NID is 1234567890' }, { kind: 'answer', helpful: 'yes', topic: 'x' }, { kind: 'other', helpful: true, topic: 'x' },
      { kind: 'answer', helpful: true, topic: 'has spaces and 01712345678' }, { kind: 'answer', helpful: true, topic: 'a'.repeat(61) }, { kind: 'answer', helpful: true }, [], 'junk'];
    for (const b of bad) expect((await post(url, '/api/feedback', b)).status, JSON.stringify(b)).toBe(400);
    expect(metrics.snapshot(1).totals.feedback).toBe(0);
  });
});

describe('GET /api/insights', () => {
  it('does not exist unless a token is configured', async () => expect((await fetch((await start()).url + '/api/insights')).status).toBe(404));
  it('needs the right bearer token', async () => {
    const { url, metrics } = await start({ insightsToken: 'a-long-secret-token-123' });
    metrics.record({ type: 'chat', topic: 'general', mode: 'grounded', lang: 'bn', usedLlm: true, latencyMs: 500, redacted: false });
    expect((await fetch(url + '/api/insights')).status).toBe(401);
    expect((await fetch(url + '/api/insights', { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
    expect((await fetch(url + '/api/insights', { headers: { authorization: 'a-long-secret-token-123' } })).status).toBe(401);
    const ok = await fetch(url + '/api/insights', { headers: { authorization: 'Bearer a-long-secret-token-123' } }); expect(ok.status).toBe(200);
    const d = await ok.json(); expect(d.totals.questions).toBe(1); expect(ok.headers.get('cache-control')).toBe('no-store');
  });
  it('locks out guessing', async () => {
    const { url } = await start({ insightsToken: 'a-long-secret-token-123' }); const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await fetch(url + '/api/insights', { headers: { authorization: 'Bearer nope' } })).status);
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true); expect(codes[11]).toBe(429);
  });
});

describe('the document check feeds the metrics without storing anything', () => {
  it('records the verdict and failed rules only', async () => {
    const { url, metrics } = await start({ llm: fakeLlm() });
    await post(url, '/api/check', { packId: 'bd-passport-adult-renewal', applicantType: 'adult', images: { nid: dataUrl(JPEG), old_passport: dataUrl(PNG, 'image/png') } });
    const s = metrics.snapshot(1); expect(s.totals.checks).toBe(1); expect(JSON.stringify(s)).not.toMatch(/Abdur|1234567890|A12345678/);
  });
});
