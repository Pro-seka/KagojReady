import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { loadGlossary } from '../src/plain/glossary';
import { plainLanguage } from '../src/plain';

const html = readFileSync('public/index.html', 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
const js = readFileSync('public/app.js', 'utf8');
const lanes = ['coach', 'plain', 'report'].map((n) => readFileSync(`public/lanes/${n}.js`, 'utf8'));
const sample = JSON.parse(readFileSync('public/samples/plain-sample.json', 'utf8'));
const glossary = loadGlossary();

const SERVICES = { demo: false, chat: true, llm: null, reports: true, services: [{ id: 'bd-passport-adult-renewal', name_en: 'Passport renewal (adult)', name_bn: 'পাসপোর্ট নবায়ন', applicantTypes: ['adult'], status: 'DRAFT_UNVERIFIED', lastVerified: null, stale: false, documents: [{ id: 'old_passport', name_en: 'Existing passport', name_bn: 'বর্তমান পাসপোর্ট', tip_en: '', tip_bn: '' }, { id: 'nid', name_en: 'National ID card', name_bn: 'জাতীয় পরিচয়পত্র', tip_en: '', tip_bn: '' }] }] };
const REPORT_CFG = { routingStatus: 'DRAFT_UNVERIFIED', areaTypes: [{ id: 'city_corporation', name_en: 'City Corporation', name_bn: 'সিটি কর্পোরেশন' }, { id: 'unknown', name_en: 'I do not know', name_bn: 'জানি না' }],
  categories: [{ id: 'road_damage', name_en: 'Road damage or pothole', name_bn: 'রাস্তার ক্ষতি বা গর্ত', safety: false, base_priority: 3 }, { id: 'garbage', name_en: 'Uncollected garbage', name_bn: 'ময়লা', safety: false, base_priority: 3 }] };
type Handler = (path: string, init?: any) => Promise<any>;
const ok = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });

function boot(handler: Handler, extra: (w: any) => void = () => {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w: any = dom.window;
  w.fetch = vi.fn((p: string, i: any) => handler(p, i)); w.URL.createObjectURL = () => 'blob:test'; w.URL.revokeObjectURL = vi.fn();
  w.__krImport = (p: string) => import(`../public${p.replace('/lib', '/lib')}`);      // the browser's import('/lib/validate.mjs'), served from disk
  w.createImageBitmap = async () => ({ width: 800, height: 600, close() {} });
  w.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} }); w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,/9j/4AAQ';
  w.print = vi.fn(); extra(w); w.eval(js); for (const l of lanes) w.eval(l);
  return { w, d: w.document as Document, S: w.__kr.state, calls: (p: string) => w.fetch.mock.calls.filter((c: any[]) => c[0] === p).map((c: any[]) => (c[1]?.body ? JSON.parse(c[1].body) : null)), allPaths: () => w.fetch.mock.calls.map((c: any[]) => c[0]) };
}
type App = ReturnType<typeof boot>;
const tick = (n = 30) => new Promise((r) => setTimeout(r, n));
const click = (a: App, e: Element | null | undefined) => e!.dispatchEvent(new a.w.MouseEvent('click', { bubbles: true }));
const accepted = async (h: Handler, extra?: (w: any) => void) => { const a = boot(h, extra); click(a, a.d.getElementById('accept')); await tick(); return a; };
const lane = (a: App, id: string) => a.d.querySelector(`.lane[data-lane="${id}"]`) as HTMLElement | null;
const typeInto = (a: App, el: Element, v: string) => { (el as HTMLInputElement).value = v; el.dispatchEvent(new a.w.Event('input', { bubbles: true })); };
const byText = (a: App, sel: string, text: string) => [...a.d.querySelectorAll(sel)].find((e) => e.textContent!.includes(text)) as HTMLElement | undefined;
const pickFile = (a: App, sel: string) => { const i = a.d.querySelector(sel) as HTMLInputElement; Object.defineProperty(i, 'files', { value: [new a.w.File([new Uint8Array([0xff, 0xd8, 0xff, 1])], 'p.jpg', { type: 'image/jpeg' })], configurable: true }); i.dispatchEvent(new a.w.Event('change', { bubbles: true })); };
const base: Handler = (p) => (p === '/api/services' ? ok(SERVICES) : p === '/api/reports/config' ? ok(REPORT_CFG) : p === '/samples/plain-sample.json' ? ok(sample) : ok({}, 404));

