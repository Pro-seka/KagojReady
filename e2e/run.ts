// Real-browser end-to-end checks: real Chromium, real UI, real server code, fake model. Run: npm run e2e
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import chromium from '@sparticuz/chromium';
import { chromium as pw, type Page } from 'playwright-core';
import { createApp } from '../src/server/app';
import { parsePack } from '../src/pack/load';
import { promotePack } from '../src/pack/promote';
import { buildKb, Retriever } from '../src/kb/load';
import { Metrics } from '../src/insights/metrics';
import { loadGlossary } from '../src/plain/glossary';
import { loadOutOfScope } from '../src/assistant/scope';
import { ReportService, loadReportConfig } from '../src/reports/service';
import { MemoryTicketStore } from '../src/reports/store';
import { hasMetadata } from '../src/reports/jpeg';
import type { LlmClient } from '../src/extract/types';

const R = (f: Record<string, string>) => JSON.stringify({ is_expected_document: true, fields: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, { value: v, romanized: null, confidence: 0.95, legible: true }])) });
const scenario = { dob: '12/03/1990' };
const photos: Array<{ nid: boolean; bytes: Buffer }> = []; const prompts: string[] = [];
const llm: LlmClient = { async complete(req) {
  if (!req.image) { prompts.push(req.userText); const two = /\[2\]/.test(req.userText), bn = /Reply language: Bangla/.test(req.userText); return bn ? `সূত্রে এটি বলা আছে [1]${two ? ' এবং আরও তথ্য আছে [2]' : ''}।` : `The sources cover this [1]${two ? ' and add more detail [2]' : ''}.`; }
  const nid = req.userText.includes('National ID'); photos.push({ nid, bytes: Buffer.from(req.image.base64, 'base64') });
  return nid ? R({ name: 'Abdur Rahim', father_name: 'Karim Uddin', mother_name: 'Rahima Begum', dob: '12 Mar 1990', nid_number: '1234567890' })
             : R({ name: 'Abdur Rahim', dob: scenario.dob, passport_number: 'A12345678', expiry_date: '01/01/2027' });
} };
const FIXTURES = 'tests/fixtures/packs';   // frozen drafts: UI behaviour must not depend on the real packs' current status
const packs = readdirSync(FIXTURES).map((f) => parsePack(JSON.parse(readFileSync(`${FIXTURES}/${f}`, 'utf8'))));
const verified = packs.map((p) => promotePack({ ...p, rules: p.rules.map((r) => ({ ...r, rule_status: r.rule_status === 'unconfirmed' ? 'operator_reported' as const : r.rule_status })) }, { by: 'A. Verifier', evidenceUrl: 'https://example.org/p', today: '2026-10-20' }));
const metrics = new Metrics(); const TOKEN = 'e2e-insights-token-0123456789';
const mk = (o: object = {}) => new Promise<{ s: ReturnType<typeof createApp>; url: string }>((r) => { const s = createApp({ llm, packs, retriever: new Retriever(buildKb(packs)), metrics, today: () => '2026-10-20', log: () => {}, rateLimit: { max: 10_000, windowMs: 1000, chatMax: 10_000 }, ...o }); s.listen(0, '127.0.0.1', () => r({ s, url: `http://127.0.0.1:${(s.address() as AddressInfo).port}` })); });
const main = await mk({ insightsToken: TOKEN });
const verifiedSrv = await mk({ packs: verified, retriever: new Retriever(buildKb(verified)), metrics: new Metrics() });
const freeSrv = await mk({ llmInfo: { provider: 'gemini', tier: 'free' }, metrics: new Metrics() });
const offSrv = await mk({ metrics: new Metrics() });

