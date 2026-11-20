import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync('public/index.html', 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');   // scripts are evaluated by hand below, in page order
const js = readFileSync('public/app.js', 'utf8');
const laneJs = ['coach', 'plain', 'report'].map((n) => readFileSync(`public/lanes/${n}.js`, 'utf8'));

const SERVICES = (extra: object = {}) => ({ demo: false, chat: true, llm: null, ...extra, services: [
  { id: 'bd-passport-adult-renewal', name_en: 'Passport renewal (adult)', name_bn: 'পাসপোর্ট নবায়ন (প্রাপ্তবয়স্ক)', applicantTypes: ['adult'], status: 'DRAFT_UNVERIFIED', lastVerified: null, stale: false,
    documents: [{ id: 'old_passport', name_en: 'Existing passport', name_bn: 'বর্তমান পাসপোর্ট', tip_en: 'Photograph flat.', tip_bn: 'সমতলে ছবি তুলুন।' }, { id: 'nid', name_en: 'National ID card', name_bn: 'জাতীয় পরিচয়পত্র', tip_en: '', tip_bn: '' }] },
  { id: 'bd-nid-correction', name_en: 'NID correction', name_bn: 'এনআইডি সংশোধন', applicantTypes: ['adult'], status: 'DRAFT_UNVERIFIED', lastVerified: null, stale: false, documents: [] }] });

const passage = (n: number, o: object = {}) => ({ n, id: `p${n}`, title: `Passage ${n} title`, snippet: `Passage ${n} text.`, status: 'official', service: 'bd-passport-adult-renewal',
  source: { label: `Source ${n}`, url: `https://example.org/${n}`, retrieved: '2026-10-20' }, ...o });
const ANSWER = (o: object = {}) => ({ mode: 'grounded', lang: 'en', answer: 'A renewal needs your existing passport [1] and your NID [2].', passages: [passage(1), passage(2, { status: 'unconfirmed', source: null })],
  actions: [{ type: 'check_documents', packId: 'bd-passport-adult-renewal' }], steps: ['redacted:nid', 'redacted:phone', 'retrieved:2', 'llm', 'validated'], redactions: [], usedLlm: true, topic: 'bd-passport-adult-renewal', stored: false, ...o });
const RESULT = (o: object = {}) => ({ verdict: 'NOT_READY', packId: 'bd-passport-adult-renewal', packVersion: '0.1.0', packStatus: 'DRAFT_UNVERIFIED', stale: false, lastVerified: null, demo: false, issues: {}, stored: false,
  disclaimer_en: 'This is a pre-check, not an official approval.', disclaimer_bn: 'এটি একটি প্রাথমিক যাচাই।', read: { nid: [{ field: 'name', value: 'Abdur Rahim' }, { field: 'dob', value: null }] },
  results: [
    { ruleId: 'RN-010', docs: ['nid', 'old_passport'], outcome: 'FAIL', reason: 'mismatch', severity: 'blocker', ruleStatus: 'official', message_en: 'Date of birth is different.', message_bn: 'জন্ম তারিখ আলাদা।', fix_en: ['Correct the document.'], fix_bn: ['নথি সংশোধন করুন।'], fixService: 'bd-nid-correction', source: { label: 'Mission page', url: 'https://example.org/x', retrieved: '2026-10-20' } },
    { ruleId: 'RN-020', docs: ['nid'], outcome: 'UNSURE', reason: 'low_confidence', severity: 'warning', ruleStatus: 'unconfirmed', message_en: 'NID number unclear', message_bn: 'এনআইডি নম্বর অস্পষ্ট', fix_en: ['Retake.'], fix_bn: ['আবার তুলুন।'], fixService: null, source: null },
    { ruleId: 'RN-011', docs: ['nid', 'old_passport'], outcome: 'PASS', reason: 'match', severity: 'warning', ruleStatus: 'unconfirmed', message_en: 'x', message_bn: 'x', fix_en: ['x'], fix_bn: ['x'], fixService: null, source: null }], ...o });

type Handler = (path: string, init?: any) => Promise<any>;
const ok = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });
const routes = (o: { services?: object; chat?: any; check?: any } = {}): Handler => (path) =>
  path === '/api/services' ? ok(SERVICES(o.services)) : path === '/api/chat' ? (typeof o.chat === 'function' ? o.chat() : o.chat ?? ok(ANSWER())) : path === '/api/check' ? o.check ?? ok(RESULT()) : path === '/api/feedback' ? ok({ ok: true }) : ok({}, 404);

