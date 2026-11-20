import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/server/app';
import { loadPack } from '../src/pack/load';
import { ExtractionError } from '../src/extract/types';
import { dataUrl, fakeLlm, JPEG, PNG, reply } from './helpers';

const pack = loadPack('tests/fixtures/packs/bd-passport-adult-renewal.json');
const logs: string[] = [];
let server: Server, base: string, calls = { n: 0 };

const start = (opts: Partial<Parameters<typeof createApp>[0]> = {}) => new Promise<{ s: Server; url: string }>((resolve) => {
  const s = createApp({ llm: fakeLlm({}, calls), packs: [pack], today: () => '2026-10-20', log: (l) => logs.push(l), ...opts });
  s.listen(0, '127.0.0.1', () => resolve({ s, url: `http://127.0.0.1:${(s.address() as AddressInfo).port}` }));
});
beforeAll(async () => { ({ s: server, url: base } = await start()); });
afterAll(() => server.close());

const post = (body: unknown, url = base, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  fetch(`${url}/api/check`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
const good = { packId: pack.pack_id, applicantType: 'adult', images: { nid: dataUrl(JPEG), old_passport: dataUrl(PNG, 'image/png') } };

describe('API', () => {
  it('serves health and the service list', async () => {
    expect((await (await fetch(`${base}/healthz`)).json()).ok).toBe(true);
    const d = await (await fetch(`${base}/api/services`)).json();
    expect(d.services[0]).toMatchObject({ id: pack.pack_id, status: 'DRAFT_UNVERIFIED', stale: false });
    expect(d.services[0].documents.map((x: any) => x.id)).toEqual(['old_passport', 'nid']);
  });
  it('returns a READY report for good photos', async () => {
    const r = await post(good); const d = await r.json();
    expect(r.status).toBe(200); expect(d.verdict).toBe('READY'); expect(d.stored).toBe(false);
    expect(r.headers.get('cache-control')).toBe('no-store');
  });
  it('never returns rule evidence, and echoes back only the requested fields so the user can spot a misread', async () => {
    const d = await (await post(good)).json();
    expect(JSON.stringify(d)).not.toMatch(/evidence|romanized|confidence/);
    expect(d.read.nid.map((x: any) => x.field)).toEqual(['name', 'father_name', 'mother_name', 'dob', 'nid_number']);
    expect(d.read.nid[0]).toEqual({ field: 'name', value: 'Abdur Rahim' });
  });
  it('shows an unclear field as null instead of a guess', async () => {
    const llm = fakeLlm({ nid: reply({ name: { value: 'Abdur Rahim' }, father_name: { value: 'K' }, mother_name: { value: 'R' }, dob: { value: '12 Mar 1990', confidence: 0.4 }, nid_number: { value: '1234567890' } }) });
    const { s, url } = await start({ llm }); const d = await (await post(good, url)).json(); s.close();
    expect(d.read.nid.find((x: any) => x.field === 'dob').value).toBeNull();
  });
  it('flags a mismatch end to end', async () => {
    const llm = fakeLlm({ nid: reply({ name: { value: 'Abdur Rahim' }, father_name: { value: 'K' }, mother_name: { value: 'R' }, dob: { value: '12 Mar 1991' }, nid_number: { value: '1234567890' } }) });
    const { s, url } = await start({ llm });
    const d = await (await post(good, url)).json(); s.close();
    expect(d.verdict).toBe('NOT_READY'); expect(d.results[0]).toMatchObject({ ruleId: 'RN-010', outcome: 'FAIL', fixService: 'bd-nid-correction' });
  });
  it('reports per-document issues', async () => {
    const llm = { complete: async () => { throw new ExtractionError('service_error'); } };
    const { s, url } = await start({ llm });
    const d = await (await post(good, url)).json(); s.close();
    expect(d.verdict).not.toBe('READY'); expect(d.issues.nid).toBe('service_error');
  });
  it('rejects malformed requests without calling the model', async () => {
    const before = calls.n;
    const bads: unknown[] = ['not json', { ...good, packId: 'ghost' }, { ...good, applicantType: 'alien' }, { ...good, images: { ghost: 'x' } },
      { ...good, images: { nid: 123 } }, { ...good, images: [] }, { packId: pack.pack_id }];
    for (const b of bads) expect((await post(b)).status).toBe(400);
    expect((await post(good, base, { 'content-type': 'text/plain' })).status).toBe(400);
    expect(calls.n).toBe(before);
  });
  it('treats a non-image upload as an issue, not a crash', async () => {
    const d = await (await post({ ...good, images: { nid: dataUrl(Buffer.from('not an image')) } })).json();
    expect(d.issues.nid).toBe('bad_image');
  });
  it('rejects oversized bodies', async () => {
    const huge = { ...good, images: { nid: 'A'.repeat(15 * 1024 * 1024) } };
    expect((await post(huge)).status).toBe(413);
  });
  it('returns 503 when no model is configured, and 404 for unknown paths', async () => {
    const { s, url } = await start({ llm: null });
    expect((await post(good, url)).status).toBe(503); expect((await fetch(`${url}/nope`)).status).toBe(404); s.close();
  });
  it('rate limits per client', async () => {
    const { s, url } = await start({ rateLimit: { max: 3, windowMs: 60_000 } });
    const codes: number[] = []; for (let i = 0; i < 5; i++) codes.push((await post(good, url)).status); s.close();
    expect(codes).toEqual([200, 200, 200, 429, 429]);
  });
});

describe('security and privacy', () => {
  it('sends strict security headers', async () => {
    const r = await fetch(`${base}/`);
    expect(r.headers.get('content-security-policy')).toMatch(/default-src 'none'.*script-src 'self'/);
    expect(r.headers.get('content-security-policy')).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it('blocks path traversal and non-whitelisted files', async () => {
    for (const p of ['/../package.json', '/..%2fpackage.json', '/%2e%2e/package.json', '/app.js.map', '/fonts/../../package.json'])
      expect((await fetch(`${base}${p}`)).status).toBe(404);
  });
  it('serves the app shell and assets', async () => {
    for (const p of ['/', '/app.js', '/app.css', '/fonts/hind-siliguri-bengali-400-normal.woff2']) expect((await fetch(`${base}${p}`)).status).toBe(200);
  });
  it('logs only method, path, status and duration: no bodies, no personal data, no addresses', async () => {
    await post(good);
    const all = logs.join('\n');
    expect(all).toMatch(/POST \/api\/check 200 \d+ms/);
    expect(all).not.toMatch(/Abdur|1234567890|base64|\/9j|127\.0\.0\.1|image/);
  });
});

import http from 'node:http';
const raw = (path: string) => new Promise<number>((resolve, reject) => {
  const u = new URL(base);
  http.get({ host: u.hostname, port: u.port, path }, (r) => { r.resume(); resolve(r.statusCode ?? 0); }).on('error', reject);
});
describe('raw path handling (no client-side URL cleanup)', () => {
  it('never serves anything outside public/ or non-whitelisted types', async () => {
    for (const p of ['/../package.json', '/../../etc/passwd', '/..%2fpackage.json', '/%2e%2e/package.json', '/fonts/../../package.json',
      '//etc/passwd', '/app.js%00.html', '/../src/server/app.ts', '/fonts/LICENSE-HindSiliguri.txt'])
      expect(await raw(p), p).toBe(404);
    expect(await raw('/app.js')).toBe(200);
  });
});

describe('service ordering', () => {
  it('lists services by display_order, not by file name', async () => {
    const a = { ...pack, pack_id: 'a-second', display_order: 2 }, b = { ...pack, pack_id: 'z-first', display_order: 1 };
    const { s, url } = await start({ packs: [a, b] });
    const d = await (await fetch(`${url}/api/services`)).json(); s.close();
    expect(d.services.map((x: any) => x.id)).toEqual(['z-first', 'a-second']);
  });
});

describe('verified packs', () => {
  it('are reported as VERIFIED with their verification date, so the UI shows no draft banner', async () => {
    const { promotePack } = await import('../src/pack/promote');
    const p = structuredClone(pack); p.rules = p.rules.map((r) => ({ ...r, rule_status: r.rule_status === 'unconfirmed' ? 'operator_reported' as const : r.rule_status }));
    const v = promotePack(p, { by: 'A. Verifier', evidenceUrl: 'https://example.org/p', today: '2026-10-20' });
    const { s, url } = await start({ packs: [v] });
    const d = await (await fetch(`${url}/api/services`)).json(); const c = await (await post(good, url)).json(); s.close();
    expect(d.services[0]).toMatchObject({ status: 'VERIFIED', lastVerified: '2026-10-20', stale: false });
    expect(c.packStatus).toBe('VERIFIED'); expect(c.lastVerified).toBe('2026-10-20');
  });
});

describe('AI provider info', () => {
  it('reports provider and tier (never a key) so the UI can warn on a free tier', async () => {
    const { s, url } = await start({ llmInfo: { provider: 'gemini', tier: 'free' } });
    const d = await (await fetch(`${url}/api/services`)).json(); s.close();
    expect(d.llm).toEqual({ provider: 'gemini', tier: 'free' });
    const { s: s2, url: u2 } = await start({}); expect((await (await fetch(`${u2}/api/services`)).json()).llm).toBeNull(); s2.close();
  });
});