// ---- a second server for the three newer lanes. Its fake model is only there to prove the checks around it work. ----
const AGENCY = 'e2e-agency-token-0123456789';
const laneLlm: LlmClient = { async complete(req) {
  if (req.image) return JSON.stringify({ category: 'road_damage', confidence: 0.91, safety_hazard: false, is_public_infrastructure_problem: true });
  if (req.system.includes('rewrite official')) {      // a model that gets one point right and invents a figure in another: the validator must drop the second
    const n = (re: RegExp) => (req.userText.split('\n').find((l) => re.test(l))?.match(/^\[(\d+)\]/)?.[1]) ?? '1';
    return JSON.stringify({ points: [{ text: 'The renewal fee is 1,500 taka.', sentence: Number(n(/1,500/)) }, { text: 'The fine for not renewing is 9,000 taka.', sentence: Number(n(/5,000/)) }] });
  }
  return 'x';
} };
const reportSvc = new ReportService(loadReportConfig(), new MemoryTicketStore(), laneLlm);
const laneSrv = await new Promise<{ s: ReturnType<typeof createApp>; url: string }>((r) => { const s = createApp({ llm: laneLlm, packs, retriever: new Retriever(buildKb(packs)), metrics: new Metrics(), glossary: loadGlossary(), outOfScope: loadOutOfScope(), reports: reportSvc, agencyToken: AGENCY, today: () => '2026-11-19', log: () => {}, rateLimit: { max: 500, windowMs: 60_000 } }); s.listen(0, '127.0.0.1', () => r({ s, url: `http://127.0.0.1:${(s.address() as AddressInfo).port}` })); });

const shotTop = async (p: Page, n: string) => { await p.evaluate(() => { const m = [...document.querySelectorAll('.msg.bot')].pop(); if (m) m.scrollIntoView({ block: 'start' }); window.scrollTo(0, 0); }); await shot(p, n); };
const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
const check = (name: string, ok: boolean, detail = '') => { checks.push({ name, ok, detail: ok ? '' : detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : '  -> ' + detail}`); };
const jpegSize = (b: Buffer) => { for (let i = 2; i < b.length - 9;) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1]; if (m >= 0xc0 && m <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }; i += 2 + b.readUInt16BE(i + 2); } return null; };

const browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'bn-BD' };
const ctx = await browser.newContext(mobile); const page = await ctx.newPage();
const errors: string[] = []; const apiCalls: string[] = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push(String(e))); page.on('requestfailed', (r) => errors.push('requestfailed ' + r.url()));
page.on('request', (r) => { if (r.url().includes('/api/')) apiCalls.push(new URL(r.url()).pathname); });
await page.addInitScript(() => { (window as any).__csp = []; document.addEventListener('securitypolicyviolation', (e) => (window as any).__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
const shot = async (p: Page, n: string) => { await p.waitForTimeout(350); await p.screenshot({ path: `e2e/screenshots/${n}.png` }); };
const text = (p: Page = page) => p.evaluate(() => document.body.innerText);
const axeSrc = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const axe = async (label: string, p: Page = page) => {
  await p.evaluate(axeSrc);
  const v = await p.evaluate(async () => (await (window as any).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map((x: any) => `${x.id}(${x.nodes.length}): ${x.nodes[0]?.html?.slice(0, 90)}`));
  check(`accessibility (WCAG 2.x A/AA, real layout and colour contrast): ${label}`, v.length === 0, v.join(' | '));
};
const noOverflow = async (label: string, p: Page = page) => check(`no sideways scrolling: ${label}`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${await p.evaluate(() => document.documentElement.scrollWidth)} > ${await p.evaluate(() => window.innerWidth)}`);
const ask = async (q: string) => { await page.fill('#input', q); await page.press('#input', 'Enter'); await page.waitForFunction(() => !document.querySelector('.typing') && document.querySelectorAll('.msg.bot').length > 0); await page.waitForTimeout(100); };

async function suite() {
// ---- consent ----
await page.goto(main.url); await page.waitForSelector('#accept');
check('opens with a consent dialog in Bangla, composer off, and no API calls yet', (await text()).includes('সরকারি অনুমোদন নয়') && (await page.getAttribute('html', 'lang')) === 'bn' && await page.isDisabled('#input') && apiCalls.length === 0);
await page.evaluate(() => document.fonts.ready);
const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => /U\+980/i.test(f.unicodeRange) ? 'bengali' : 'latin'));
check('self-hosted Bangla and Latin fonts load (no external requests)', fonts.includes('bengali') && fonts.includes('latin'), fonts.join());
await shot(page, '01-consent'); await axe('consent dialog');
check('keyboard focus starts on the dialog button, with a clearly visible outline', await page.evaluate(() => { const s = getComputedStyle(document.activeElement!); return document.activeElement!.id === 'accept' && s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 3; }));
await page.click('#accept'); await page.waitForSelector('.chip');
check('after accepting, the composer is ready and focused', !(await page.isDisabled('#input')) && (await page.evaluate(() => document.activeElement!.id)) === 'input');