function boot(handler: Handler = routes(), speech?: any) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w: any = dom.window; w.fetch = vi.fn((p: string, i: any) => handler(p, i)); w.URL.createObjectURL = () => 'blob:test'; w.URL.revokeObjectURL = vi.fn();
  if (speech) w.webkitSpeechRecognition = speech; w.eval(js); for (const l of laneJs) w.eval(l);
  return { w, d: w.document as Document, S: w.__kr.state, calls: (p: string) => w.fetch.mock.calls.filter((c: any[]) => c[0] === p).map((c: any[]) => (c[1]?.body ? JSON.parse(c[1].body) : null)) };
}
type App = ReturnType<typeof boot>;
const tick = (n = 25) => new Promise((r) => setTimeout(r, n));
const click = (a: App, e: Element | null) => e!.dispatchEvent(new a.w.MouseEvent('click', { bubbles: true }));
const byText = (a: App, sel: string, text: string) => [...a.d.querySelectorAll(sel)].find((e) => e.textContent!.includes(text)) as HTMLElement | undefined;
const type = (a: App, text: string) => { const i = a.d.getElementById('input') as HTMLTextAreaElement; i.value = text; i.dispatchEvent(new a.w.Event('input', { bubbles: true })); return i; };
const key = (a: App, el: Element, k: string, init: object = {}) => { const e = new a.w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }); el.dispatchEvent(e); return e; };
async function accepted(handler?: Handler, speech?: any) { const a = boot(handler, speech); click(a, a.d.getElementById('accept')); await tick(); return a; }
async function ask(a: App, q: string) { const i = type(a, q); key(a, i, 'Enter'); await tick(); await tick(); }
function addPhoto(a: App, docId: string, file?: any) {
  const input = a.d.querySelector(`input[data-doc="${docId}"]`) as HTMLInputElement;
  const f = file ?? new a.w.File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], 'p.jpg', { type: 'image/jpeg' });
  Object.defineProperty(input, 'files', { value: [f], configurable: true }); input.dispatchEvent(new a.w.Event('change', { bubbles: true }));
}

describe('consent', () => {
  it('opens a modal dialog first, in Bangla, with the composer off and no network calls', () => {
    const a = boot(); const dlg = a.d.querySelector('[role=dialog]')!;
    expect(dlg.getAttribute('aria-modal')).toBe('true'); expect(a.d.documentElement.lang).toBe('bn'); expect(dlg.textContent).toContain('সরকারি অনুমোদন নয়'); expect(dlg.textContent).toContain('কণ্ঠে লিখলে');
    expect((a.d.getElementById('input') as HTMLTextAreaElement).disabled).toBe(true); expect((a.d.getElementById('attachBtn') as HTMLButtonElement).disabled).toBe(true);
    expect(a.w.fetch).not.toHaveBeenCalled(); expect(a.d.activeElement!.id).toBe('accept');
  });
  it('cannot be dismissed with Escape the first time, and keeps keyboard focus inside', () => {
    const a = boot(); key(a, a.d.body, 'Escape'); expect(a.d.querySelector('[role=dialog]')).not.toBeNull();
    const t = key(a, a.d.getElementById('accept')!, 'Tab'); expect(t.defaultPrevented).toBe(true);        // one button: Tab wraps to itself
  });
  it('after accepting, enables the composer, loads the services and shows the greeting with four suggestions', async () => {
    const a = await accepted();
    expect(a.d.querySelector('[role=dialog]')).toBeNull(); expect((a.d.getElementById('input') as HTMLTextAreaElement).disabled).toBe(false); expect(a.w.fetch).toHaveBeenCalledWith('/api/services', undefined);
    expect(a.d.querySelector('.empty h2')!.textContent).toBe('আজ কোন সরকারি সেবায় সাহায্য করতে পারি?'); expect(a.d.querySelectorAll('.chip').length).toBe(4);
    expect(a.d.activeElement!.id).toBe('input');
  });
  it('the privacy button re-opens it with a Close button, and Escape closes it and returns focus', async () => {
    const a = await accepted(); const info = a.d.getElementById('infoBtn')!; (info as HTMLElement).focus(); click(a, info);
    expect(a.d.getElementById('accept')!.textContent).toBe('বন্ধ করুন'); key(a, a.d.body, 'Escape'); expect(a.d.querySelector('[role=dialog]')).toBeNull(); expect(a.d.activeElement).toBe(info);
  });
});

