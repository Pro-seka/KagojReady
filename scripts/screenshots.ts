/**
 * Builds a clean, consistently named screenshot set of every major part of the system for demo videos.
 *   npm run screenshots        ->  screenshots-pack/
 * Two servers are used: the real demo server (real knowledge base, no AI) for most screens, and an in-process
 * server with a scripted stand-in model only where a model is needed (category suggestion, AI plain rewrite).
 * Those AI screens are labelled "stand-in model" in SHOT_LIST.md so nothing is presented as a real model result.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import chromium from '@sparticuz/chromium';
import { chromium as pw, type Page, type Browser } from 'playwright-core';
import { createApp } from '../src/server/app';
import { parsePack } from '../src/pack/load';
import { buildKb, Retriever } from '../src/kb/load';
import { Metrics } from '../src/insights/metrics';
import { loadGlossary } from '../src/plain/glossary';
import { loadOutOfScope } from '../src/assistant/scope';
import { ReportService, loadReportConfig } from '../src/reports/service';
import { MemoryTicketStore } from '../src/reports/store';
import type { LlmClient } from '../src/extract/types';

const OUT = 'screenshots-pack';
rmSync(OUT, { recursive: true, force: true }); for (const d of ['mobile', 'desktop', 'extras']) mkdirSync(`${OUT}/${d}`, { recursive: true });
mkdirSync('testdata/demo', { recursive: true });
const shots: Array<{ file: string; title: string; say: string; note?: string }> = [];
const M = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const D = { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 2 };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- illustrations (clearly labelled, not real photos) ----------
const art = (kind: 'pothole' | 'garbage' | 'drain') => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe3f3"/><stop offset="1" stop-color="#eaf2f8"/></linearGradient><linearGradient id="rd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b5f66"/><stop offset="1" stop-color="#3a3d42"/></linearGradient></defs>
<rect width="1200" height="800" fill="url(#sky)"/><rect y="250" width="1200" height="60" fill="#8f8a80"/><rect y="310" width="1200" height="490" fill="url(#rd)"/>
<g fill="#b9b1a4"><rect x="40" y="130" width="180" height="125"/><rect x="260" y="95" width="150" height="160"/><rect x="460" y="150" width="220" height="105"/><rect x="740" y="105" width="170" height="150"/><rect x="950" y="140" width="200" height="115"/></g>
<g stroke="#e9e5d8" stroke-width="10" stroke-dasharray="70 60"><line x1="0" y1="560" x2="1200" y2="560"/></g>
${kind === 'pothole' ? '<ellipse cx="560" cy="640" rx="230" ry="82" fill="#2b2c2f"/><ellipse cx="560" cy="632" rx="205" ry="66" fill="#17181a"/><ellipse cx="520" cy="620" rx="90" ry="22" fill="#1f2a33"/><path d="M330 640 q-40 -10 -60 20 M790 650 q50 -6 70 24" stroke="#2b2c2f" stroke-width="6" fill="none"/>' : ''}
${kind === 'garbage' ? '<g><ellipse cx="560" cy="650" rx="280" ry="70" fill="#4a4338"/><circle cx="470" cy="615" r="46" fill="#7d6f55"/><circle cx="560" cy="595" r="58" fill="#6a7a5c"/><circle cx="650" cy="620" r="48" fill="#8a5a4a"/><rect x="520" y="560" width="70" height="46" fill="#2f5d8a" transform="rotate(-12 555 583)"/><circle cx="600" cy="660" r="32" fill="#c8c0a8"/></g>' : ''}
${kind === 'drain' ? '<rect x="330" y="600" width="460" height="110" fill="#2a2b2e"/><g stroke="#6d7075" stroke-width="8"><line x1="370" y1="600" x2="370" y2="710"/><line x1="430" y1="600" x2="430" y2="710"/><line x1="490" y1="600" x2="490" y2="710"/><line x1="550" y1="600" x2="550" y2="710"/><line x1="610" y1="600" x2="610" y2="710"/><line x1="670" y1="600" x2="670" y2="710"/><line x1="730" y1="600" x2="730" y2="710"/></g><ellipse cx="560" cy="735" rx="420" ry="40" fill="#5d7d8f" opacity=".6"/><circle cx="480" cy="640" r="28" fill="#7d6f55"/><circle cx="640" cy="655" r="24" fill="#6a7a5c"/>' : ''}
<rect x="24" y="742" width="560" height="38" rx="8" fill="#000" opacity=".55"/><text x="40" y="768" font-family="Arial,sans-serif" font-size="22" fill="#fff">DEMO ILLUSTRATION, NOT A REAL PHOTO</text></svg>`;

const browser: Browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
// This Chromium build runs in a single process: closing a page can end the browser, so contexts are left open until the end.
const keep = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
for (const k of ['pothole', 'garbage', 'drain'] as const) {
  const p = keep; await p.setContent(`<body style="margin:0">${art(k)}</body>`);
  await p.screenshot({ path: `testdata/demo/street-${k}.jpg`, type: 'jpeg', quality: 82 }); copyFileSync(`testdata/demo/street-${k}.jpg`, `${OUT}/extras/street-${k}-illustration.jpg`);
}

// ---------- server A: the real demo server ----------
const PORT = 3921; const demo = spawn('npx', ['tsx', 'src/server/index.ts', '--demo'], { env: { ...process.env, PORT: String(PORT), INSIGHTS_TOKEN: 'demo-insights-token' }, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise<void>((ok, bad) => { const t = setTimeout(() => bad(new Error('demo server did not start')), 40000); demo.stdout.on('data', (d) => { if (String(d).includes('KagojReady on')) { clearTimeout(t); ok(); } }); });
const A = `http://127.0.0.1:${PORT}`;

// ---------- server B: real packs, stand-in model for the AI-only screens ----------
let nextCategory = 'road_damage';
const standIn: LlmClient = { async complete(req) {
  if (req.image) return JSON.stringify({ category: nextCategory, confidence: 0.92, safety_hazard: false, is_public_infrastructure_problem: true });
  if (req.system.includes('rewrite official')) { const n = (re: RegExp) => Number(req.userText.split('\n').find((l) => re.test(l))?.match(/^\[(\d+)\]/)?.[1] ?? 1);
    return JSON.stringify({ points: [{ text: 'The renewal fee is 1,500 taka.', sentence: n(/1,500/) }, { text: 'You must renew within 30 days.', sentence: n(/within 30 days/) }, { text: 'Not renewing can cost you a fine of 9,000 taka.', sentence: n(/5,000/) }] }); }
  return 'x'; } };
const packs = readdirSync('packs').filter((f) => f.endsWith('.json')).map((f) => parsePack(JSON.parse(readFileSync(`packs/${f}`, 'utf8'))));
const svc = new ReportService(loadReportConfig(), new MemoryTicketStore(), standIn);
const AGENCY = 'shots-agency-token-0123456789';
const B = await new Promise<string>((r) => { const s = createApp({ llm: standIn, packs, retriever: new Retriever(buildKb(packs)), metrics: new Metrics(), glossary: loadGlossary(), outOfScope: loadOutOfScope(), reports: svc, agencyToken: AGENCY, log: () => {}, rateLimit: { max: 1000, windowMs: 60_000 } }); s.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${(s.address() as AddressInfo).port}`)); });

// ---------- helpers ----------
const ready = async (p: Page) => { await p.evaluate(() => document.fonts.ready); await wait(450); };
async function snap(p: Page, kind: 'mobile' | 'desktop', file: string, title: string, say: string, o: { top?: boolean; tall?: number; note?: string; focus?: string } = {}) {
  const vp = p.viewportSize()!;
  if (o.tall) await p.setViewportSize({ width: vp.width, height: o.tall });
  if (o.top) await p.evaluate(() => { const m = [...document.querySelectorAll('.msg.bot')].pop(); if (m) m.scrollIntoView({ block: 'start' }); window.scrollTo(0, 0); });
  if (o.focus) await p.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), o.focus);
  await ready(p); await p.screenshot({ path: `${OUT}/${kind}/${file}.png` });
  if (o.tall) await p.setViewportSize(vp);
  shots.push({ file: `${kind}/${file}.png`, title, say, note: o.note });
  console.log('shot', kind, file);
}
const open = async (b: Browser, o: object, url: string, lang: 'bn' | 'en' = 'bn', consent = true) => {
  const ctx = await b.newContext({ ...o, locale: lang === 'bn' ? 'bn-BD' : 'en-US', geolocation: { latitude: 23.8103, longitude: 90.4125 } }); await ctx.grantPermissions(['geolocation'], { origin: url });
  const p = await ctx.newPage(); await p.goto(url); await p.waitForSelector('#accept');
  if (consent) { await p.click('#accept'); await p.waitForSelector('.lane'); if (lang === 'en') await p.click('#lang-en'); await wait(200); }
  return p;
};
const ask = async (p: Page, q: string) => { const n = await p.locator('.msg.bot').count(); await p.fill('#input', q); await p.press('#input', 'Enter'); await p.waitForFunction((c) => !document.querySelector('.typing') && document.querySelectorAll('.msg.bot').length > c, n, { timeout: 20000 }); await wait(300); };
const openLast = (p: Page) => p.evaluate(() => { const d = [...document.querySelectorAll('.msg.bot')].pop()?.querySelectorAll('details'); d?.forEach((x) => ((x as HTMLDetailsElement).open = true)); });
const fresh = async (p: Page) => { await p.click('#newBtn'); await wait(350); };      // start each scene from a clean conversation
const lane = async (p: Page, id: string) => { await p.click(`.lane[data-lane=${id}]`); await wait(500); };
const type = async (p: Page, sel: string, v: string) => { await p.fill(sel, v); };

// =====================  MOBILE (Bangla first, as the product is)  =====================
{
  const ctx0 = await browser.newContext({ ...M, locale: 'bn-BD' }); const p = await ctx0.newPage(); await p.goto(A); await p.waitForSelector('#accept');
  await snap(p, 'mobile', '01-consent', 'Consent and privacy notice', 'Before anything happens, KagojReady explains that it is a pre-check, not a government approval, and what it does with your data.');
  await p.click('#accept'); await p.waitForSelector('.lane'); await wait(300);
  await snap(p, 'mobile', '02-home-and-lanes', 'Home: five things you can do', 'One assistant, five lanes: Ask, Check documents, Fill a form, Plain language, Report a problem.');

  await ask(p, 'এনআইডি সংশোধনে কত সময় লাগে?');
  await snap(p, 'mobile', '03-ask-answer-with-sources', 'Ask in Bangla: answer with numbered sources', 'Every answer shows its sources, with date and status. Not confirmed press reports are labelled as such.', { top: true, tall: 1500 });
  await openLast(p); await snap(p, 'mobile', '04-ask-how-i-answered', 'How I answered: the transparent trail', 'The trail lists what happened: personal numbers hidden, passages found, answer checked against sources.', { top: true, tall: 1700 });

  await fresh(p); await ask(p, 'How do I renew my driving licence?');
  await snap(p, 'mobile', '05-ask-service-not-covered', 'A service we do not cover is named, not guessed', 'It says plainly that it does not cover this yet, and counts only the service name to decide what to build next.', { top: true });
  await fresh(p); await ask(p, 'What is the weather in Dhaka today?');
  await snap(p, 'mobile', '06-ask-refuses-offtopic', 'Off-topic question: it declines instead of guessing', 'When the sources do not cover a question it refuses and never calls the AI.', { top: true });
  await p.click('#lang-en'); await wait(200); await fresh(p);
  await ask(p, 'nid songshodhon korte koto din lage'); await openLast(p);
  await snap(p, 'mobile', '07-ask-romanized-bangla', 'Typed the way people actually type: romanized Bangla', 'No Bangla keyboard needed. It maps the words, and the trail says it did.', { top: true, tall: 1700 });
  await fresh(p); await ask(p, 'pasport renewel documents');
  await snap(p, 'mobile', '08-ask-typo-repaired', 'A typo is repaired, and says so', 'Only a small slip from a known word is repaired; unknown words still count against coverage.', { top: true, tall: 1500 });
  await p.click('#lang-bn'); await wait(200);

  // document check (demo server: first check reads as ready, second as a mismatch)
  const doCheck = async () => {
    await fresh(p); await lane(p, 'check'); await p.locator('.msg.bot').last().locator('.actions .btn.ghost').first().click(); await p.waitForSelector('input[data-doc="nid"]', { state: 'attached' });
    await p.setInputFiles('input[data-doc="nid"]', 'testdata/specimens/dob_year_mismatch__clean/nid.jpg'); await p.setInputFiles('input[data-doc="old_passport"]', 'testdata/specimens/dob_year_mismatch__clean/old_passport.jpg');
    await p.waitForFunction(() => document.querySelectorAll('.thumb').length >= 2); await wait(300);
  };
  await doCheck(); await snap(p, 'mobile', '09-check-documents-form', 'Check my documents: add photos', 'Photos are shrunk and stripped of location data on the phone, and wiped after the check.', { top: true, tall: 1400 });
  await p.click('#checkBtn'); await p.waitForSelector('.verdict, .stamp, .msg.bot .card', { timeout: 20000 }); await wait(1200);
  await snap(p, 'mobile', '10-check-result-ready', 'Result: looks ready', 'A pre-check, never an approval. Each rule that passed is explained.', { top: true, tall: 1050, note: 'Demo server: the first check is scripted to look ready.' });
  await doCheck(); await p.click('#checkBtn'); await wait(1500);
  await snap(p, 'mobile', '11-check-result-not-ready', 'Result: not ready, with what to fix', 'The date of birth differs between NID and passport. It says what to fix first and links to the NID correction service.', { top: true, tall: 1250, note: 'Demo server: the second check is scripted to show a mismatch. With a Gemini or Claude key, real photos are read.' });
  await p.evaluate(() => { (window as any).print = () => {}; }); await p.click('[data-print]'); await p.emulateMedia({ media: 'print' }); await p.screenshot({ path: `${OUT}/extras/print-checklist-page.png`, fullPage: false });
  await p.pdf({ path: `${OUT}/extras/visit-checklist.pdf`, format: 'A4' }); await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  shots.push({ file: 'extras/print-checklist-page.png', title: 'Printable visit checklist (print view)', say: 'One tap makes a checklist you can print or save: documents to bring and what to fix. No personal details on it.' });
  shots.push({ file: 'extras/visit-checklist.pdf', title: 'Printable visit checklist (PDF)', say: 'The same checklist as a PDF.' });

  // form coach
  await fresh(p); await lane(p, 'coach'); await wait(400);
  await snap(p, 'mobile', '12-form-coach-empty', 'Form coach', 'Type or speak your details; each field is checked as you go. It all stays on your device.', { top: true, tall: 1700 });
  await type(p, '#cf-name', 'Abdur Rahim'); await type(p, '#cf-father_name', 'Karim Uddin'); await type(p, '#cf-dob', '12/03/1990'); await type(p, '#cf-nid', '123456789012'); await type(p, '#cf-passport', 'A12345678'); await type(p, '#cf-expiry', '01/01/2020'); await type(p, '#cf-mobile', '+8801712345678'); await type(p, '#cf-email', 'rahim@');
  await snap(p, 'mobile', '13-form-coach-live-validation', 'Live validation: errors, warnings and "read as"', 'A 12-digit NID is flagged, an expired passport warns, the date is echoed back so you can confirm how it was read.', { top: true, tall: 2300 });

  // plain language
  await fresh(p); await lane(p, 'plain'); await wait(400); await snap(p, 'mobile', '14-plain-language-input', 'Plain-language reader', 'Paste a notice, circular or bill. The text is not stored.', { top: true });
  await p.click('[data-plain-sample]'); await wait(400); await snap(p, 'mobile', '15-plain-language-sample', 'Sample notice loaded (made-up text)', 'The sample is made-up text written for the demo, not a real law.', { top: true });
  await p.click('[id^=pgo-]'); await p.waitForSelector('ul.pts'); await wait(500);
  await snap(p, 'mobile', '16-plain-language-result', 'Plain-language result: what it means and by when', 'Difficulty, key sentences, deadlines and amounts. Without AI the key sentences are shown unchanged.', { top: true, tall: 2300 });
  await p.evaluate(() => { document.querySelector('dl.gloss')?.scrollIntoView({ block: 'start' }); }); await snap(p, 'mobile', '17-plain-language-hard-words', 'Hard words explained', 'Legal words such as "notwithstanding" and "arrears" in everyday language, each linked to where it appears.', { tall: 1600 });

  // report (manual category: demo server has no model)
  await fresh(p); await lane(p, 'report'); await wait(500); await snap(p, 'mobile', '18-report-form-empty', 'Report a problem', 'Take a photo, choose the type and area, add a rounded location, and get a tracking code.', { top: true, tall: 1800 });

  // larger text
  await fresh(p); await lane(p, 'ask'); await ask(p, 'এনআইডি সংশোধনে কত সময় লাগে?'); await p.click('#largeBtn'); await wait(300);
  await snap(p, 'mobile', '19-larger-text', 'Larger text for readability', 'One tap, also shareable as the link /#large.', { top: true }); await p.click('#largeBtn');
}

// =====================  MOBILE: report flow on the stand-in server (English)  =====================
// A fresh browser process: a long-running one does not honour the geolocation grant.
const b2: Browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
{
  const p = await open(b2, M, B, 'en');
  await lane(p, 'report'); await p.waitForSelector('[data-report-photo]');
  await p.setInputFiles('[data-report-photo]', 'testdata/demo/street-pothole.jpg'); await p.waitForSelector('[data-suggestion=ok]');
  await p.selectOption('#rep-area', 'city_corporation'); await p.click('[data-use-location]'); await p.waitForSelector('text=rounded to about 100 metres'); await p.fill('#rep-desc', 'Deep hole in front of the school gate. Dangerous for rickshaws.');
  await snap(p, 'mobile', '20-report-photo-and-suggestion', 'Report: AI suggests, you confirm', 'The photo gets a suggested category, and you stay in control. Faces and number plates are warned about.', { top: true, tall: 2300, note: 'Stand-in model: the category suggestion is scripted for this screenshot. A real model is used when a key is configured.' });
  await p.click('[data-send-report]'); await p.waitForSelector('[data-code]');
  await snap(p, 'mobile', '21-report-tracking-code', 'Report received: tracking code', 'No account. The code is the only key, and the screen says plainly that this is a pilot and routing is a draft.', { top: true, tall: 1400 });
  const code = (await p.textContent('[data-code]'))!;
  // a few more reports so the agency console looks lived-in (real API calls, demo data)
  const post = (path: string, body: object) => fetch(`${B}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const img = (k: string) => `data:image/jpeg;base64,${readFileSync(`testdata/demo/street-${k}.jpg`).toString('base64')}`;
  const extra = [['garbage', 'garbage', 23.7925, 90.4078, 'pourashava', 'Rubbish not collected for a week near the market.'], ['drain_waterlogging', 'drain', 23.7561, 90.3872, 'city_corporation', 'Blocked drain, water stays after rain.'], ['open_manhole', 'drain', 23.7806, 90.4193, 'city_corporation', 'Manhole cover missing next to the footpath.'], ['streetlight', 'pothole', 23.8223, 90.3654, 'city_corporation', 'Streetlight out for three nights.']] as const;
  for (const [cat, art2, lat, lng, area, d] of extra) await post('/api/reports', { category: cat, areaType: area, description: d, lat, lng, image: img(art2), lang: 'en' });
  const all = svc.list(); for (const t of all) if (t.category === 'open_manhole') for (let i = 0; i < 4; i++) svc.support(t.id); svc.setStatus(all.find((t) => t.category === 'garbage')!.id, 'in_review', 'Assigned to the conservancy team.');
  await fresh(p); await lane(p, 'report'); await p.waitForSelector('[data-report-photo]'); await p.selectOption('#rep-cat', 'road_damage'); await p.click('[data-use-location]'); await p.waitForSelector('text=rounded to about 100 metres'); await p.click('[data-send-report]'); await p.waitForSelector('[data-metoo]');
  await snap(p, 'mobile', '22-report-similar-exists', 'A similar report already exists nearby', 'Instead of a duplicate ticket, add your support. More support raises priority.', { top: true, tall: 1300 });
  await p.click('[data-metoo]'); await p.waitForSelector('text=Your support was added');
  // office updates the ticket, reporter tracks it
  svc.setStatus(code, 'forwarded', 'Sent to the ward 4 engineer. Repair is scheduled.');
  await fresh(p); await lane(p, 'report'); await p.waitForSelector('.trackbox'); await p.click('.trackbox summary'); await p.fill('.trackbox input', code); await p.click('.trackbox .btn'); await p.waitForSelector('.trackbox .item');
  await snap(p, 'mobile', '23-report-track-status', 'Track a report by its code', 'The reporter sees the status and the office note. Never the description, location or photo.', { tall: 1100, focus: '.trackbox .item' });
  // AI-grounded plain language
  await fresh(p); await lane(p, 'plain'); await p.click('[data-plain-sample]'); await wait(300); await p.click('[id^=pgo-]'); await p.waitForSelector('ul.pts'); await wait(500);
  await snap(p, 'mobile', '24-plain-language-ai-checked', 'AI rewrite with every point checked', 'Each point links to its source sentence. A point with an invented figure is removed, and the screen says so.', { top: true, tall: 2200, note: 'Stand-in model: it deliberately includes one invented figure (9,000 taka) to show the check removing it.' });

  // agency console
  const ag = await b2.newContext({ ...M, locale: 'en-US' }); const ap = await ag.newPage(); await ap.goto(`${B}/agency.html`);
  await snap(ap, 'mobile', '25-agency-console-login', 'Agency console: token login', 'Only people with the token see tickets. Wrong tokens are refused and repeated failures are locked out.', {});
  await ap.fill('#token', AGENCY); await ap.click('#auth button'); await ap.waitForSelector('.ticket'); await wait(400);
  await snap(ap, 'mobile', '26-agency-console-list', 'Agency console: tickets sorted by priority', 'Safety hazards and well-supported reports rise to the top. The score is a transparent heuristic.', { tall: 2300 });

  // desktop set from server B
  const d = await open(b2, D, B, 'en');
  await snap(d, 'desktop', '01-home', 'Home on a laptop', 'The same interface scales to desktop.', {});
  await lane(d, 'report'); await d.setInputFiles('[data-report-photo]', 'testdata/demo/street-garbage.jpg'); nextCategory = 'garbage'; await d.waitForSelector('[data-suggestion=ok]'); await d.selectOption('#rep-area', 'pourashava');
  await snap(d, 'desktop', '05-report-with-suggestion', 'Report with photo and suggestion (desktop)', 'AI suggests, you confirm.', { top: true, note: 'Stand-in model.' });
  const dag = await (await b2.newContext({ ...D, locale: 'en-US' })).newPage(); await dag.goto(`${B}/agency.html`); await dag.fill('#token', AGENCY); await dag.click('#auth button'); await dag.waitForSelector('.ticket'); await wait(400);
  await snap(dag, 'desktop', '06-agency-console', 'Agency console (desktop)', 'Priority-sorted tickets with filters, photo view, status updates and CSV export.', {});
}

// =====================  DESKTOP from the demo server  =====================
{
  const p = await open(browser, D, A, 'bn');
  await ask(p, 'এনআইডি সংশোধনে কত সময় লাগে?'); await snap(p, 'desktop', '02-ask-answer', 'Ask on a laptop', 'Answer with sources.', { top: true });
  await fresh(p); await lane(p, 'plain'); await p.click('[data-plain-sample]'); await p.click('[id^=pgo-]'); await p.waitForSelector('ul.pts'); await wait(400); await snap(p, 'desktop', '04-plain-language-result', 'Plain-language result (desktop)', 'Difficulty, key sentences, deadlines and amounts.', { top: true, tall: 1500 });
  await fresh(p); await lane(p, 'coach'); await type(p, '#cf-nid', '123456789012'); await type(p, '#cf-dob', '12/03/1990'); await type(p, '#cf-mobile', '01712345678'); await snap(p, 'desktop', '08-form-coach', 'Form coach (desktop)', 'Live validation, all on the device.', { top: true, tall: 1400 });
  await fresh(p); await lane(p, 'check'); await p.locator('.msg.bot').last().locator('.actions .btn.ghost').first().click(); await p.waitForSelector('input[data-doc="nid"]', { state: 'attached' });
  await p.setInputFiles('input[data-doc="nid"]', 'testdata/specimens/dob_year_mismatch__clean/nid.jpg'); await p.setInputFiles('input[data-doc="old_passport"]', 'testdata/specimens/dob_year_mismatch__clean/old_passport.jpg'); await p.waitForFunction(() => document.querySelectorAll('.thumb').length >= 2); await p.click('#checkBtn'); await wait(1500);
  await snap(p, 'desktop', '03-check-result', 'Document check result (desktop)', 'What to fix and why, with sources.', { top: true, tall: 1500 });
  const ip = await (await browser.newContext({ ...D, locale: 'en-US' })).newPage(); await ip.goto(`${A}/insights.html`); await ip.fill('#token', 'demo-insights-token'); await ip.click('#auth button'); await ip.waitForSelector('.kpi'); await wait(500);
  await snap(ip, 'desktop', '07-insights-dashboard', 'Insights dashboard (synthetic demo numbers)', 'Counters only, small groups hidden. Includes services people asked for that are not covered yet.', { tall: 1500, note: 'SYNTHETIC: numbers in demo mode are made up and labelled so on the page.' });
  const im = await (await browser.newContext({ ...M, locale: 'en-US' })).newPage(); await im.goto(`${A}/insights.html`); await im.fill('#token', 'demo-insights-token'); await im.click('#auth button'); await im.waitForSelector('.kpi');
  await snap(im, 'mobile', '27-insights-dashboard', 'Insights dashboard on a phone (synthetic demo numbers)', 'Aggregate and anonymous.', { tall: 2400, note: 'SYNTHETIC.' });
}

// ---------- shot list, contact sheet ----------
const order = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const mobile = shots.filter((s) => s.file.startsWith('mobile/')).sort((a, b) => order(a.file, b.file));
const desktop = shots.filter((s) => s.file.startsWith('desktop/')).sort((a, b) => order(a.file, b.file));
const extras = shots.filter((s) => s.file.startsWith('extras/'));
const row = (s: (typeof shots)[0]) => `| \`${s.file}\` | ${s.title} | ${s.say} ${s.note ? `**Note:** ${s.note}` : ''} |`;
writeFileSync(`${OUT}/SHOT_LIST.md`, `# KagojReady screenshot pack for the demo video

Resolution: mobile 1170 x 2532 (iPhone-class, 3x), desktop 2732 x 1536 (2x). Mobile shots with a tall page are taller than 2532 because the phone is shown with more room so a whole result fits; crop or scroll them in your editor.

## Be honest in the video (important)
- Most screens come from the **real demo server**: real knowledge base and rules, **no AI**. The document check there is **scripted** (first check looks ready, second shows a mismatch). Say "demo mode" when you show these.
- Shots marked **Stand-in model** (report category suggestion, AI-checked plain rewrite) use a scripted stand-in for the AI to show the checks around it. Do not call these real model results. With your own Gemini or Claude key the same screens use a real model.
- **SYNTHETIC** dashboard numbers are made up for the demo and labelled on the page.
- The street images are labelled illustrations, not real photos. Replace them with your own photos for a real demo.
- The sample notice is made-up text, not a real law. Routing to offices is a draft.

## Suggested video order (about 4 minutes)
1. Hook (10 s): \`mobile/02-home-and-lanes\` and a line on the wasted trip.
2. Ask (50 s): 03, 04, 07, 05, 06.
3. Check documents (40 s): 09, 10, 11, then \`extras/print-checklist-page\`.
4. Form coach (20 s): 12, 13.
5. Plain language (40 s): 14, 15, 16, 17, 24.
6. Report (50 s): 20, 21, 22, 23.
7. Agency and insights (30 s): 25, 26, \`desktop/06-agency-console\`, \`desktop/07-insights-dashboard\`.
8. Close (10 s): honest status, NO-GO from \`npm run readiness\`, what is next.

## Mobile
| File | Screen | Suggested narration |
|---|---|---|
${mobile.map(row).join('\n')}

## Desktop
| File | Screen | Suggested narration |
|---|---|---|
${desktop.map(row).join('\n')}

## Extras
| File | What | Use |
|---|---|---|
${extras.map(row).join('\n')}
| \`extras/street-*-illustration.jpg\` | The labelled illustrations used in the report flow | Source images |

Regenerate everything with \`npm run screenshots\`.
`);
const cs = await (await browser.newContext({ viewport: { width: 2400, height: 100 } })).newPage();
const tiles = mobile.map((s) => `<figure><img src="${s.file.replace('mobile/', 'mobile/')}"><figcaption>${s.file.replace('mobile/', '').replace('.png', '')}</figcaption></figure>`).join('');
writeFileSync(`${OUT}/contact-sheet.html`, `<body style="margin:0;background:#eef1f6;font:14px Arial"><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:18px;padding:24px">${tiles}</div><style>figure{margin:0;background:#fff;border-radius:12px;padding:8px;box-shadow:0 1px 6px #0002}img{width:100%;height:520px;object-fit:cover;object-position:top;border-radius:8px}figcaption{padding:6px 2px;color:#333}</style></body>`);
await cs.goto(`file://${process.cwd()}/${OUT}/contact-sheet.html`); await wait(1500); await cs.screenshot({ path: `${OUT}/contact-sheet.png`, fullPage: true }); rmSync(`${OUT}/contact-sheet.html`);
await browser.close(); demo.kill(); console.log(`done: ${shots.length} files in ${OUT}/`); process.exit(0);