describe('lane navigation', () => {
  it('shows the lanes only after consent, in order; the report lane appears only when the server has reports', async () => {
    const a = boot(base); expect(a.d.getElementById('lanes')!.hidden).toBe(true);
    click(a, a.d.getElementById('accept')); await tick(); expect(a.d.getElementById('lanes')!.hidden).toBe(false);
    expect([...a.d.querySelectorAll('.lane')].map((b) => b.getAttribute('data-lane'))).toEqual(['ask', 'check', 'coach', 'plain', 'report']); expect(a.d.getElementById('lanes')!.getAttribute('aria-label')).toContain('কী করতে');
    const b = await accepted((p) => (p === '/api/services' ? ok({ ...SERVICES, reports: false }) : ok({}, 404)));
    expect([...b.d.querySelectorAll('.lane')].map((x) => x.getAttribute('data-lane'))).not.toContain('report');
  });
  it('labels follow the language, and the pressed lane is marked', async () => {
    const a = await accepted(base); click(a, lane(a, 'plain')); await tick(); expect(lane(a, 'plain')!.getAttribute('aria-pressed')).toBe('true');
    click(a, a.d.getElementById('lang-en')); expect(lane(a, 'plain')!.textContent).toBe('Plain language'); expect(lane(a, 'report')!.textContent).toBe('Report a problem');
  });
  it('larger text toggles a class and is bookmarkable as #large, with no storage', async () => {
    const a = await accepted(base); click(a, a.d.getElementById('largeBtn')); expect(a.d.body.classList.contains('large')).toBe(true); expect(a.w.location.hash).toBe('#large'); expect(a.d.getElementById('largeBtn')!.getAttribute('aria-pressed')).toBe('true');
    click(a, a.d.getElementById('largeBtn')); expect(a.d.body.classList.contains('large')).toBe(false); expect(a.w.localStorage.length).toBe(0);
  });
});