describe('language', () => {
  it('switches the whole interface between Bangla and English, and the pressed state follows', async () => {
    const a = await accepted(); click(a, a.d.getElementById('lang-en'));
    expect(a.d.querySelector('.empty h2')!.textContent).toBe('How can I help with a government service today?'); expect(a.d.documentElement.lang).toBe('en');
    expect(a.d.getElementById('lang-en')!.getAttribute('aria-pressed')).toBe('true'); expect((a.d.getElementById('input') as HTMLTextAreaElement).placeholder).toMatch(/Ask about/);
    expect(a.d.getElementById('sendBtn')!.getAttribute('aria-label')).toBe('Send'); click(a, a.d.getElementById('lang-bn')); expect(a.d.getElementById('sendBtn')!.getAttribute('aria-label')).toBe('পাঠান');
  });
});

describe('asking a question', () => {
  it('sends on Enter, not on Shift+Enter or while composing, and clears the box', async () => {
    const a = await accepted(); const i = type(a, 'What do I need to renew my passport?');
    key(a, i, 'Enter', { shiftKey: true }); key(a, i, 'Enter', { isComposing: true }); await tick(); expect(a.calls('/api/chat').length).toBe(0);
    key(a, i, 'Enter'); await tick(); await tick();
    expect(a.calls('/api/chat')).toEqual([{ message: 'What do I need to renew my passport?', lang: 'bn' }]); expect(i.value).toBe(''); expect(a.d.querySelector('.msg.user .bubble')!.textContent).toBe('What do I need to renew my passport?');
  });
  it('shows a suggestion as a question when tapped', async () => {
    const a = await accepted(); click(a, a.d.querySelector('.chip')); await tick(); await tick(); expect(a.calls('/api/chat')[0].message).toMatch(/পাসপোর্ট নবায়ন/);
  });
  it('shows a typing indicator while waiting, then the answer', async () => {
    let release: (v: any) => void = () => {}; const a = await accepted(routes({ chat: () => new Promise((r) => { release = r; }) }));
    await ask(a, 'passport'); expect(a.d.querySelector('.typing')).not.toBeNull(); expect((a.d.getElementById('sendBtn') as HTMLButtonElement).disabled).toBe(true);
    release(await ok(ANSWER())); await tick(); expect(a.d.querySelector('.typing')).toBeNull(); expect(a.d.querySelector('.msg.bot .body p')).not.toBeNull();
  });
  it('renders citations as chips that open the matching source, with its status and a safe link', async () => {
    const a = await accepted(); await ask(a, 'renew');
    const cites = a.d.querySelectorAll('.cite'); expect(cites.length).toBe(2);
    const box = a.d.querySelector('details[id^=src-]') as HTMLDetailsElement; expect(box.open).toBe(false); click(a, cites[1]);
    expect(box.open).toBe(true); expect(a.d.querySelector('li.hl')!.textContent).toContain('Passage 2'); expect(a.d.activeElement!.tagName).toBe('LI');
    expect(a.d.body.textContent).toContain('সূত্র (২)'); expect(box.querySelector('.tag.unconfirmed')!.textContent).toBe('নিশ্চিত নয়');
    const link = box.querySelector('a') as HTMLAnchorElement; expect(link.href).toBe('https://example.org/1'); expect(link.rel).toContain('noopener');
  });
  it('explains how it answered, once per kind of step, in the chosen language', async () => {
    const a = await accepted(); await ask(a, 'renew'); const how = byText(a, 'details', 'কীভাবে উত্তর দিলাম')!;
    expect(how.querySelectorAll('li').length).toBe(4); expect(how.textContent).toContain('ব্যক্তিগত নম্বর লুকানো'); expect(how.textContent).toContain('মিলিয়ে দেখা হয়েছে');
    click(a, a.d.getElementById('lang-en')); expect(byText(a, 'details', 'How I answered')!.textContent).toContain('Checked every citation and number against the sources');
  });
  it('shows an abstention plainly, with no sources and no check button', async () => {
    const a = await accepted(routes({ chat: ok(ANSWER({ mode: 'abstained', answer: 'I could not find that, so I will not guess.', passages: [], actions: [], steps: ['retrieved:0', 'abstained'] })) }));
    await ask(a, 'weather'); expect(a.d.body.textContent).toContain('will not guess'); expect(a.d.querySelector('details[id^=src-]')).toBeNull(); expect(byText(a, '.btn', 'আমার কাগজ যাচাই করুন')).toBeUndefined();
    expect(a.d.body.textContent).toContain('কোনো সূত্রে এটি নেই');
  });
  it('treats every server string as plain text: no markup, scripts or javascript: links', async () => {
    const evil = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>';
    const a = await accepted(routes({ chat: ok(ANSWER({ answer: `${evil} [1]`, passages: [passage(1, { title: evil, snippet: evil, source: { label: evil, url: 'javascript:alert(1)', retrieved: evil } })] })) }));
    await ask(a, evil); expect(a.d.querySelector('img[onerror]')).toBeNull(); expect(a.d.querySelectorAll('script').length).toBe(0); expect(a.w.__pwned).toBeUndefined();
    expect(a.d.querySelector('a[href^="javascript"]')).toBeNull(); expect(a.d.querySelector('.msg.user .bubble')!.textContent).toBe(evil);
  });
  it('shows friendly messages when the service is busy, unavailable or unreachable', async () => {
    // lazy: a promise that is already rejected when the array is built would be reported as an unhandled rejection
    for (const [h, text] of [[() => ok({}, 429), 'অনেক বেশি অনুরোধ'], [() => ok({}, 503), 'পাওয়া যাচ্ছে না'], [() => Promise.reject(new Error('down')), 'যোগাযোগ করা যায়নি']] as const) {
      const a = await accepted(routes({ chat: h })); await ask(a, 'hello there'); expect(a.d.querySelector('[role=alert]')!.textContent).toContain(text); expect((a.d.getElementById('input') as HTMLTextAreaElement).disabled).toBe(false);
    }
  });
});

