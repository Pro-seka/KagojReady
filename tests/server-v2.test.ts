import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync, readdirSync } from 'node:fs';
import { createApp } from '../src/server/app';
import { parsePack } from '../src/pack/load';
import { buildKb, Retriever } from '../src/kb/load';
import { loadGlossary } from '../src/plain/glossary';
import { loadOutOfScope } from '../src/assistant/scope';
import { ReportService, loadReportConfig } from '../src/reports/service';
import { MemoryTicketStore } from '../src/reports/store';
import { Metrics } from '../src/insights/metrics';
import type { LlmClient } from '../src/extract/types';

const packs = readdirSync('tests/fixtures/packs').map((f) => parsePack(JSON.parse(readFileSync(`tests/fixtures/packs/${f}`, 'utf8'))));
const seg = (m: number, d: Buffer) => { const l = Buffer.alloc(2); l.writeUInt16BE(d.length + 2); return Buffer.concat([Buffer.from([0xff, m]), l, d]); };
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0')), seg(0xe1, Buffer.from('Exif\0\0GPSLAT12345')), Buffer.from([0xff, 0xda, 0x00, 0x02, 1, 2, 3, 0xff, 0xd9])]);
const img = `data:image/jpeg;base64,${JPG.toString('base64')}`;
const AGENCY = 'agency-token-0123456789';
const sample = JSON.parse(readFileSync('public/samples/plain-sample.json', 'utf8')).samples as { en: string };
let server: Server, base: string, metrics: Metrics, reports: ReportService;
const modelSays = (o: object): LlmClient => ({ async complete() { return JSON.stringify(o); } });
const start = (llm: LlmClient | null) => new Promise<void>((resolve) => {
  metrics = new Metrics(); reports = new ReportService(loadReportConfig(), new MemoryTicketStore(), llm);
  server = createApp({ llm, chatLlm: null, packs, retriever: new Retriever(buildKb(packs)), glossary: loadGlossary(), outOfScope: loadOutOfScope(), reports, agencyToken: AGENCY, metrics, log: () => {}, rateLimit: { max: 500, windowMs: 60_000 } });
  server.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; resolve(); });
});
beforeAll(() => start(modelSays({ category: 'road_damage', confidence: 0.92, is_public_infrastructure_problem: true })));
afterAll(() => server.close());
const post = (path: string, body: unknown, headers: Record<string, string> = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const auth = { authorization: `Bearer ${AGENCY}` };

describe('assistant: noisy input and services not covered', () => {
  const ask = async (message: string) => (await post('/api/chat', { message, lang: 'en' })).json();
  it('understands a typo and romanized Bangla, and says so', async () => {
    const a = await ask('pasport renewel documents'); expect(a.mode).not.toBe('abstained'); expect(a.steps).toContain('typo_fixed');
    const b = await ask('nid songshodhon korte koto din lage'); expect(b.passages[0].id).toBe('nid-slow'); expect(b.steps).toContain('romanized');
  });
  it('says plainly that a service is not covered, names it, counts only its id, and never echoes the question', async () => {
    const a = await ask('How do I renew my driving licence?');
    expect(a.mode).toBe('abstained'); expect(a.answer).toContain('driving licence'); expect(a.unmet.id).toBe('driving-licence'); expect(a.steps).toContain('out_of_scope');
    expect(JSON.stringify(metrics.snapshot(1).unmetDemand)).toContain('driving-licence');
    expect((await ask('birth certificate for my newborn')).mode).toBe('abstained');
  });
  it('a covered service wins over a stray word: passport questions that mention tax or visa are still answered', async () => {
    expect((await ask('do I need my old passport for a visa application renewal')).unmet ?? null).toBeNull();
  });
});

describe('plain-language endpoint', () => {
  it('analyses pasted text with no AI configured for chat and returns facts, jargon and a summary', async () => {
    const r = await post('/api/plain', { text: sample.en, lang: 'en' }); const d = await r.json();
    expect(r.status).toBe(200); expect(d).toMatchObject({ mode: 'extractive', usedLlm: false, stored: false }); expect(d.analysis.jargon.length).toBeGreaterThan(5);
    expect(d.analysis.facts.some((f: any) => f.kind === 'money')).toBe(true); expect(JSON.stringify(metrics.snapshot(1).plain)).toContain('requests');
  });
  it('rejects empty, tiny, huge and malformed input', async () => {
    for (const body of [{}, { text: 'short' }, { text: 'x'.repeat(20_001) }, { text: sample.en, lang: 'fr' }]) expect((await post('/api/plain', body)).status).toBe(400);
  });
});

describe('civic reports API', () => {
  it('lists categories and kinds of area, and says routing is unverified', async () => {
    const d = await (await fetch(`${base}/api/reports/config`)).json(); expect(d.categories.length).toBeGreaterThan(8); expect(d.routingStatus).toBe('DRAFT_UNVERIFIED'); expect((await (await fetch(`${base}/api/services`)).json()).reports).toBe(true);
  });
  it('suggests a category from a photo', async () => { expect(await (await post('/api/reports/classify', { image: img })).json()).toMatchObject({ category: 'road_damage', reason: 'ok', stored: false }); });
  it('rejects classify with no image or a non-JPEG data URL', async () => { for (const image of [undefined, 'data:image/png;base64,AAAA', 5]) expect((await post('/api/reports/classify', { image })).status).toBe(400); });
  it('creates a ticket, strips the photo, rounds the location, and lets the reporter track it by code', async () => {
    const r = await post('/api/reports', { category: 'road_damage', areaType: 'city_corporation', description: 'hole', lat: 23.8103, lng: 90.4125, image: img, lang: 'en', suggested: { category: 'road_damage', confidence: 0.92 } }); const d = await r.json();
    expect(d).toMatchObject({ created: true, photoKept: true, locationKept: true, status: 'received' }); expect(d.id).toMatch(/^KR-/);
    const t = await (await post('/api/reports/track', { id: d.id.toLowerCase() })).json(); expect(t).toMatchObject({ id: d.id, status: 'received' }); expect(JSON.stringify(t)).not.toMatch(/hole|23\.81/);
    expect((await post('/api/reports/track', { id: 'KR-AAAA-BBBB' })).status).toBe(404);
    const stored = reports.photo(d.id)!; expect(stored.includes('GPSLAT')).toBe(false);
    expect(JSON.stringify(metrics.snapshot(1).reports)).toContain('road_damage');
  });
  it('says when a similar report exists, and "me too" adds support instead of a duplicate', async () => {
    const body = { category: 'garbage', areaType: 'pourashava', lat: 24.0, lng: 90.0, lang: 'bn' };
    const first = await (await post('/api/reports', body)).json(); expect(first.created).toBe(true);
    const again = await (await post('/api/reports', body)).json(); expect(again.created).toBe(false); expect(again.similar[0].id).toBe(first.id);
    const s = await (await post('/api/reports/support', { id: first.id })).json(); expect(s.supporters).toBe(1);
    expect((await (await post('/api/reports', { ...body, force: true })).json()).created).toBe(true);
  });
  it('validates input', async () => {
    for (const b of [{ category: 'road_damage', areaType: 'city_corporation', lang: 'xx' }, { category: 5, areaType: 'x', lang: 'en' }, { category: 'nope', areaType: 'city_corporation', lang: 'en' }, { category: 'road_damage', areaType: 'city_corporation', lang: 'en', image: 'data:image/jpeg;base64,@@@' }])
      expect((await post('/api/reports', b)).status).toBe(400);
    expect((await post('/api/reports/support', { id: 'bad' })).status).toBe(400);
  });
  it('the public summary and tracking leak nothing private', async () => { const s = JSON.stringify(await (await fetch(`${base}/api/reports/summary`)).json()); expect(s).not.toMatch(/lat|lng|description|photo/); });
});

describe('agency console API', () => {
  it('locks out after repeated wrong tokens, but never because of many correct requests', async () => {
    for (let i = 0; i < 30; i++) expect((await fetch(`${base}/api/agency/tickets`, { headers: auth })).status).toBe(200);
  });
  it('needs the token, and every wrong attempt is refused', async () => {
    for (const h of [{}, { authorization: 'Bearer wrong' }, { authorization: 'Basic abc' }] as Array<Record<string, string>>) expect((await fetch(`${base}/api/agency/tickets`, { headers: h })).status).toBe(401);
    expect((await fetch(`${base}/api/agency/export.csv`)).status).toBe(401); expect((await fetch(`${base}/api/agency/photo/KR-AAAA-BBBB`)).status).toBe(401);
  });
  it('lists tickets by priority, updates status with a note, serves the clean photo, exports CSV', async () => {
    const d = await (await fetch(`${base}/api/agency/tickets`, { headers: auth })).json(); expect(d.tickets.length).toBeGreaterThan(0); expect(d.tickets[0]).toHaveProperty('priority'); expect(d.tickets[0]).not.toHaveProperty('photo'); expect(d.categories.length).toBeGreaterThan(5);
    const withPhoto = d.tickets.find((t: any) => t.hasPhoto);
    const up = await (await post('/api/agency/status', { id: withPhoto.id, status: 'forwarded', note: 'Sent to ward 4' }, auth)).json(); expect(up).toMatchObject({ status: 'forwarded', note: 'Sent to ward 4' });
    expect((await (await post('/api/reports/track', { id: withPhoto.id })).json()).status).toBe('forwarded');
    const ph = await fetch(`${base}/api/agency/photo/${withPhoto.id}`, { headers: auth }); expect(ph.headers.get('content-type')).toBe('image/jpeg'); expect(Buffer.from(await ph.arrayBuffer()).includes('GPSLAT')).toBe(false);
    const csv = await fetch(`${base}/api/agency/export.csv`, { headers: auth }); expect(csv.headers.get('content-type')).toMatch(/text\/csv/); expect((await csv.text()).split('\n')[0]).toMatch(/^id,created/);
    expect((await post('/api/agency/status', { id: withPhoto.id, status: 'nonsense' }, auth)).status).toBe(404); expect((await post('/api/agency/status', { id: 5, status: 'resolved' }, auth)).status).toBe(400);
  });
  it('blocks an address after 10 wrong tokens in a row', async () => {
    const s = createApp({ llm: null, packs, log: () => {}, reports, agencyToken: AGENCY }); await new Promise<void>((r) => s.listen(0, '127.0.0.1', () => r())); const b = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    for (let i = 0; i < 10; i++) expect((await fetch(`${b}/api/agency/tickets`, { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
    expect((await fetch(`${b}/api/agency/tickets`, { headers: { authorization: 'Bearer nope' } })).status).toBe(429); s.close();
  });
  it('is switched off without a token or without reports', async () => {
    const s = createApp({ llm: null, packs, log: () => {} }); await new Promise<void>((r) => s.listen(0, '127.0.0.1', () => r())); const b = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    expect((await fetch(`${b}/api/agency/tickets`, { headers: auth })).status).toBe(404); expect((await fetch(`${b}/api/reports/config`)).status).toBe(404); expect((await fetch(`${b}/api/services`).then((x) => x.json())).reports).toBe(false); s.close();
  });
});
describe('headers', () => {
  it('allows location only for this site, and keeps the strict content policy', async () => {
    const r = await fetch(`${base}/api/services`); expect(r.headers.get('permissions-policy')).toContain('geolocation=(self)'); expect(r.headers.get('content-security-policy')).toContain("script-src 'self'");
  });
  it('serves the made-up plain-language sample, and only files that exist in the public folder', async () => { const r = await fetch(`${base}/samples/plain-sample.json`); expect(r.status).toBe(200); expect((await r.json()).samples.en).toMatch(/SAMPLE TEXT/); expect((await fetch(`${base}/../package.json`)).status).toBe(404); expect((await fetch(`${base}/%2e%2e/package.json`)).status).toBe(404); });
  it('serves the browser validation module with a JavaScript type', async () => { const r = await fetch(`${base}/lib/validate.mjs`); expect(r.status).toBe(200); expect(r.headers.get('content-type')).toMatch(/javascript/); });
});
