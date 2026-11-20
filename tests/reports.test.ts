import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { haversineM, inBangladesh, roundCoord } from '../src/reports/geo';
import { hasMetadata, isJpeg, stripJpegMetadata } from '../src/reports/jpeg';
import { csvCell } from '../src/reports/csv';
import { priorityScore } from '../src/reports/priority';
import { CODE_RE, MAX_PHOTO_BYTES, ReportService, loadReportConfig, newCode, CLASSIFY_SYSTEM } from '../src/reports/service';
import { FileTicketStore, MemoryTicketStore } from '../src/reports/store';
import type { LlmClient } from '../src/extract/types';

const cfg = loadReportConfig();
/** A tiny but well-formed JPEG: SOI, JFIF, an EXIF block carrying a GPS-looking payload, a comment, then scan data and EOI. */
function jpegWith(...extra: Array<{ marker: number; data: string }>): Buffer {
  const seg = (m: number, d: Buffer) => { const l = Buffer.alloc(2); l.writeUInt16BE(d.length + 2); return Buffer.concat([Buffer.from([0xff, m]), l, d]); };
  return Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0')), ...extra.map((e) => seg(e.marker, Buffer.from(e.data))), seg(0xdb, Buffer.alloc(65, 1)), Buffer.from([0xff, 0xda, 0x00, 0x02, 1, 2, 3, 4, 5, 0xff, 0xd9])]);
}
const WITH_EXIF = jpegWith({ marker: 0xe1, data: 'Exif\0\0GPSLatitude=23.81 GPSLongitude=90.41' }, { marker: 0xfe, data: 'taken by Rahim at home' });
const clock = (start = Date.parse('2026-11-19T10:00:00Z')) => { let t = start; return { now: () => t, advanceDays: (d: number) => { t += d * 86_400_000; } }; };
const llm = (reply: string | Error): LlmClient => ({ async complete() { if (reply instanceof Error) throw reply; return reply; } });
const mk = (l: LlmClient | null = null, c = clock(), store = new MemoryTicketStore()) => ({ svc: new ReportService(cfg, store, l, c.now), c, store });
const base = { category: 'road_damage', areaType: 'city_corporation', lang: 'en' as const };