describe('document check inside the chat', () => {
  async function openForm() { const a = await accepted(); await ask(a, 'renew'); click(a, byText(a, '.btn', 'আমার কাগজ যাচাই করুন')!); return a; }
  it('opens a form for the right service, with a draft notice and Check disabled until a photo is added', async () => {
    const a = await openForm(); expect(a.d.querySelectorAll('input[type=file]').length).toBe(2); expect(a.d.querySelector('input[type=file]')!.getAttribute('capture')).toBe('environment');
    expect(a.d.querySelector('.card')!.textContent).toContain('খসড়া নির্দেশনা'); expect((a.d.getElementById('checkBtn') as HTMLButtonElement).disabled).toBe(true);
  });
  it('rejects a non-image with a clear message', async () => {
    const a = await openForm(); addPhoto(a, 'nid', new a.w.File(['hello'], 'n.txt', { type: 'text/plain' })); await tick(); await tick(); expect(a.d.querySelector('.card [role=alert]')!.textContent).toContain('এই ছবি ব্যবহার করা যাবে না');
  });
  it('sends only the added photos, then shows the verdict, what to fix and what was read, and wipes the photos from memory', async () => {
    const a = await openForm(); addPhoto(a, 'nid'); await tick(); await tick(); expect((a.d.getElementById('checkBtn') as HTMLButtonElement).disabled).toBe(false);
    click(a, a.d.getElementById('checkBtn')); await tick(); await tick();
    const body = a.calls('/api/check')[0]; expect(body.packId).toBe('bd-passport-adult-renewal'); expect(Object.keys(body.images)).toEqual(['nid']); expect(body.images.nid).toMatch(/^data:image\/jpeg;base64,/);
    expect(a.d.querySelector('.stamp')!.textContent).toBe('প্রস্তুত নয়'); expect(a.d.body.textContent).toContain('নথি সংশোধন করুন।'); expect(a.d.body.textContent).toContain('এনআইডি সংশোধন'); expect(a.d.body.textContent).toContain('১টি যাচাই ঠিক আছে');
    expect(a.d.querySelector('.readbox')!.textContent).toContain('নাম: Abdur Rahim'); expect(a.d.querySelector('.readbox')!.textContent).toContain('জন্ম তারিখ: স্পষ্ট নয়'); expect(a.d.querySelector('.readbox')!.hasAttribute('open')).toBe(false);
    expect(a.S.form).toBeNull(); expect(a.d.querySelector('input[type=file]')).toBeNull(); expect(a.w.URL.revokeObjectURL).toHaveBeenCalled();
  });
  it('shows a retake tip for unreadable items and folds items caused by a missing document', async () => {
    const r: any = RESULT(); r.results = [{ ...RESULT().results[0], ruleId: 'RN-001', docs: ['old_passport'], reason: 'document_missing', fixService: null }, { ...RESULT().results[1], ruleId: 'RN-010', docs: ['nid', 'old_passport'], reason: 'document_missing' }, { ...RESULT().results[1], ruleId: 'RN-012', docs: ['old_passport'], reason: 'unreadable' }];
    const a = await accepted(routes({ check: ok(r) })); await ask(a, 'renew'); click(a, byText(a, '.btn', 'আমার কাগজ যাচাই করুন')!); addPhoto(a, 'nid'); await tick(); await tick(); click(a, a.d.getElementById('checkBtn')); await tick(); await tick();
    expect(a.d.querySelectorAll('.item').length).toBe(2); expect(a.d.body.textContent).toContain('সমতলে ছবি তুলুন।');
  });
  it('turns a "check my documents" request into the form without any extra click', async () => {
    const a = await accepted(routes({ chat: ok(ANSWER({ mode: 'action', answer: 'Sure. Add your documents.', passages: [], steps: ['intent:check_documents'] })) }));
    click(a, byText(a, '.chip', 'আমার কাগজ যাচাই করুন')!); await tick(); await tick(); expect(a.d.querySelectorAll('input[type=file]').length).toBe(2);
  });
  it('the attach button asks which service when there are several, then opens its form', async () => {
    const a = await accepted(); click(a, a.d.getElementById('attachBtn')); expect(a.d.body.textContent).toContain('কোন সেবার জন্য'); click(a, byText(a, '.btn', 'পাসপোর্ট নবায়ন')!); expect(a.d.querySelectorAll('input[type=file]').length).toBe(2);
  });
  it('Cancel wipes the photos, and a failed check keeps the form so nothing has to be re-added', async () => {
    const a = await accepted(routes({ check: ok({}, 429) })); click(a, a.d.getElementById('attachBtn')); click(a, byText(a, '.btn', 'পাসপোর্ট নবায়ন')!); addPhoto(a, 'nid'); await tick(); await tick();
    click(a, a.d.getElementById('checkBtn')); await tick(); await tick(); expect(a.d.querySelector('.card [role=alert]')!.textContent).toContain('অনেক বেশি'); expect(Object.keys(a.S.form.files)).toEqual(['nid']);
    click(a, a.d.getElementById('cancelBtn')); expect(a.S.form).toBeNull(); expect(a.d.querySelector('.card')).toBeNull();
  });
});