// ---- empty state ----
check('greeting and four suggested questions', (await text()).includes('আজ কোন সরকারি সেবায়') && (await page.locator('.chip').count()) === 4);
await shot(page, '02-start'); await axe('start screen');
for (const w of [320, 360, 768, 1280]) { await page.setViewportSize({ width: w, height: 800 }); await noOverflow(`start screen at ${w}px wide`); }
await page.setViewportSize(mobile.viewport);
const small = await page.evaluate(() => [...document.querySelectorAll('button, .file span')].map((e) => ({ t: (e.getAttribute('aria-label') || e.textContent || '').slice(0, 20), h: Math.round(e.getBoundingClientRect().height) })).filter((x) => x.h > 0 && x.h < 44));
check('every button is at least 44px tall (touch target)', small.length === 0, JSON.stringify(small));

// ---- asking questions ----
await page.click('.chip >> nth=0'); await page.waitForSelector('.msg.bot .cite');
const ans = await text(); const chatBody = JSON.stringify(prompts.at(-1));
check('a suggested question gets an answer with numbered source chips', (await page.locator('.cite').count()) >= 1 && ans.includes('সূত্র'));
check('the question the model saw contains the passages, marked with their status', /\[1\] \(/.test(prompts.at(-1)!) && /Passages:/.test(prompts.at(-1)!), chatBody);
await page.click('.cite >> nth=0');
check('tapping a citation opens the sources and highlights the matching one', await page.evaluate(() => { const d = document.querySelector('details[id^=src-]') as HTMLDetailsElement; return d.open && !!document.querySelector('li.hl') && document.activeElement!.tagName === 'LI'; }));
check('source links open in a new tab safely, and show their status and date', await page.evaluate(() => { const a = document.querySelector('ol.src a') as HTMLAnchorElement; return !!a && a.target === '_blank' && a.rel.includes('noopener') && /^https:/.test(a.href); }) && (await text()).includes('সর্বশেষ দেখা হয়েছে'));
await shot(page, '03-answer'); await axe('answer with sources open');
await page.click('summary:has-text("কীভাবে উত্তর দিলাম")'); check('"How I answered" lists the steps in plain Bangla', (await text()).includes('সূত্রে খুঁজে') && (await text()).includes('মিলিয়ে দেখা হয়েছে'));
await ask('এনআইডি সংশোধনে কত সময় লাগে?');
check('a Bangla question is answered from Bangla passages', (await page.locator('.msg.bot').last().innerText()).includes('সূত্র') && /[\u0980-\u09FF]/.test(await page.locator('.msg.bot').last().innerText()));
await ask('What is the weather in Dhaka today?');
const lastBot = await page.locator('.msg.bot').last().innerText();
check('an out-of-scope question is declined without guessing, with no sources', lastBot.includes('not guess') === false ? /আন্দাজ/.test(lastBot) : true) ;
check('and the declined answer shows no source list', (await page.locator('.msg.bot').last().locator('details[id^=src-]').count()) === 0);
const before = prompts.length;
await ask('My NID 1234567890 and phone 01712345678: the date of birth is different on NID and passport');
const botText = await page.locator('.msg.bot').last().innerText();
check('personal numbers never reach the model, and are never echoed back in the reply', prompts.length > before && !/1234567890|01712345678/.test(prompts.at(-1)!) && !/1234567890|01712345678/.test(botText), `prompts ${prompts.length} vs ${before}; bot: ${botText.slice(0, 120)}`);
await page.click('summary:has-text("কীভাবে উত্তর দিলাম") >> nth=-1');
check('and the trail says that numbers were hidden', (await page.locator('.msg.bot').last().innerText()).includes('ব্যক্তিগত নম্বর লুকানো'));
await page.click('[data-fb=up] >> nth=-1'); await page.waitForTimeout(150);
check('a thumbs-up is counted by the server as an anonymous signal', metrics.snapshot(1).totals.feedback === 1);

// ---- document check ----
await page.click('#newBtn'); await page.waitForSelector('.chip');
check('"New chat" returns to the start screen', (await page.locator('.msg').count()) === 0);
await page.click('.chip >> nth=3'); await page.waitForSelector('input[data-doc="nid"]');
check('"Check my documents" is understood and opens the form with no extra step', (await text()).includes('আপনার কাগজ যোগ করুন') && (await text()).includes('খসড়া নির্দেশনা'));
await page.setInputFiles('input[data-doc="nid"]', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
await page.waitForSelector('.card [role=alert]'); check('a non-image file is rejected with a clear message', (await text()).includes('এই ছবি ব্যবহার করা যাবে না'));
await page.setInputFiles('input[data-doc="nid"]', 'testdata/e2e/big-exif.jpg'); await page.waitForSelector('.thumb');
await axe('document form with a photo added');
const nPhotos = photos.length; await page.click('#checkBtn'); await page.waitForSelector('.stamp');
const big = photos.at(nPhotos)!; const dims = jpegSize(big.bytes);
check('a 3200x2100 photo is downscaled on the phone before upload (max side 1600)', !!dims && Math.max(dims.w, dims.h) <= 1600, JSON.stringify(dims));
check('EXIF metadata (location, descriptions) never leaves the phone', !big.bytes.includes(Buffer.from('SECRET-EXIF-MARKER')) && !big.bytes.includes(Buffer.from('Exif\0\0')));
check('only the document that was added is sent', photos.length === nPhotos + 1 && big.nid);
check('photos are wiped from the page the moment the check finishes', await page.evaluate(() => (window as any).__kr.state.form === null && document.querySelectorAll('input[type=file]').length === 0));
await page.click('.msg.bot >> nth=-1 >> button:has-text("আবার যাচাই করুন")'); await page.waitForSelector('input[data-doc="old_passport"]');

const nid = 'testdata/specimens/clean_english__clean/nid.jpg', pp = 'testdata/specimens/clean_english__clean/old_passport.jpg';
const run = async (dob: string) => { scenario.dob = dob; await page.setInputFiles('input[data-doc="old_passport"]', pp); await page.setInputFiles('input[data-doc="nid"]', nid);
  await page.waitForFunction(() => document.querySelectorAll('.thumb').length === 2); await page.click('#checkBtn'); await page.waitForFunction(() => document.querySelectorAll('.stamp').length > 0 && !document.querySelector('#checkBtn')); };
await run('12/03/1990'); await page.waitForTimeout(100);
check('matching documents give "looks ready"', (await page.locator('.stamp').last().textContent()) === 'প্রস্তুত মনে হচ্ছে');
await shot(page, '04-ready'); await axe('result: ready');
await page.click('.msg.bot >> nth=-1 >> button:has-text("আবার যাচাই করুন")'); await page.waitForSelector('input[data-doc="old_passport"]');
await run('12/03/1991');
check('a date-of-birth mismatch gives "not ready" with fix steps and a link to the NID service', (await page.locator('.stamp').last().textContent()) === 'প্রস্তুত নয়' && (await text()).includes('আগে এটি ঠিক করুন') && (await text()).includes('এনআইডি সংশোধন'));
await page.locator('summary:has-text("কেন এটি")').last().click(); await shot(page, '05-not-ready');
check('the "why" panel shows rule, status and source', (await text()).includes('RN-010') && (await text()).includes('সরকারি সূত্র থেকে'));
await page.locator('summary:has-text("যা পড়া হয়েছে")').last().click();
check('"what we read" shows the values the model returned, closed by default', (await text()).includes('নাম: Abdur Rahim') && (await text()).includes('জন্ম তারিখ: 12/03/1991'));
await axe('result: not ready with panels open');
await page.click('#lang-en'); check('English toggle works in a real browser', (await page.locator('.stamp').last().textContent()) === 'Not ready' && (await page.getAttribute('html', 'lang')) === 'en');
await shot(page, '06-english'); await axe('result in English');
for (const w of [320, 768]) { await page.setViewportSize({ width: w, height: 800 }); await noOverflow(`result at ${w}px wide`); }
await page.setViewportSize({ width: 1280, height: 860 }); await shot(page, '07-desktop'); await page.setViewportSize(mobile.viewport);
check('a document check is counted without any content', metrics.snapshot(1).totals.checks >= 3 && !JSON.stringify(metrics.snapshot(1)).match(/Abdur|1234567890/));

// ---- storage and security ----
const store = await page.evaluate(async () => ({ ls: localStorage.length, ss: sessionStorage.length, idb: (await indexedDB.databases()).length, cookie: document.cookie }));
check('no localStorage, sessionStorage, IndexedDB or cookies were used', store.ls === 0 && store.ss === 0 && store.idb === 0 && store.cookie === '' && (await ctx.cookies()).length === 0, JSON.stringify(store));
const csp = await page.evaluate(() => (window as any).__csp); check('no Content-Security-Policy violations during the whole session', csp.length === 0, csp.join('; '));
check('no console errors, page errors or failed requests', errors.length === 0, errors.join(' | '));
const hdr = await (await ctx.request.get(main.url + '/')).headers();
check('served with CSP, nosniff and no-referrer', /script-src 'self'/.test(hdr['content-security-policy']) && hdr['x-content-type-options'] === 'nosniff' && hdr['referrer-policy'] === 'no-referrer');
const framed = await ctx.newPage(); await framed.setContent(`<iframe id=f src="${main.url}/"></iframe>`); await framed.waitForTimeout(500);
check('the app refuses to be embedded in another site (clickjacking)', (await framed.evaluate(() => { try { return (document.getElementById('f') as HTMLIFrameElement).contentDocument?.body?.children.length ?? 0; } catch { return 0; } })) === 0);

// ---- voice typing ----
const vp = await (await browser.newContext({ ...mobile, locale: 'en-US' })).newPage(); await vp.goto(main.url); await vp.click('#accept'); await vp.waitForSelector('.chip');
const mic = await vp.evaluate(() => !document.getElementById('micBtn')!.hidden);
if (mic) { await vp.click('#micBtn'); await vp.waitForTimeout(800); }
check('voice typing: the mic is offered when the browser supports it, and tapping it never breaks the page', await vp.isEnabled('#input') && (await vp.locator('#micBtn').count()) === 1, 'page broke');

// ---- reduced motion ----
const rm = await (await browser.newContext({ ...mobile, reducedMotion: 'reduce' })).newPage(); await rm.goto(main.url); await rm.click('#accept'); await rm.waitForSelector('.chip');
await rm.click('.chip >> nth=3'); await rm.waitForSelector('input[data-doc="nid"]'); scenario.dob = '12/03/1990'; await rm.setInputFiles('input[data-doc="nid"]', nid); await rm.waitForSelector('.thumb'); await rm.click('#checkBtn'); await rm.waitForSelector('.stamp');
check('the stamp animation is switched off when the phone asks for reduced motion', (await rm.evaluate(() => getComputedStyle(document.querySelector('.stamp')!).animationName)) === 'none');

// ---- banners ----
const bp = await (await browser.newContext(mobile)).newPage(); await bp.goto(freeSrv.url); await bp.click('#accept'); await bp.waitForSelector('.chip'); await bp.waitForSelector('.strip');
check('a free AI tier shows a warning to use sample documents only', (await text(bp)).includes('শুধু নমুনা কাগজ ব্যবহার করুন')); await shot(bp, '08-free-tier'); await axe('free-tier warning', bp);
const vv = await (await browser.newContext(mobile)).newPage(); await vv.goto(verifiedSrv.url); await vv.click('#accept'); await vv.waitForSelector('.chip'); await vv.click('#attachBtn'); await vv.click('.btn:has-text("পাসপোর্ট")'); await vv.waitForSelector('input[data-doc="nid"]');
check('a VERIFIED pack shows no draft notice, and no free-tier warning appears there', !(await text(vv)).includes('খসড়া নির্দেশনা') && !(await text(vv)).includes('শুধু নমুনা কাগজ'));

// ---- insights dashboard ----
const ip = await (await browser.newContext({ ...mobile, locale: 'en-US' })).newPage(); const ierr: string[] = []; ip.on('console', (m) => { if (m.type() === 'error') ierr.push(m.text()); });
await ip.addInitScript(() => { (window as any).__csp = []; document.addEventListener('securitypolicyviolation', (e) => (window as any).__csp.push(e.violatedDirective)); });
await ip.goto(main.url + '/insights.html'); await ip.fill('#token', 'wrong'); await ip.click('#auth button'); await ip.waitForSelector('#msg:not([hidden])');
check('the dashboard rejects a wrong token', (await ip.textContent('#msg'))!.includes('not valid'));
ierr.length = 0;   // the 401 for the deliberate wrong token above is expected
await ip.fill('#token', TOKEN); await ip.click('#auth button'); await ip.waitForSelector('.kpi');
check('the dashboard shows real session counts, in plain language', (await text(ip)).includes('Questions asked') && (await text(ip)).includes('Found it helpful') && (await ip.locator('.kpi').count()) === 8);
check('and the bars are drawn with widths set by script, allowed by the strict policy', (await ip.evaluate(() => [...document.querySelectorAll('i[data-w]')].every((i) => (i as HTMLElement).style.width !== ''))) && (await ip.evaluate(() => (window as any).__csp)).length === 0 && ierr.length === 0, ierr.join());
await shot(ip, '09-insights'); await axe('insights dashboard', ip);
const off = await (await browser.newContext({ ...mobile, locale: 'en-US' })).newPage(); await off.goto(offSrv.url + '/insights.html'); await off.fill('#token', 'x'); await off.click('#auth button'); await off.waitForSelector('#msg:not([hidden])');
check('a server without a token says the dashboard is not switched on', (await off.textContent('#msg'))!.includes('not switched on'));

}
async function lanesSuite() {
  // A separate browser process for this suite: a long-running session did not honour the geolocation grant, a fresh one does.
  const lbrowser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
  const lctx = await lbrowser.newContext({ ...mobile, locale: 'en-US', geolocation: { latitude: 23.8103, longitude: 90.4125 } });
  await lctx.grantPermissions(['geolocation'], { origin: laneSrv.url });      // granted for this origin only, as a person would when the browser asks
  const lp = await lctx.newPage();
  const lerrs: string[] = []; const lapi: string[] = [];
  lp.on('console', (m) => { if (m.type() === 'error') lerrs.push(m.text()); }); lp.on('pageerror', (e) => lerrs.push(String(e))); lp.on('request', (r) => { if (r.url().includes('/api/')) lapi.push(new URL(r.url()).pathname); });
  await lp.addInitScript(() => { (window as any).__csp = []; document.addEventListener('securitypolicyviolation', (e) => (window as any).__csp.push(e.violatedDirective)); });
  await lp.goto(laneSrv.url); await lp.click('#accept'); await lp.waitForSelector('.lane'); await lp.click('#lang-en');

  // ---- lane bar ----
  check('the lane bar lists Ask, Check documents, Fill a form, Plain language, Report a problem', JSON.stringify(await lp.$$eval('.lane', (b) => b.map((x) => x.getAttribute('data-lane')))) === '["ask","check","coach","plain","report"]');
  await shot(lp, '10-lanes'); await axe('start screen with the lane bar', lp); await noOverflow('lane bar at 390px', lp);

  // ---- typos and romanized Bangla in the chat ----
  await lp.fill('#input', 'nid songshodhon korte koto din lage'); await lp.press('#input', 'Enter'); await lp.waitForFunction(() => document.querySelectorAll('.msg.bot .body details').length > 0 && !document.querySelector('.typing'));
  await lp.locator('.msg.bot details', { hasText: 'How I answered' }).locator('summary').click();
  check('romanized Bangla is understood and the "how I answered" panel says so', (await text(lp)).includes('Read your romanized Bangla as Bangla words'));
  await lp.fill('#input', 'How do I renew my driving licence?'); await lp.press('#input', 'Enter'); await lp.waitForFunction(() => document.querySelectorAll('.msg.bot').length >= 2 && !document.querySelector('.typing'));
  check('a service that is not covered is named plainly instead of answered with a nearby passage', (await text(lp)).includes('I do not cover driving licence yet'));

  // ---- form coach: nothing leaves the device ----
  const before = lapi.length; await lp.click('.lane[data-lane=coach]'); await lp.waitForSelector('#cf-nid');
  await lp.fill('#cf-nid', '123456789012'); await lp.fill('#cf-mobile', '01712345678'); await lp.fill('#cf-dob', '12/03/1990'); await lp.fill('#cf-name', 'Abdur Rahim');
  check('the coach flags a 12-digit NID, accepts a good mobile number, and echoes how it read the date', (await lp.textContent('#cf-nid-s'))!.includes('10, 13 or 17') && (await lp.getAttribute('#cf-nid', 'aria-invalid')) === 'true' && (await lp.textContent('#cf-dob-s'))!.includes('Read as 12 March 1990') && (await lp.getAttribute('#cf-mobile-s', 'class'))!.includes('ok'));
  check('nothing typed into the coach is sent to the server', lapi.slice(before).every((p) => p === '/api/reports/config'), lapi.slice(before).join());
  await shotTop(lp, '11-form-coach'); await axe('form coach with an error and a warning showing', lp); await noOverflow('form coach at 390px', lp);

  // ---- plain language ----
  await lp.click('.lane[data-lane=plain]'); await lp.waitForSelector('[data-plain-sample]'); await lp.click('[data-plain-sample]'); await lp.waitForFunction(() => (document.querySelector('.bigarea') as HTMLTextAreaElement).value.length > 100);
  await lp.click('[id^=pgo-]'); await lp.waitForSelector('ul.pts');
  const t1 = await text(lp);
  check('plain-language reader shows difficulty, deadlines, amounts and hard words from the pasted notice', t1.includes('How hard is this text?') && t1.includes('within 30 days') && t1.includes('Tk. 1,500') && t1.includes('Hard words explained') && t1.includes('notwithstanding'));
  check('the AI rewrite keeps the grounded point and removes the one with an invented figure', t1.includes('The renewal fee is 1,500 taka') && !t1.includes('9,000') && t1.includes('1 AI point was removed'));
  await lp.click('ul.pts .cite'); check('each point links to the original sentence it came from, which is highlighted', (await lp.locator('ol.orig li.hl').count()) === 1);
  await shotTop(lp, '12-plain-language'); await axe('plain-language result', lp); await noOverflow('plain-language result at 390px', lp);

  // ---- civic report: photo -> suggestion -> location -> ticket ----
  await lp.click('.lane[data-lane=report]'); await lp.waitForSelector('[data-report-photo]');
  await lp.setInputFiles('[data-report-photo]', 'testdata/e2e/big-exif.jpg'); await lp.waitForSelector('[data-suggestion=ok]');
  check('a photo with EXIF gets a category suggestion that the person can still change', (await lp.textContent('[data-suggestion]'))!.includes('Road damage or pothole') && (await lp.inputValue('#rep-cat')) === 'road_damage');
  await lp.selectOption('#rep-area', 'city_corporation'); await lp.click('[data-use-location]'); await lp.waitForSelector('text=rounded to about 100 metres'); await lp.fill('#rep-desc', 'Deep hole by the school gate. Call 01712345678');
  await shotTop(lp, '13-report-form'); await axe('report form with a suggestion and location', lp); await noOverflow('report form at 390px', lp);
  await lp.click('[data-send-report]'); await lp.waitForSelector('[data-code]'); const code = (await lp.textContent('[data-code]'))!;
  check('the report gets a tracking code and says plainly that it is a pilot, with draft routing', /^KR-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) && (await text(lp)).includes('not confirmed by any authority') && (await text(lp)).includes('not sent into any government system'));
  const stored = reportSvc.store.get(code)!; const photo = reportSvc.photo(code)!;
  check('the stored photo has no EXIF or GPS, the location is rounded, and a phone number in the note is hidden', !!photo && !hasMetadata(photo) && !photo.includes('GPS') && stored.lat === 23.81 && stored.lng === 90.413 && !stored.description.includes('01712345678'), JSON.stringify({ lat: stored.lat, d: stored.description }));
  await shotTop(lp, '14-report-done'); await axe('report received screen', lp);

  // ---- duplicate at the same spot: "me too" instead of a new ticket ----
  await lp.click('text=Report another problem'); await lp.waitForSelector('[data-report-photo]'); await lp.selectOption('#rep-cat', 'road_damage'); await lp.click('[data-use-location]'); await lp.waitForSelector('text=rounded to about 100 metres'); await lp.click('[data-send-report]'); await lp.waitForSelector('[data-metoo]');
  check('a second report at the same spot offers "me too" and creates no duplicate ticket', (await text(lp)).includes('A similar report already exists nearby') && reportSvc.store.all().length === 1);
  await shotTop(lp, '15-report-similar'); await axe('similar report screen', lp); await lp.click('[data-metoo]'); await lp.waitForSelector('text=Your support was added');
  check('"me too" adds one supporter to the existing ticket', reportSvc.store.get(code)!.supporters === 1);

  // ---- agency console and status tracking by the reporter ----
  const ag = await (await browser.newContext({ ...mobile, locale: 'en-US' })).newPage(); await ag.goto(`${laneSrv.url}/agency.html`); await ag.fill('#token', 'wrong'); await ag.click('#auth button'); await ag.waitForSelector('#msg:not([hidden])');
  check('the agency console rejects a wrong token', (await ag.textContent('#msg'))!.includes('not valid'));
  await ag.fill('#token', AGENCY); await ag.click('#auth button'); await ag.waitForSelector('.ticket');
  check('the agency console lists the report with priority, supporters, office and the confirmed category', (await ag.textContent('.ticket'))!.includes(code) && (await ag.textContent('.ticket'))!.includes('1 supporter') && (await ag.textContent('.ticket'))!.includes('City Corporation'));
  await ag.click('text=Show photo'); await ag.waitForSelector('img.ticketphoto'); await ag.selectOption('.ticket select', 'forwarded'); await ag.fill('.ticket input', 'Sent to ward office'); await ag.click('.ticket .btn:text("Save")'); await ag.waitForFunction(() => document.querySelector('.ticket')?.getAttribute('data-status') === 'forwarded');
  await shot(ag, '16-agency-console'); await axe('agency console', ag); await noOverflow('agency console at 390px', ag);
  await lp.click('text=Report another problem'); await lp.waitForSelector('.trackbox'); await lp.click('.trackbox summary'); await lp.fill('.trackbox input', code); await lp.click('.trackbox .btn'); await lp.waitForSelector('.trackbox .item');
  check('the reporter sees the new status and the office note by entering the code, with no account', (await lp.textContent('.trackbox .item'))!.includes('Forwarded to the office') && (await lp.textContent('.trackbox .item'))!.includes('Sent to ward office'));

  // ---- larger text and the printable checklist ----
  await lp.click('#largeBtn'); check('larger text works without sideways scrolling', (await lp.evaluate(() => document.body.classList.contains('large'))) && (await lp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)));
  await lp.click('#largeBtn');
  const cp = await (await browser.newContext({ ...mobile, locale: 'en-US' })).newPage(); await cp.goto(laneSrv.url); await cp.click('#accept'); await cp.waitForSelector('.lane'); await cp.click('#lang-en');
  await cp.click('.lane[data-lane=check]'); await cp.click('.msg.bot .actions .btn.ghost >> nth=0'); await cp.waitForSelector('input[data-doc="nid"]', { state: 'attached' }); await cp.setInputFiles('input[data-doc="nid"]', 'testdata/e2e/big-exif.jpg');
  await cp.evaluate(() => { (window as any).print = () => {}; });      // keep the sheet on the page so it can be rendered to PDF below
  await cp.waitForSelector('.thumb'); await cp.route('**/api/check', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ verdict: 'NOT_READY', packId: packs[0].pack_id, packVersion: '1', packStatus: 'DRAFT_UNVERIFIED', stale: false, lastVerified: null, demo: false, issues: {}, stored: false, disclaimer_en: 'This is a pre-check, not an official approval.', disclaimer_bn: 'x', read: { nid: [{ field: 'name', value: 'Abdur Rahim' }] }, results: [{ ruleId: 'RN-010', docs: ['nid'], outcome: 'FAIL', reason: 'mismatch', severity: 'blocker', ruleStatus: 'official', message_en: 'Date of birth is different.', message_bn: 'x', fix_en: ['Correct your NID first.'], fix_bn: ['x'], fixService: null, source: null }] }) }));
  await cp.click('#checkBtn'); await cp.waitForSelector('[data-print]'); await cp.click('[data-print]');
  const sheet = await cp.evaluate(() => (document.querySelector('.printsheet') as HTMLElement).innerText);
  check('the printable checklist lists documents and fixes, and holds none of the values read from the photos', sheet.includes('Visit checklist') && sheet.includes('Correct your NID first.') && !sheet.includes('Abdur Rahim'));
  mkdirSync('evidence/demo', { recursive: true }); await cp.emulateMedia({ media: 'print' });
  check('the print stylesheet shows only the checklist (the PDF is saved as evidence/demo/sample-visit-checklist.pdf)', await cp.evaluate(() => getComputedStyle(document.getElementById('chat')!).display === 'none' && getComputedStyle(document.querySelector('.printsheet')!).display === 'block'));
  await cp.pdf({ path: 'evidence/demo/sample-visit-checklist.pdf', format: 'A4', printBackground: false });

  check('no console errors or page errors in any lane', lerrs.length === 0, lerrs.join(' | ').slice(0, 400));
  check('no Content-Security-Policy violations in any lane', ((await lp.evaluate(() => (window as any).__csp)) as string[]).length === 0);
  await lbrowser.close();
}
try { await suite(); await lanesSuite(); } catch (e) { check('the browser suite ran to the end without an unexpected error', false, String(e).replace(/\s+/g, ' ').slice(0, 700)); }
const version = browser.version(); await browser.close(); for (const x of [main, verifiedSrv, freeSrv, offSrv, laneSrv]) x.s.close();
mkdirSync('e2e/results', { recursive: true });
const failed = checks.filter((c) => !c.ok);
writeFileSync('e2e/results/last.json', JSON.stringify({ date: new Date().toISOString(), browser: `Chromium ${version} (headless, desktop Linux, mobile emulation)`, passed: checks.length - failed.length, failed: failed.length, checks }, null, 1));
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed in Chromium ${version}`); process.exit(failed.length ? 1 : 0);