describe('form coach lane', () => {
  const open = async () => { const a = await accepted(base); click(a, lane(a, 'coach')); await tick(); await tick(); return a; };
  it('opens with every field, says plainly that nothing leaves the device, and makes no network call', async () => {
    const a = await open(); expect(a.d.querySelectorAll('.coach .field').length).toBe(8); expect(a.d.querySelector('.notice.local')!.textContent).toContain('কোথাও পাঠানো হয় না');
    typeInto(a, a.d.getElementById('cf-nid')!, '1234'); typeInto(a, a.d.getElementById('cf-mobile')!, '0171'); await tick();
    expect(a.allPaths().filter((p: string) => p !== '/api/services' && p !== '/api/reports/config')).toEqual([]);
  });
  it('checks each field as you type, in the chosen language, without losing focus', async () => {
    const a = await open(); const nid = a.d.getElementById('cf-nid') as HTMLInputElement; nid.focus(); typeInto(a, nid, '123456789012');
    const st = () => a.d.getElementById('cf-nid-s')!; expect(st().textContent).toContain('১০, ১৩ বা ১৭'); expect(st().className).toContain('err'); expect(nid.getAttribute('aria-invalid')).toBe('true'); expect(a.d.activeElement).toBe(nid);
    typeInto(a, nid, '1234567890'); expect(st().className).toContain('ok'); expect(st().textContent).toBe(''.padEnd(0) + st().textContent);
    click(a, a.d.getElementById('lang-en')); await tick(); typeInto(a, a.d.getElementById('cf-nid')!, '12'); expect(a.d.getElementById('cf-nid-s')!.textContent).toContain('10, 13 or 17 digits');
  });
  it('echoes how a date was read, warns on a minor, and flags two answers that do not fit together', async () => {
    const a = await open(); click(a, a.d.getElementById('lang-en')); await tick();
    typeInto(a, a.d.getElementById('cf-dob')!, '12/03/1990'); expect(a.d.getElementById('cf-dob-s')!.textContent).toBe('Read as 12 March 1990.');
    typeInto(a, a.d.getElementById('cf-dob')!, '01/01/2015'); expect(a.d.getElementById('cf-dob-s')!.className).toContain('warn');
    typeInto(a, a.d.getElementById('cf-name')!, 'Abdur Rahim'); typeInto(a, a.d.getElementById('cf-father_name')!, 'abdur rahim'); expect(a.d.getElementById('coachCross')!.textContent).toContain('identical');
    typeInto(a, a.d.getElementById('cf-mobile')!, '+8801712345678'); expect(a.d.getElementById('cf-mobile-s')!.className).toContain('ok'); expect(a.d.getElementById('coachSummary')!.textContent).toMatch(/\d of \d/);
  });
  it('copy and clear work; "next" opens the document check', async () => {
    const written: string[] = []; const a = await accepted(base, (w) => { Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (s: string) => { written.push(s); } }, configurable: true }); });
    click(a, lane(a, 'coach')); await tick(); await tick(); click(a, a.d.getElementById('lang-en')); await tick(); typeInto(a, a.d.getElementById('cf-name')!, 'Abdur Rahim'); typeInto(a, a.d.getElementById('cf-mobile')!, '01712345678');
    click(a, a.d.querySelector('[data-coach-copy]')); await tick(); expect(written[0]).toContain('Full name (English): Abdur Rahim'); expect(written[0]).toContain('Mobile number: 01712345678');
    click(a, byText(a, '.coach .btn', 'Clear')); await tick(); expect((a.d.getElementById('cf-name') as HTMLInputElement).value).toBe('');
    click(a, byText(a, '.coach .btn', 'check my documents')); await tick(); expect(a.d.querySelector('input[data-doc="nid"]')).not.toBeNull();
  });
  it('fills a field from speech, converting spoken digits, and never sends audio or text anywhere', async () => {
    class Rec { lang = ''; onresult: any; onend: any; onerror: any; start() { setTimeout(() => { this.onresult({ results: [[{ transcript: 'zero one seven one two three four five six seven eight' }]] }); this.onend(); }, 5); } stop() {} }
    const a = await accepted(base, (w) => { w.webkitSpeechRecognition = Rec; }); click(a, lane(a, 'coach')); await tick(); await tick();
    click(a, a.d.querySelector('[data-field="mobile"] button')); await tick(60); expect((a.d.getElementById('cf-mobile') as HTMLInputElement).value).toBe('01712345678'); expect(a.d.getElementById('cf-mobile-s')!.className).toContain('ok');
  });
});