describe('feedback and new chat', () => {
  it('sends only a fixed signal, once, and then says thanks', async () => {
    const a = await accepted(); await ask(a, 'renew'); click(a, a.d.querySelector('[data-fb=up]')); await tick();
    expect(a.calls('/api/feedback')).toEqual([{ kind: 'answer', helpful: true, topic: 'bd-passport-adult-renewal' }]); expect(a.d.querySelector('[data-fb]')).toBeNull(); expect(a.d.body.textContent).toContain('মতামতের জন্য ধন্যবাদ');
  });
  it('New chat clears everything, including any photos', async () => {
    const a = await accepted(); await ask(a, 'renew'); click(a, a.d.getElementById('attachBtn')); click(a, byText(a, '.btn', 'পাসপোর্ট নবায়ন')!); addPhoto(a, 'nid'); await tick(); await tick();
    click(a, a.d.getElementById('newBtn')); expect(a.S.msgs).toEqual([]); expect(a.S.form).toBeNull(); expect(a.d.querySelector('.empty')).not.toBeNull(); expect(a.d.querySelector('input[type=file]')).toBeNull(); expect(a.d.getElementById('announce')!.textContent).toContain('কিছু রাখা হয়নি');
  });
});

describe('voice typing', () => {
  function fakeSpeech() { const inst: any = {}; const Ctor: any = function (this: any) { Object.assign(inst, this); this.start = () => { inst.started = true; inst.self = this; }; this.stop = () => this.onend?.(); }; return { Ctor, inst }; }
  it('is hidden when the browser has no speech recognition', async () => { const a = await accepted(); expect((a.d.getElementById('micBtn') as HTMLElement).hidden).toBe(true); });
  it('listens in the chosen language, fills the box, and stops cleanly', async () => {
    const { Ctor, inst } = fakeSpeech(); const a = await accepted(undefined, Ctor); const mic = a.d.getElementById('micBtn')!;
    expect((mic as HTMLElement).hidden).toBe(false); click(a, mic); expect(inst.started).toBe(true); expect(inst.self.lang).toBe('bn-BD'); expect(mic.getAttribute('aria-pressed')).toBe('true');
    inst.self.onresult({ results: [[{ transcript: 'পাসপোর্ট ' }], [{ transcript: 'নবায়ন' }]] }); expect((a.d.getElementById('input') as HTMLTextAreaElement).value).toBe('পাসপোর্ট নবায়ন'); expect((a.d.getElementById('sendBtn') as HTMLButtonElement).disabled).toBe(false);
    inst.self.onend(); expect(mic.getAttribute('aria-pressed')).toBe('false');
    click(a, a.d.getElementById('lang-en')); click(a, mic); expect(inst.self.lang).toBe('en-US');
  });
  it('reports an error instead of failing silently', async () => {
    const { Ctor, inst } = fakeSpeech(); const a = await accepted(undefined, Ctor); click(a, a.d.getElementById('micBtn')); inst.self.onerror({}); expect(a.d.querySelector('[role=alert]')!.textContent).toContain('কণ্ঠে লেখা এখন পাওয়া যাচ্ছে না');
  });
});