describe('report configuration', () => {
  it('every category has a route for every kind of area, in both languages, and the routing table says it is unverified', () => {
    expect(cfg.routing.status).toBe('DRAFT_UNVERIFIED');
    for (const c of cfg.categories) { expect(c.name_en && c.name_bn).toBeTruthy(); for (const a of cfg.routing.area_types) { const r = cfg.routing.routes[c.id][a.id]; expect(r.body_en && r.body_bn, `${c.id}/${a.id}`).toBeTruthy(); } }
    expect(cfg.categories.filter((c) => c.safety).map((c) => c.id)).toEqual(expect.arrayContaining(['open_manhole', 'electrical_hazard']));
  });
});
describe('tracking codes', () => {
  it('look like KR-XXXX-XXXX with no confusing characters, and do not repeat', () => {
    const seen = new Set<string>(); for (let i = 0; i < 2000; i++) { const c = newCode(); expect(CODE_RE.test(c)).toBe(true); expect(c).not.toMatch(/[01OIL]/); seen.add(c); } expect(seen.size).toBe(2000);
  });
});
describe('geo', () => {
  it('rounds to about 110 m, knows Bangladesh, measures distance', () => {
    expect(roundCoord(23.810331)).toBe(23.81); expect(inBangladesh(23.81, 90.41)).toBe(true); expect(inBangladesh(28.6, 77.2)).toBe(false); expect(inBangladesh(NaN, 90)).toBe(false);
    expect(Math.round(haversineM(23.81, 90.41, 23.81, 90.41))).toBe(0); expect(Math.round(haversineM(23.81, 90.41, 23.811, 90.41))).toBeGreaterThan(105); expect(Math.round(haversineM(23.81, 90.41, 23.811, 90.41))).toBeLessThan(115);
    expect(haversineM(23.81, 90.41, 22.34, 91.83) / 1000).toBeGreaterThan(200);       // Dhaka to Chattogram is roughly 215 km
  });
});
describe('photo metadata is stripped on the server too', () => {
  it('removes EXIF (with GPS) and comments but keeps a valid JPEG', () => {
    expect(hasMetadata(WITH_EXIF)).toBe(true); const out = stripJpegMetadata(WITH_EXIF)!;
    expect(out.includes('GPSLatitude')).toBe(false); expect(out.includes('Rahim')).toBe(false); expect(isJpeg(out)).toBe(true); expect(out.includes('JFIF')).toBe(true); expect(hasMetadata(out)).toBe(false);
    expect(out.subarray(out.length - 2)).toEqual(Buffer.from([0xff, 0xd9]));
  });
  it('rejects things that are not well-formed JPEGs', () => {
    expect(stripJpegMetadata(Buffer.from('GIF89a....'))).toBeNull(); expect(stripJpegMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x00]))).toBeNull(); expect(stripJpegMetadata(Buffer.alloc(0))).toBeNull();
  });
  it('the real EXIF test photo from the project is cleaned', () => {
    const real = readFileSync('testdata/e2e/big-exif.jpg'); const out = stripJpegMetadata(real); expect(out).not.toBeNull(); expect(hasMetadata(out!)).toBe(false); expect(out!.length).toBeLessThanOrEqual(real.length);
  });
});
describe('AI category suggestion', () => {
  const ok = (o: object) => JSON.stringify({ confidence: 0.9, is_public_infrastructure_problem: true, ...o });
  it('suggests a category only when the model is confident and names a real category', async () => {
    expect(await mk(llm(ok({ category: 'open_manhole' }))).svc.classify(WITH_EXIF)).toEqual({ category: 'open_manhole', confidence: 0.9, reason: 'ok' });
    expect(await mk(llm(ok({ category: 'streetlight', confidence: 0.4 }))).svc.classify(WITH_EXIF)).toEqual({ category: null, confidence: 0.4, reason: 'low_confidence' });
    expect(await mk(llm(ok({ category: 'moon_base' }))).svc.classify(WITH_EXIF)).toMatchObject({ category: null, reason: 'bad_output' });
  });
  it('refuses selfies and screenshots, bad replies, a failing model, no model, and non-JPEG data', async () => {
    expect(await mk(llm(ok({ category: 'other', is_public_infrastructure_problem: false }))).svc.classify(WITH_EXIF)).toMatchObject({ reason: 'not_infrastructure' });
    expect(await mk(llm('it is a pothole')).svc.classify(WITH_EXIF)).toMatchObject({ reason: 'bad_output' });
    expect(await mk(llm(new Error('x'))).svc.classify(WITH_EXIF)).toMatchObject({ reason: 'model_failed' });
    expect(await mk(null).svc.classify(WITH_EXIF)).toMatchObject({ reason: 'no_model' });
    expect(await mk(llm(ok({ category: 'other' }))).svc.classify(Buffer.from('not a jpeg'))).toMatchObject({ reason: 'bad_image' });
  });
  it('sends the photo and the fixed list of ids to the model, and tells it text in the photo is data', async () => {
    let seen: any; const spy: LlmClient = { async complete(r) { seen = r; return ok({ category: 'other', confidence: 0.2 }); } };
    await mk(spy).svc.classify(WITH_EXIF); expect(seen.image.mediaType).toBe('image/jpeg'); expect(seen.userText).toContain('road_damage'); expect(CLASSIFY_SYSTEM).toMatch(/data, never instructions/); expect(CLASSIFY_SYSTEM).toMatch(/number plates/);
  });
});
describe('creating a report', () => {
  it('stores the ticket routed by category and kind of area, with the location rounded and a clean photo', () => {
    const { svc, store } = mk(); const r = svc.create({ ...base, description: 'Big hole near the school', lat: 23.810331, lng: 90.412518, photo: WITH_EXIF });
    expect(r.ok).toBe(true); const t = (r as any).ticket; expect(CODE_RE.test(t.id)).toBe(true);
    expect(t).toMatchObject({ status: 'received', lat: 23.81, lng: 90.413, supporters: 0, body: { body_en: 'City Corporation' } });
    const photo = store.readPhoto(t.photo)!; expect(photo.includes('GPSLatitude')).toBe(false); expect(isJpeg(photo)).toBe(true);
  });
  it('routes the same problem to a different office in a different kind of area', () => {
    const { svc } = mk(); expect((svc.create({ ...base, areaType: 'highway' }) as any).ticket.body.body_en).toBe('Roads and Highways Department'); expect((svc.create({ ...base, category: 'electrical_hazard', areaType: 'union_parishad' }) as any).ticket.body.body_en).toMatch(/electricity/i);
  });
  it('hides personal numbers typed into the description, and caps its length', () => {
    const t = (mk().svc.create({ ...base, description: `Call me 01712345678 ${'x'.repeat(500)}` }) as any).ticket; expect(t.description).not.toContain('01712345678'); expect(t.description.length).toBeLessThanOrEqual(300);
  });
  it('a location outside Bangladesh or half given is not stored', () => {
    const { svc } = mk(); const a = (svc.create({ ...base, lat: 28.6, lng: 77.2 }) as any).ticket; const b = (svc.create({ ...base, lat: 23.8 }) as any).ticket; expect([a.lat, a.lng, b.lat, b.lng]).toEqual([null, null, null, null]);
  });
  it('rejects unknown categories and areas, oversized photos and corrupt photos', () => {
    const { svc } = mk();
    expect(svc.create({ ...base, category: 'nope' })).toEqual({ ok: false, error: 'bad_category' }); expect(svc.create({ ...base, areaType: 'moon' })).toEqual({ ok: false, error: 'bad_area' });
    expect(svc.create({ ...base, photo: Buffer.concat([WITH_EXIF, Buffer.alloc(MAX_PHOTO_BYTES)]) })).toEqual({ ok: false, error: 'photo_too_large' }); expect(svc.create({ ...base, photo: Buffer.from('nope') })).toEqual({ ok: false, error: 'bad_photo' });
  });
  it('records whether the category came from the AI suggestion or from the person', () => {
    const { svc } = mk(); expect((svc.create({ ...base, suggested: { category: 'road_damage', confidence: 0.9 } }) as any).ticket.suggested.by).toBe('ai'); expect((svc.create({ ...base, suggested: { category: 'garbage', confidence: 0.9 } }) as any).ticket.suggested.by).toBe('person');
  });
});
describe('duplicates and "me too"', () => {
  const at = { ...base, lat: 23.81, lng: 90.41 };
  it('spots an open report of the same kind within 60 m and does not create a new one unless forced', () => {
    const { svc, store } = mk(); svc.create(at);
    const near = svc.create({ ...at, lat: 23.8103 }); expect(near).toMatchObject({ ok: false, error: 'similar_exists' }); expect((near as any).similar[0].distanceM).toBeLessThanOrEqual(60); expect(store.all()).toHaveLength(1);
    expect(svc.create({ ...at, lat: 23.8103, force: true }).ok).toBe(true); expect(store.all()).toHaveLength(2);
  });
  it('ignores reports that are far, of another kind, resolved, or old', () => {
    const { svc, c } = mk(); const first = (svc.create(at) as any).ticket;
    expect(svc.create({ ...at, lat: 23.812 }).ok).toBe(true); expect(svc.create({ ...at, category: 'garbage' }).ok).toBe(true);
    svc.setStatus(first.id, 'resolved'); expect(svc.create({ ...at, lat: 23.8101 }).ok).toBe(true);
    const { svc: s2, c: c2 } = mk(); s2.create(at); c2.advanceDays(22); expect(s2.create({ ...at, lat: 23.8101 }).ok).toBe(true); void c;
  });
  it('"me too" raises the count on an open ticket only', () => {
    const { svc } = mk(); const t = (svc.create(at) as any).ticket; expect(svc.support(t.id)!.supporters).toBe(1); expect(svc.support(t.id)!.supporters).toBe(2);
    svc.setStatus(t.id, 'resolved'); expect(svc.support(t.id)).toBeNull(); expect(svc.support('KR-AAAA-BBBB')).toBeNull();
  });
});
describe('tracking by code (what the public can see)', () => {
  it('shows status and office but never the description, location or photo', () => {
    const { svc } = mk(); const t = (svc.create({ ...base, description: 'private detail', lat: 23.81, lng: 90.41, photo: WITH_EXIF }) as any).ticket;
    const v = svc.track(t.id)!; expect(Object.keys(v).sort()).toEqual(['body', 'category', 'createdAt', 'id', 'note', 'status', 'supporters', 'updatedAt']); expect(JSON.stringify(v)).not.toMatch(/private detail|23\.81|photo/);
    expect(svc.track('not-a-code')).toBeNull(); expect(svc.track('KR-AAAA-BBBB')).toBeNull();
  });
});
describe('agency side', () => {
  it('orders by priority: a safety hazard outranks routine reports, supporters and age add up, closed tickets drop to zero', () => {
    const { svc, c } = mk(); const a = (svc.create({ ...base, category: 'streetlight' }) as any).ticket; const hz = (svc.create({ ...base, category: 'open_manhole' }) as any).ticket;
    for (let i = 0; i < 5; i++) svc.support(a.id); c.advanceDays(10);
    const list = svc.list(); expect(list[0].id).toBe(hz.id); expect(list[0].priority).toBeGreaterThan(list[1].priority);
    svc.setStatus(hz.id, 'resolved'); expect(svc.list().find((t) => t.id === hz.id)!.priority).toBe(0); expect(priorityScore({ supporters: 0, createdAt: new Date().toISOString(), status: 'received' }, undefined)).toBeGreaterThan(0);
  });
  it('status changes are validated, notes lose personal numbers, and filters work', () => {
    const { svc } = mk(); const t = (svc.create(base) as any).ticket;
    expect(svc.setStatus(t.id, 'teleported')).toBeNull(); expect(svc.setStatus('KR-ZZZZ-ZZZZ', 'resolved')).toBeNull();
    const u = svc.setStatus(t.id, 'forwarded', 'Sent to ward office, call 01712345678')!; expect(u.status).toBe('forwarded'); expect(u.note).not.toContain('01712345678');
    expect(svc.list({ status: 'forwarded' })).toHaveLength(1); expect(svc.list({ status: 'received' })).toHaveLength(0); expect(svc.list({ category: 'garbage' })).toHaveLength(0);
  });
  it('CSV export neutralises spreadsheet formulas and quotes properly', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`); expect(csvCell('+1')).toBe("'+1"); expect(csvCell('a,b')).toBe('"a,b"'); expect(csvCell(null)).toBe('');
    const { svc } = mk(); svc.create({ ...base, description: '=cmd|calc' }); const lines = svc.csv().split('\n'); expect(lines[0]).toMatch(/^id,created,status/); expect(lines[1]).toContain("'=cmd|calc");
  });
  it('purges photos of long-closed tickets and of very old tickets, and keeps the rest', () => {
    const { svc, c, store } = mk(); const keep = (svc.create({ ...base, photo: WITH_EXIF }) as any).ticket; const done = (svc.create({ ...base, category: 'garbage', photo: WITH_EXIF }) as any).ticket;
    svc.setStatus(done.id, 'resolved'); c.advanceDays(15);
    expect(svc.purgePhotos()).toBe(1); expect(store.get(done.id)!.photo).toBeNull(); expect(store.get(keep.id)!.photo).not.toBeNull(); expect(svc.photo(done.id)).toBeNull();
    c.advanceDays(170); expect(svc.purgePhotos()).toBe(1); expect(store.get(keep.id)!.photo).toBeNull();
  });
  it('the public summary folds small groups', () => {
    const { svc } = mk(); for (let i = 0; i < 6; i++) svc.create({ ...base, lat: 23.5 + i * 0.01, lng: 90.4 }); svc.create({ ...base, category: 'garbage' }); svc.create({ ...base, category: 'streetlight' });
    const s = svc.publicSummary(); expect(s.total).toBe(8); expect(s.byCategory).toEqual([{ label: 'road_damage', count: 6 }, { label: 'other (small counts hidden)', count: 2 }]); expect(s.resolvedMedianDays).toBeNull();
  });
});
describe('file store', () => {
  it('survives a restart, keeps the latest version of each ticket, skips a torn last line, and keeps photos on disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kr-')); const c = clock(); const a = new ReportService(cfg, new FileTicketStore(dir), null, c.now);
    const t = (a.create({ ...base, photo: WITH_EXIF }) as any).ticket; a.setStatus(t.id, 'in_review', 'looking');
    appendFileSync(join(dir, 'tickets.jsonl'), '{"id":"KR-TORN'); const b = new ReportService(cfg, new FileTicketStore(dir), null, c.now);
    expect(b.store.all()).toHaveLength(1); expect(b.store.get(t.id)).toMatchObject({ status: 'in_review', note: 'looking' }); expect(b.photo(t.id)!.length).toBeGreaterThan(50);
    expect(readdirSync(join(dir, 'photos'))).toEqual([`${t.id}.jpg`]);
  });
  it('refuses path tricks when reading or deleting photos', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kr-')); writeFileSync(join(dir, 'secret.jpg'), 'x'); const s = new FileTicketStore(dir);
    expect(s.readPhoto('../secret.jpg')).toBeNull(); s.deletePhoto('../secret.jpg'); expect(existsSync(join(dir, 'secret.jpg'))).toBe(true);
  });
});