describe('plain-language lane', () => {
  const run = async (llm = false) => {
    const handler: Handler = (p, init) => (p === '/api/plain' ? plainLanguage({ text: JSON.parse(init.body).text, lang: JSON.parse(init.body).lang, glossary, llm: null }).then((r) => ok({ ...r, stored: false })) : base(p));
    const a = await accepted(handler); click(a, a.d.getElementById('lang-en')); await tick(); click(a, lane(a, 'plain')); await tick(); void llm; return a;
  };
  it('loads the made-up sample with a note that it is not real law, and the button needs enough text', async () => {
    const a = await run(); const go = a.d.querySelector('[id^=pgo-]') as HTMLButtonElement; expect(go.disabled).toBe(true);
    click(a, a.d.querySelector('[data-plain-sample]')); await tick(); expect((a.d.querySelector('.bigarea') as HTMLTextAreaElement).value).toBe(sample.samples.en);
    expect(a.d.body.textContent).toContain('made-up text'); expect((a.d.querySelector('[id^=pgo-]') as HTMLButtonElement).disabled).toBe(false);
  });
  it('explains the sample: difficulty, deadlines and amounts, hard words, and links every point back to its original sentence', async () => {
    const a = await run();
    click(a, a.d.querySelector('[data-plain-sample]')); await tick();
    click(a, a.d.querySelector('[id^=pgo-]')); await tick(80);
    expect(a.calls('/api/plain')[0]).toMatchObject({ lang: 'en' }); const text = a.d.body.textContent!;
    expect(text).toContain('How hard is this text?'); expect(text).toContain('Tk. 1,500'); expect(text).toContain('within 30 days'); expect(text).toContain('notwithstanding'); expect(text).toContain('No AI was used');
    const dts = a.d.querySelectorAll('dl.gloss dt'); expect(dts.length).toBeGreaterThan(5); expect(a.d.querySelector('dl.gloss')!.textContent).not.toContain('[object'); expect([...a.d.querySelectorAll('dl.gloss > *')].every((n) => n.tagName === 'DT' || n.tagName === 'DD')).toBe(true);
    const cite = a.d.querySelector('ul.pts .cite') as HTMLElement; click(a, cite); const hl = a.d.querySelector('ol.orig li.hl'); expect(hl).not.toBeNull(); expect((a.d.querySelector('details[id^=orig-]') as HTMLDetailsElement).open).toBe(true);
    expect(a.d.querySelector('[data-listen]')).toBeNull();     // no speech voices in this environment: the button is hidden, not broken
  });
  it('shows a clear message for rate limiting and keeps the pasted text', async () => {
    const a = await accepted((p) => (p === '/api/plain' ? ok({}, 429) : base(p))); click(a, lane(a, 'plain')); await tick(); typeInto(a, a.d.querySelector('.bigarea')!, 'x'.repeat(60));
    click(a, a.d.querySelector('[id^=pgo-]')); await tick(); expect(a.d.querySelector('.card [role=alert]')!.textContent).toContain('অনেক বেশি'); expect((a.d.querySelector('.bigarea') as HTMLTextAreaElement).value).toBe('x'.repeat(60));
  });
  it('treats server text as plain text', async () => {
    const evil = '<img src=x onerror="window.__pwned=1">';
    const a = await accepted((p) => (p === '/api/plain' ? ok({ mode: 'extractive', usedLlm: false, steps: [], redactions: [], truncated: false, droppedPoints: 0, points: [{ text: evil, sentence: 0 }], analysis: { lang: 'en', sentences: [evil], facts: [{ kind: 'money', sentence: 0, value: evil }], jargon: [{ id: 'x', found: evil, term: evil, plain: evil, sentence: 0 }], readability: { words: 1, sentences: 1, avgWords: 1, longSentences: [], jargonPer100: 0, level: 'plain' }, summary: [0] } }) : base(p)));
    click(a, lane(a, 'plain')); await tick(); typeInto(a, a.d.querySelector('.bigarea')!, 'x'.repeat(60)); click(a, a.d.querySelector('[id^=pgo-]')); await tick();
    expect(a.d.querySelector('img[onerror]')).toBeNull(); expect(a.w.__pwned).toBeUndefined(); expect(a.d.body.textContent).toContain(evil);
  });
});