describe('banners', () => {
  it('warns on a free AI tier and in demo mode, in both languages, and says nothing when paid', async () => {
    const a = await accepted(routes({ services: { llm: { provider: 'gemini', tier: 'free' }, demo: true } })); expect(a.d.getElementById('banners')!.textContent).toContain('শুধু নমুনা কাগজ ব্যবহার করুন'); expect(a.d.getElementById('banners')!.textContent).toContain('ডেমো মোড');
    click(a, a.d.getElementById('lang-en')); expect(a.d.getElementById('banners')!.textContent).toContain('Use sample documents only, not real ID papers');
    for (const llm of [{ provider: 'gemini', tier: 'paid' }, { provider: 'local', tier: 'n/a' }, null]) expect((await accepted(routes({ services: { llm } }))).d.getElementById('banners')!.textContent).toBe('');
  });
});

describe('quality gates', () => {
  it('every shipped script and page parses, and every script tag points at a real file', () => {
    for (const h of ['index', 'insights', 'agency']) for (const m of readFileSync(`public/${h}.html`, 'utf8').matchAll(/<script src="([^"]+)"/g)) expect(existsSync(`public${m[1]}`), m[1]).toBe(true);
  });
  it('uses no browser storage and no cookies', async () => { const a = await accepted(); await ask(a, 'renew'); expect(js).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/); expect(a.w.localStorage.length).toBe(0); });
  it('has no inline handlers, inline styles, eval or HTML injection in any shipped page', () => {
    for (const f of ['public/index.html', 'public/insights.html', 'public/agency.html']) expect(readFileSync(f, 'utf8'), f).not.toMatch(/\son\w+=|style=|javascript:/i);
    for (const f of ['public/app.js', 'public/insights.js', 'public/agency.js', 'public/lanes/coach.js', 'public/lanes/plain.js', 'public/lanes/report.js', 'public/lib/validate.mjs']) expect(readFileSync(f, 'utf8'), f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|setAttribute\('style'/);
    // the only script-set style is the auto-growing text box height, which the content-security policy allows (it blocks style attributes, not CSSOM)
    expect(js.replaceAll('input.style.height', '')).not.toMatch(/\.style\./);
    for (const f of ['public/lanes/coach.js', 'public/lanes/plain.js', 'public/lanes/report.js', 'public/agency.js']) expect(readFileSync(f, 'utf8'), f).not.toMatch(/\.style\.|localStorage|sessionStorage|indexedDB|document\.cookie/);
  });
});

