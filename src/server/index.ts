import { readdirSync, readFileSync } from 'node:fs';
import { loadDotEnv } from '../config/env';
import { parsePack } from '../pack/load';
import { validatePackSet } from '../pack/set';
import { configureLlm } from '../extract/provider';
import { buildKb, Retriever } from '../kb/load';
import { Metrics, seedDemo } from '../insights/metrics';
import { loadGlossary } from '../plain/glossary';
import { loadOutOfScope } from '../assistant/scope';
import { ReportService, loadReportConfig } from '../reports/service';
import { FileTicketStore, MemoryTicketStore } from '../reports/store';
import { createApp } from './app';
import { makeDemoLlm } from './demo';

loadDotEnv();
const env = process.env;
if (process.argv.includes('--demo')) env.LLM_MODE = 'demo';
const production = env.NODE_ENV === 'production';
const die = (msg: string): never => { console.error(`Refusing to start: ${msg}`); process.exit(1); };

const packsDir = env.KAGOJREADY_PACKS_DIR ?? 'packs';
let packs = readdirSync(packsDir).filter((f) => f.endsWith('.json')).map((f) => parsePack(JSON.parse(readFileSync(`${packsDir}/${f}`, 'utf8'))));
const problems = validatePackSet(packs);
if (problems.length) die(problems.join('; '));

const demo = env.LLM_MODE === 'demo';
if (demo) { env.INSIGHTS_DEMO ??= '1'; env.INSIGHTS_TOKEN ??= 'demo-insights-token'; }   // demo mode is never allowed in production
let cfg: ReturnType<typeof configureLlm> = null;
try { cfg = demo ? null : configureLlm(env); } catch (e) { die((e as Error).message); }

if (production) {
  if (demo) die('demo mode is not allowed in production');
  if (!cfg) die('no AI provider key is set (GEMINI_API_KEY or ANTHROPIC_API_KEY)');
  if (cfg!.tier === 'free') die(`${cfg!.provider} is on a free tier, which may use submitted photos to improve its products. Enable billing and set GEMINI_TIER=paid, or use LLM_PROVIDER=anthropic`);
  if (env.ALLOW_DRAFT_PACKS !== '1') packs = packs.filter((p) => p.status === 'VERIFIED');
  if (packs.length === 0) die('no VERIFIED packs to serve (set ALLOW_DRAFT_PACKS=1 only for a labelled pilot)');
}
if (!demo && !cfg) console.warn('No AI key found. Add GEMINI_API_KEY to .env (free key: https://aistudio.google.com/apikey). Checks will return 503 until then, or run `npm run demo`.');

const retriever = new Retriever(buildKb(packs));
const metrics = new Metrics();
if (env.INSIGHTS_DEMO === '1') { if (production) die('INSIGHTS_DEMO (synthetic dashboard numbers) is not allowed in production'); seedDemo(metrics); }
if (production && env.INSIGHTS_TOKEN && env.INSIGHTS_TOKEN.length < 16) die('INSIGHTS_TOKEN must be at least 16 characters');

// ---- civic reports: opt-in in production (they store data), on by default for local trials ----
const wantReports = production ? env.ENABLE_REPORTS === '1' : env.ENABLE_REPORTS !== '0';
if (demo) env.AGENCY_TOKEN ??= 'demo-agency-token';
if (wantReports && production && (!env.AGENCY_TOKEN || env.AGENCY_TOKEN.length < 16)) die('ENABLE_REPORTS=1 needs AGENCY_TOKEN of at least 16 characters');
if (wantReports && production && !env.REPORTS_DIR) die('ENABLE_REPORTS=1 needs REPORTS_DIR, a folder on persistent storage');
// In demo mode there is no model, so the report form asks the person to pick the category. Nothing is faked.
const reports = wantReports ? new ReportService(loadReportConfig(), env.REPORTS_DIR ? new FileTicketStore(env.REPORTS_DIR) : new MemoryTicketStore(), demo ? null : cfg?.client ?? null) : undefined;
if (reports && !env.REPORTS_DIR) console.warn('Reports are kept in memory and will be lost on restart. Set REPORTS_DIR to keep them.');
if (reports) { const purge = () => { const n = reports.purgePhotos(Number(env.REPORT_CLOSED_PHOTO_DAYS ?? 14), Number(env.REPORT_MAX_PHOTO_DAYS ?? 180)); if (n) console.log(`Removed ${n} report photo(s) past retention`); }; purge(); setInterval(purge, 6 * 3600_000).unref(); }

const port = Number(env.PORT ?? 3000);
createApp({ llm: demo ? makeDemoLlm() : cfg?.client ?? null, chatLlm: demo ? null : undefined, packs, demo, retriever, metrics, glossary: loadGlossary(), outOfScope: loadOutOfScope(), reports, agencyToken: env.AGENCY_TOKEN || undefined, insightsToken: env.INSIGHTS_TOKEN || undefined, llmInfo: cfg ? { provider: cfg.provider, tier: cfg.tier } : null, trustProxy: env.TRUST_PROXY === '1' }).listen(port, () => {
  if (demo) console.log(`Insights dashboard (synthetic demo numbers): http://localhost:${port}/insights.html  token: ${env.INSIGHTS_TOKEN}`);
  if (reports && env.AGENCY_TOKEN) console.log(`Agency console: http://localhost:${port}/agency.html${demo ? `  token: ${env.AGENCY_TOKEN}` : ''}`);
  console.log(`KagojReady on http://localhost:${port} | ${packs.length} pack(s), ${retriever.cards.length} knowledge passages | ${env.INSIGHTS_TOKEN ? 'insights on' : 'insights off'} | ${demo ? 'DEMO MODE (does not read photos)' : cfg ? `live extraction via ${cfg.provider} (${cfg.model}, ${cfg.tier === 'n/a' ? 'paid' : cfg.tier} tier)` : 'no AI key'}`);
});