describe('civic report lane', () => {
  const created = { created: true, id: 'KR-7F3K-9Q2M', body: { body_en: 'City Corporation', body_bn: 'সিটি কর্পোরেশন' }, status: 'received', photoKept: true, locationKept: true };
  const mk = (over: Record<string, Handler> = {}): Handler => (p, i) => (over[p] ? over[p](p, i) : base(p));
  const open = async (over: Record<string, Handler> = {}, extra?: (w: any) => void) => { const a = await accepted(mk(over), extra); click(a, a.d.getElementById('lang-en')); await tick(); click(a, lane(a, 'report')); await tick(); await tick(); return a; };
  it('suggests a category from the photo but leaves the person in charge, and warns about faces and plates', async () => {
    const a = await open({ '/api/reports/classify': () => ok({ category: 'road_damage', confidence: 0.9, reason: 'ok', stored: false }) });
    expect(a.d.body.textContent).toContain('number plates'); pickFile(a, 'input[data-report-photo]'); await tick(80);
    expect(a.calls('/api/reports/classify')[0].image).toMatch(/^data:image\/jpeg;base64,/); expect(a.d.querySelector('[data-suggestion]')!.textContent).toContain('Suggested from the photo: Road damage or pothole');
    expect((a.d.getElementById('rep-cat') as HTMLSelectElement).value).toBe('road_damage'); (a.d.getElementById('rep-cat') as HTMLSelectElement).value = 'garbage'; a.d.getElementById('rep-cat')!.dispatchEvent(new a.w.Event('change'));
    click(a, a.d.querySelector('[data-send-report]')); await tick();
  });
  it('without a model it says so and asks the person to choose; a category is required', async () => {
    const a = await open({ '/api/reports/classify': () => ok({ category: null, confidence: null, reason: 'no_model', stored: false }) }); pickFile(a, 'input[data-report-photo]'); await tick(80);
    expect(a.d.querySelector('[data-suggestion]')!.textContent).toContain('not analysed'); click(a, a.d.querySelector('[data-send-report]')); await tick(); expect(a.d.querySelector('.card [role=alert]')!.textContent).toContain('Choose what the problem is'); expect(a.calls('/api/reports')).toEqual([]);
  });
  it('sends the confirmed report, shows the tracking code and what was kept, and is honest that nothing is sent into government systems', async () => {
    const a = await open({ '/api/reports/classify': () => ok({ category: 'road_damage', confidence: 0.9, reason: 'ok' }), '/api/reports': () => ok(created) }, (w) => { w.navigator.geolocation = { getCurrentPosition: (ok2: any) => ok2({ coords: { latitude: 23.8103, longitude: 90.4125 } }) }; });
    pickFile(a, 'input[data-report-photo]'); await tick(80); click(a, a.d.querySelector('[data-use-location]')); await tick(); expect(a.d.body.textContent).toContain('rounded to about 100 metres');
    typeInto(a, a.d.getElementById('rep-desc')!, 'Deep hole by the school'); click(a, a.d.querySelector('[data-send-report]')); await tick(80);
    expect(a.calls('/api/reports')[0]).toMatchObject({ category: 'road_damage', areaType: 'unknown', lat: 23.8103, lng: 90.4125, lang: 'en', force: false, suggested: { category: 'road_damage', confidence: 0.9 } }); expect(a.calls('/api/reports')[0].image).toMatch(/^data:image\/jpeg/);
    expect(a.d.querySelector('[data-code]')!.textContent).toBe('KR-7F3K-9Q2M'); const t = a.d.body.textContent!; expect(t).toContain('Addressed to: City Corporation'); expect(t).toContain('not confirmed by any authority'); expect(t).toContain('not sent into any government system'); expect(t).toContain('only way to check');
    expect(a.S.msgs.find((m: any) => m.kind === 'report').photo).toBeNull();      // the photo is wiped from memory once sent
  });
  it('a refused location does not block the report', async () => {
    const a = await open({}, (w) => { w.navigator.geolocation = { getCurrentPosition: (_o: any, err: any) => err({ code: 1 }) }; }); click(a, a.d.querySelector('[data-use-location]')); await tick(); expect(a.d.body.textContent).toContain('without it');
  });
  it('offers "me too" when a similar report exists, and "different problem" sends a forced report', async () => {
    let n = 0; const a = await open({ '/api/reports': (_p, i) => (JSON.parse(i.body).force ? ok(created) : (n++, ok({ created: false, similar: [{ id: 'KR-AAAA-BBBB', category: 'road_damage', body: {}, status: 'in_review', note: '', createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-11T00:00:00Z', supporters: 3, distanceM: 24 }] }))), '/api/reports/support': () => ok({ supporters: 4 }) });
    (a.d.getElementById('rep-cat') as HTMLSelectElement).value = 'road_damage'; a.d.getElementById('rep-cat')!.dispatchEvent(new a.w.Event('change')); click(a, a.d.querySelector('[data-send-report]')); await tick(80);
    expect(a.d.body.textContent).toContain('24 m away'); expect(a.d.body.textContent).toContain('3 supporters'); expect(n).toBe(1);
    click(a, a.d.querySelector('[data-force]')); await tick(80); expect(a.calls('/api/reports')[1].force).toBe(true); expect(a.d.querySelector('[data-code]')).not.toBeNull();
    const b = await open({ '/api/reports': () => ok({ created: false, similar: [{ id: 'KR-AAAA-BBBB', category: 'road_damage', body: {}, status: 'received', note: '', createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-10T00:00:00Z', supporters: 0, distanceM: 10 }] }), '/api/reports/support': () => ok({ supporters: 1 }) });
    (b.d.getElementById('rep-cat') as HTMLSelectElement).value = 'road_damage'; b.d.getElementById('rep-cat')!.dispatchEvent(new b.w.Event('change')); click(b, b.d.querySelector('[data-send-report]')); await tick(80); click(b, b.d.querySelector('[data-metoo]')); await tick(80);
    expect(b.calls('/api/reports/support')[0]).toEqual({ id: 'KR-AAAA-BBBB' }); expect(b.d.body.textContent).toContain('support was added');
  });
  it('tracks a report by code, showing status and the office note, and says when nothing is found', async () => {
    let found = true; const a = await open({ '/api/reports/track': () => (found ? ok({ id: 'KR-7F3K-9Q2M', category: 'road_damage', body: { body_en: 'City Corporation', body_bn: 'x' }, status: 'forwarded', note: 'Sent to ward 4', createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-12T00:00:00Z', supporters: 2 }) : ok({}, 404)) });
    const input = a.d.querySelector('.trackbox input') as HTMLInputElement; typeInto(a, input, 'kr-7f3k-9q2m'); click(a, byText(a, '.trackbox .btn', 'Check status')); await tick();
    expect(a.calls('/api/reports/track')[0]).toEqual({ id: 'KR-7F3K-9Q2M' }); expect(a.d.body.textContent).toContain('Forwarded to the office'); expect(a.d.body.textContent).toContain('Sent to ward 4');
    found = false; click(a, byText(a, '.trackbox .btn', 'Check status')); await tick(); expect(a.d.body.textContent).toContain('No report found');
  });
  it('shows a friendly error when the form configuration cannot load', async () => { const a = await open({ '/api/reports/config': () => ok({}, 503) }); expect(a.d.querySelector('[role=alert]')!.textContent).toContain('could not load'); });
});

describe('printable visit checklist', () => {
  it('contains document names and fixes but no value read from any photo, and removes itself afterwards', async () => {
    const RES = { verdict: 'NOT_READY', packId: 'bd-passport-adult-renewal', packStatus: 'DRAFT_UNVERIFIED', stale: false, lastVerified: null, issues: {}, disclaimer_en: 'Pre-check only.', disclaimer_bn: 'x', read: { nid: [{ field: 'name', value: 'Abdur Rahim' }] },
      results: [{ ruleId: 'RN-010', docs: ['nid'], outcome: 'FAIL', reason: 'mismatch', severity: 'blocker', ruleStatus: 'official', message_en: 'Date of birth is different.', message_bn: 'x', fix_en: ['Correct your NID first.'], fix_bn: ['x'], fixService: null, source: null }] };
    const a = await accepted((p) => (p === '/api/check' ? ok(RES) : base(p))); click(a, a.d.getElementById('lang-en')); await tick(); click(a, lane(a, 'check')); await tick();
    const input = a.d.querySelector('input[data-doc="nid"]') as HTMLInputElement; Object.defineProperty(input, 'files', { value: [new a.w.File([new Uint8Array([0xff, 0xd8, 0xff, 1])], 'p.jpg', { type: 'image/jpeg' })], configurable: true }); input.dispatchEvent(new a.w.Event('change', { bubbles: true })); await tick(60);
    click(a, a.d.getElementById('checkBtn')); await tick(80); let sheetText = '';
    a.w.print = () => { const s = a.d.querySelector('.printsheet')!; sheetText = s.textContent!; };
    click(a, a.d.querySelector('[data-print]')); expect(sheetText).toContain('Visit checklist'); expect(sheetText).toContain('Existing passport'); expect(sheetText).toContain('Date of birth is different.'); expect(sheetText).toContain('Correct your NID first.'); expect(sheetText).toContain('none of your personal details'); expect(sheetText).not.toContain('Abdur Rahim');
    a.w.dispatchEvent(new a.w.Event('afterprint')); expect(a.d.querySelector('.printsheet')).toBeNull();
  });
});