describe('insights page', () => {
  const page = readFileSync('public/insights.html', 'utf8').replace(/<script src="\/insights.js"><\/script>/, ''), code = readFileSync('public/insights.js', 'utf8');
  const SNAP = { since: '2026-10-22T00:00:00Z', demo: true, minCount: 5, totals: { questions: 240, checks: 90, feedback: 150 }, answerRate: 0.83, groundedByAiRate: 0.5, satisfaction: 0.86, questionsWithPersonalNumbersRemoved: 12,
    topics: [{ label: 'bd-passport-adult-renewal', count: 120 }, { label: '<img src=x onerror="window.__pwned=1">', count: 40 }], languages: [{ label: 'bn', count: 150 }], answerModes: [{ label: 'grounded', count: 170 }], verdicts: [{ label: 'NOT_READY', count: 40 }], topFailedRules: [{ label: 'RN-010', count: 30 }], latencyMs: { chatP50: 900, chatP95: 2400, checkP50: 6000, checkP95: 12000 } };
  async function load(status: number) {
    const dom = new JSDOM(page, { runScripts: 'outside-only', url: 'http://localhost/insights.html' }); const w: any = dom.window;
    w.fetch = vi.fn(async () => ({ ok: status === 200, status, json: async () => SNAP })); w.eval(code);
    (w.document.getElementById('token') as HTMLInputElement).value = 'tok'; w.document.getElementById('auth').dispatchEvent(new w.Event('submit', { cancelable: true })); await tick(); return w;
  }
  it('shows the key numbers, flags synthetic data, and is safe against hostile labels', async () => {
    const w = await load(200); const t = w.document.body.textContent;
    expect(t).toContain('240'); expect(t).toContain('83%'); expect(t).toContain('86%'); expect(t).toContain('Synthetic demo numbers'); expect(w.document.querySelector('img[onerror]')).toBeNull(); expect(w.__pwned).toBeUndefined();
    expect(w.fetch).toHaveBeenCalledWith('/api/insights', { headers: { authorization: 'Bearer tok' } });
  });
  it('never prints stray words such as "false" or "undefined" when the data is not demo data', async () => {
    SNAP.demo = false; const w = await load(200); SNAP.demo = true;
    expect(w.document.getElementById('out').textContent).not.toMatch(/\b(false|true|undefined|null)\b/); expect(w.document.body.textContent).not.toContain('Synthetic demo numbers');
  });
  it('explains a wrong token, a switched-off dashboard, and rate limiting', async () => {
    for (const [s, text] of [[401, 'not valid'], [404, 'not switched on'], [429, 'Too many']] as const) { const w = await load(s); const m = w.document.getElementById('msg'); expect(m.hidden).toBe(false); expect(m.textContent).toContain(text); }
  });
});
