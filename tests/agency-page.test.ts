import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync('public/agency.html', 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
const js = readFileSync('public/agency.js', 'utf8');
const CATS = [{ id: 'road_damage', name_en: 'Road damage or pothole' }, { id: 'garbage', name_en: 'Garbage' }];
const T = (o: object = {}) => ({ id: 'KR-7F3K-9Q2M', category: 'road_damage', areaType: 'city_corporation', body: { body_en: 'City Corporation', body_bn: 'x' }, description: 'Hole by the school', lat: 23.81, lng: 90.413, createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-10T00:00:00Z', status: 'received', note: '', supporters: 2, hasPhoto: true, priority: 4.4, suggested: { category: 'road_damage', confidence: 0.9, by: 'ai' }, lang: 'en', ...o });
const LIST = (tickets: object[]) => ({ categories: CATS, areaTypes: [], routingStatus: 'DRAFT_UNVERIFIED', tickets, summary: { total: tickets.length, resolvedMedianDays: null } });
const res = (body: unknown, status = 200, extra: object = {}) => Promise.resolve({ ok: status < 400, status, json: async () => body, blob: async () => new Blob(['x']), ...extra });
const tick = (n = 25) => new Promise((r) => setTimeout(r, n));
function boot(handler: (p: string, i?: any) => Promise<any>) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/agency.html' }); const w: any = dom.window;
  w.fetch = vi.fn((p: string, i: any) => handler(p, i)); w.URL.createObjectURL = () => 'blob:photo'; w.eval(js);
  const login = async (tok = 'secret') => { (w.document.getElementById('token') as HTMLInputElement).value = tok; w.document.getElementById('auth').dispatchEvent(new w.Event('submit', { cancelable: true })); await tick(); };
  return { w, d: w.document as Document, login };
}
const click = (a: ReturnType<typeof boot>, e: Element | null) => e!.dispatchEvent(new a.w.MouseEvent('click', { bubbles: true }));

describe('agency console page', () => {
  it('sends the token as a bearer header, lists reports with priority and details, and never puts the token in a URL', async () => {
    const a = boot((p) => res(LIST([T()]))); await a.login('tok-123'); const call = a.w.fetch.mock.calls[0];
    expect(call[0]).toBe('/api/agency/tickets?'); expect(call[1].headers.authorization).toBe('Bearer tok-123');
    const t = a.d.querySelector('.ticket')!.textContent!; expect(t).toContain('KR-7F3K-9Q2M'); expect(t).toContain('Priority 4.4'); expect(t).toContain('City Corporation'); expect(t).toContain('Hole by the school'); expect(t).toContain('suggested by AI');
  });
  it('explains a wrong token, a console that is off, and rate limiting', async () => {
    for (const [status, text] of [[401, 'not valid'], [404, 'not switched on'], [429, 'Too many']] as const) { const a = boot(() => res({}, status)); await a.login(); expect(a.d.getElementById('msg')!.textContent).toContain(text); expect(a.d.querySelector('.ticket')).toBeNull(); }
  });
  it('saves a status and note, then reloads the list', async () => {
    let status = 'received'; const calls: any[] = [];
    const a = boot((p, i) => { if (p === '/api/agency/status') { calls.push(JSON.parse(i.body)); status = JSON.parse(i.body).status; return res({ id: 'KR-7F3K-9Q2M', status }); } return res(LIST([T({ status })])); });
    await a.login(); const sel = a.d.querySelector('.ticket select') as HTMLSelectElement; sel.value = 'forwarded'; (a.d.querySelector('.ticket input') as HTMLInputElement).value = 'Sent to ward 4';
    click(a, [...a.d.querySelectorAll('.ticket .btn')].find((b) => b.textContent === 'Save') as Element); await tick(50);
    expect(calls[0]).toEqual({ id: 'KR-7F3K-9Q2M', status: 'forwarded', note: 'Sent to ward 4' }); expect(a.d.querySelector('.ticket')!.getAttribute('data-status')).toBe('forwarded');
  });
  it('filters by status and category through the query string, and shows the photo only on request', async () => {
    const a = boot((p) => (p.startsWith('/api/agency/photo/') ? res({}, 200) : res(LIST([T()])))); await a.login();
    const sels = a.d.querySelectorAll('.wrap .frow select'); (sels[0] as HTMLSelectElement).value = 'resolved'; sels[0].dispatchEvent(new a.w.Event('change')); await tick();
    expect(a.w.fetch.mock.calls.at(-1)[0]).toContain('status=resolved'); expect(a.d.querySelector('img.ticketphoto')).toBeNull();
    click(a, [...a.d.querySelectorAll('.ticket .btn')].find((b) => b.textContent === 'Show photo') as Element); await tick(); expect(a.d.querySelector('img.ticketphoto')!.getAttribute('src')).toBe('blob:photo');
  });
  it('treats ticket text as plain text', async () => {
    const evil = '<img src=x onerror="window.__pwned=1">'; const a = boot(() => res(LIST([T({ description: evil, note: evil })]))); await a.login();
    expect(a.d.querySelector('img[onerror]')).toBeNull(); expect(a.w.__pwned).toBeUndefined(); expect(a.d.querySelector('.ticket')!.textContent).toContain(evil);
  });
});
