import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, normalize } from 'node:path';
import type { Pack } from '../pack/schema';
import type { LlmClient } from '../extract/types';
import { runCheck } from '../pipeline';
import { DEFAULT_MIN_CONFIDENCE } from '../rules/engine';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Retriever } from '../kb/load';
import { answerQuestion, type Lang } from '../assistant/answer';
import { Metrics } from '../insights/metrics';
import { plainLanguage } from '../plain';
import type { GlossEntry } from '../plain/glossary';
import type { ReportService } from '../reports/service';
import type { OutOfScopeService } from '../assistant/scope';
import { CODE_RE } from '../reports/service';

export interface AppOptions {
  llm: LlmClient | null;
  /** Model for chat answers. Defaults to `llm`. Pass null to answer from the sources only (demo mode). */
  chatLlm?: LlmClient | null;
  packs: Pack[];
  demo?: boolean;
  llmInfo?: { provider: string; tier: string } | null;
  /** Knowledge base search. Without it the chat endpoint is off. */
  retriever?: Retriever | null;
  metrics?: Metrics;
  /** Bearer token for /api/insights. Without it the endpoint does not exist. */
  insightsToken?: string;
  /** Plain-language lane. Without a glossary it still works (the glossary is only one part of it). */
  glossary?: GlossEntry[];
  /** Civic reports. Without it the report endpoints do not exist. */
  reports?: ReportService;
  /** Bearer token for the agency console. Without it the agency endpoints do not exist. */
  agencyToken?: string;
  outOfScope?: Parameters<typeof import('../assistant/scope').detectOutOfScope>[1];
  today?: () => string;
  publicDir?: string;
  rateLimit?: { max: number; windowMs: number; chatMax?: number };
  trustProxy?: boolean;
  log?: (line: string) => void;
}

const MAX_BODY = 14 * 1024 * 1024;
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png',
};
const ERR = {
  not_configured: { en: 'This service is not available right now.', bn: 'এই সেবা এখন পাওয়া যাচ্ছে না।' },
  bad_request: { en: 'The request was not valid.', bn: 'অনুরোধটি সঠিক নয়।' },
  too_large: { en: 'The photos are too large. Use smaller photos.', bn: 'ছবিগুলো অনেক বড়। ছোট ছবি ব্যবহার করুন।' },
  rate_limited: { en: 'Too many checks. Wait a few minutes.', bn: 'অনেকবার যাচাই করা হয়েছে। কয়েক মিনিট অপেক্ষা করুন।' },
  not_found: { en: 'Not found.', bn: 'পাওয়া যায়নি।' },
  unauthorized: { en: 'A valid access token is required.', bn: 'সঠিক অ্যাক্সেস টোকেন দরকার।' },
  server_error: { en: 'Something went wrong. Try again.', bn: 'কিছু ভুল হয়েছে। আবার চেষ্টা করুন।' },
} as const;

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(self)',   // location only when a person taps "use my location" in a report; the browser still asks
};

export function createApp(opts: AppOptions): http.Server {
  const today = opts.today ?? (() => new Date().toISOString().slice(0, 10));
  const publicDir = opts.publicDir ?? join(process.cwd(), 'public');
  const rl = opts.rateLimit ?? { max: 20, windowMs: 10 * 60 * 1000 };
  const makeLimiter = (max: number) => {
    const hits = new Map<string, number[]>();
    return (ip: string): boolean => {
      const now = Date.now();
      const recent = (hits.get(ip) ?? []).filter((t) => now - t < rl.windowMs);
      recent.push(now); hits.set(ip, recent);
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < rl.windowMs)) hits.delete(k);
      return recent.length > max;
    };
  };
  const limited = makeLimiter(rl.max), chatLimited = makeLimiter(rl.chatMax ?? rl.max * 3), insightsLimited = makeLimiter(10);
  const log = opts.log ?? ((l: string) => console.log(l));
  const metrics = opts.metrics ?? new Metrics();
  const clientIp = (req: http.IncomingMessage) => (opts.trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '') || req.socket.remoteAddress || 'unknown';

  const send = (res: http.ServerResponse, status: number, body: string | Buffer, type: string, extra: Record<string, string> = {}) => {
    res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': type, ...extra });
    res.end(body);
  };
  const json = (res: http.ServerResponse, status: number, data: unknown) =>
    send(res, status, JSON.stringify(data), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store' });
  const fail = (res: http.ServerResponse, status: number, code: keyof typeof ERR) =>
    json(res, status, { error: code, message_en: ERR[code].en, message_bn: ERR[code].bn });

  const servicesView = () => ({
    demo: !!opts.demo,
    llm: opts.llmInfo ? { provider: opts.llmInfo.provider, tier: opts.llmInfo.tier } : null,
    chat: !!opts.retriever, plain: true, reports: !!opts.reports,
    services: [...opts.packs].sort((a, b) => a.display_order - b.display_order || a.pack_id.localeCompare(b.pack_id)).map((p) => ({
      id: p.pack_id, name_en: p.service.name_en, name_bn: p.service.name_bn, applicantTypes: p.applicant_types,
      status: p.status, lastVerified: p.last_verified, stale: p.review_by !== null && p.review_by < today(),
      documents: p.documents.map((d) => ({ id: d.id, name_en: d.name_en, name_bn: d.name_bn, tip_en: d.photo_tip_en ?? '', tip_bn: d.photo_tip_bn ?? '' })),
    })),
  });

  const readBody = (req: http.IncomingMessage): Promise<Buffer | 'too_large'> => new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0; let over = false;
    req.on('data', (c: Buffer) => { size += c.length; if (size > MAX_BODY) { over = true; return; } chunks.push(c); });
    req.on('end', () => resolve(over ? 'too_large' : Buffer.concat(chunks)));
    req.on('error', reject);
  });

  const check = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const ip = (opts.trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '') || req.socket.remoteAddress || 'unknown';
    if (limited(ip)) return fail(res, 429, 'rate_limited');
    if (!opts.llm) return fail(res, 503, 'not_configured');
    if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) return fail(res, 400, 'bad_request');
    const raw = await readBody(req);
    if (raw === 'too_large') return fail(res, 413, 'too_large');
    let body: any;
    try { body = JSON.parse(raw.toString('utf8')); } catch { return fail(res, 400, 'bad_request'); }
    const pack = opts.packs.find((p) => p.pack_id === body?.packId);
    if (!pack || typeof body.applicantType !== 'string' || !pack.applicant_types.includes(body.applicantType)
        || typeof body.images !== 'object' || body.images === null || Array.isArray(body.images)) return fail(res, 400, 'bad_request');
    const known = new Set(pack.documents.map((d) => d.id));
    const images: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body.images)) {
      if (!known.has(k) || typeof v !== 'string') return fail(res, 400, 'bad_request');
      images[k] = v;
    }
    const t0 = Date.now();
    const { report, docs, issues } = await runCheck({ pack, applicantType: body.applicantType, images, llm: opts.llm, today: today() });
    // Rule evidence is deliberately not sent back. `read` echoes the person's own extracted fields to them, only so they can spot a misread.
    const read = Object.fromEntries(pack.documents.filter((d) => docs[d.id]).map((d) => [d.id, d.fields.map((f) => {
      const x = docs[d.id]?.[f]; const usable = !!x && x.legible && x.confidence >= DEFAULT_MIN_CONFIDENCE && x.value != null;
      return { field: f, value: usable ? x!.value : null };
    })]));
    metrics.record({ type: 'check', service: pack.pack_id, verdict: report.verdict, failedRules: report.results.filter((r) => r.outcome === 'FAIL').map((r) => r.ruleId), latencyMs: Date.now() - t0, issues: Object.keys(issues).length });
    json(res, 200, {
      verdict: report.verdict, read, packId: report.packId, packVersion: report.packVersion, packStatus: report.packStatus,
      stale: report.stale, lastVerified: pack.last_verified, demo: !!opts.demo, issues, stored: false,
      disclaimer_en: report.disclaimer_en, disclaimer_bn: report.disclaimer_bn,
      results: report.results.map((r) => ({
        ruleId: r.ruleId, docs: r.docs, outcome: r.outcome, reason: r.reason, severity: r.severity, ruleStatus: r.ruleStatus,
        message_en: r.message_en, message_bn: r.message_bn, fix_en: r.fix_en, fix_bn: r.fix_bn, fixService: r.fixService ?? null, source: r.source,
      })),
    });
  };


  const readJson = async (req: http.IncomingMessage, res: http.ServerResponse, maxBytes: number): Promise<any | null> => {
    if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) { fail(res, 400, 'bad_request'); return null; }
    const chunks: Buffer[] = []; let size = 0;
    for await (const c of req) { size += (c as Buffer).length; if (size > maxBytes) { fail(res, 413, 'too_large'); req.resume(); return null; } chunks.push(c as Buffer); }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(res, 400, 'bad_request'); return null; }
  };

  const chat = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (!opts.retriever) return fail(res, 404, 'not_found');
    if (chatLimited(clientIp(req))) return fail(res, 429, 'rate_limited');
    const body = await readJson(req, res, 8 * 1024); if (!body) return;
    if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 600 || !['bn', 'en'].includes(body.lang)) return fail(res, 400, 'bad_request');
    const t0 = Date.now();
    const out = await answerQuestion({ question: body.message, uiLang: body.lang as Lang, retriever: opts.retriever, llm: opts.chatLlm !== undefined ? opts.chatLlm : opts.llm, services: [...opts.packs].sort((a, b) => a.display_order - b.display_order || a.pack_id.localeCompare(b.pack_id)).map((p) => ({ id: p.pack_id })), outOfScope: opts.outOfScope });   // headline service first
    metrics.record({ type: 'chat', topic: out.topic, mode: out.mode, lang: out.lang, usedLlm: out.usedLlm, latencyMs: Date.now() - t0, redacted: out.redactions.length > 0 });
    if (out.unmet) metrics.record({ type: 'unmet', service: out.unmet.id });
    json(res, 200, { ...out, stored: false });
  };

  // ---------- plain-language lane ----------
  const plainLimited = makeLimiter(rl.chatMax ?? rl.max * 3);
  const plain = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (plainLimited(clientIp(req))) return fail(res, 429, 'rate_limited');
    const body = await readJson(req, res, 80 * 1024); if (!body) return;   // 20,000 Bangla characters are about 60 KB in UTF-8
    if (typeof body.text !== 'string' || body.text.trim().length < 20 || body.text.length > 20_000 || (body.lang !== undefined && !['bn', 'en'].includes(body.lang))) return fail(res, 400, 'bad_request');
    const t0 = Date.now();
    const out = await plainLanguage({ text: body.text, lang: body.lang, glossary: opts.glossary ?? [], llm: opts.chatLlm !== undefined ? opts.chatLlm : opts.llm });
    metrics.record({ type: 'plain', mode: out.mode, lang: out.analysis.lang, usedLlm: out.usedLlm, level: out.analysis.readability.level, latencyMs: Date.now() - t0 });
    json(res, 200, { ...out, stored: false });
  };

  // ---------- civic reports ----------
  const reportLimited = makeLimiter(Math.max(8, Math.round(rl.max * 0.4))), classifyLimited = makeLimiter(Math.max(12, Math.round(rl.max * 0.6))), trackLimited = makeLimiter(Math.max(30, rl.max * 1.5)), agencyLimited = makeLimiter(Math.max(120, rl.max * 6));
  // Brute-force guard for the agency token: only FAILED attempts count, so a legitimate console is never locked out by its own refreshes.
  const failedAgency = new Map<string, number[]>();
  const agencyBlocked = (ip: string) => (failedAgency.get(ip) ?? []).filter((t) => Date.now() - t < rl.windowMs).length >= 10;
  const agencyFailed = (ip: string) => { const r = (failedAgency.get(ip) ?? []).filter((t) => Date.now() - t < rl.windowMs); r.push(Date.now()); failedAgency.set(ip, r); if (failedAgency.size > 5000) for (const [k, v] of failedAgency) if (!v.some((t) => Date.now() - t < rl.windowMs)) failedAgency.delete(k); };
  const JPEG_URL = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/;
  const jpegFrom = (v: unknown): Buffer | null | 'bad' => { if (v == null || v === '') return null; if (typeof v !== 'string') return 'bad'; const m = JPEG_URL.exec(v); return m ? Buffer.from(m[1], 'base64') : 'bad'; };
  const reportsConfig = () => ({ categories: opts.reports!.cfg.categories, areaTypes: opts.reports!.cfg.routing.area_types, routingStatus: opts.reports!.cfg.routing.status });

  const reportClassify = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (classifyLimited(clientIp(req))) return fail(res, 429, 'rate_limited');
    const body = await readJson(req, res, 900 * 1024); if (!body) return;
    const img = jpegFrom(body.image); if (!img || img === 'bad') return fail(res, 400, 'bad_request');
    const c = await opts.reports!.classify(img);
    if (c.reason === 'ok') metrics.record({ type: 'report', action: 'classified', category: c.category! });
    json(res, 200, { ...c, stored: false });
  };
  const reportCreate = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (reportLimited(clientIp(req))) return fail(res, 429, 'rate_limited');
    const b = await readJson(req, res, 900 * 1024); if (!b) return;
    const img = jpegFrom(b.image);
    if (img === 'bad' || typeof b.category !== 'string' || typeof b.areaType !== 'string' || !['bn', 'en'].includes(b.lang)
      || (b.description != null && typeof b.description !== 'string') || (b.lat != null && typeof b.lat !== 'number') || (b.lng != null && typeof b.lng !== 'number')) return fail(res, 400, 'bad_request');
    const sg = b.suggested && typeof b.suggested === 'object' ? { category: typeof b.suggested.category === 'string' ? b.suggested.category : null, confidence: typeof b.suggested.confidence === 'number' ? b.suggested.confidence : null } : undefined;
    const r = opts.reports!.create({ category: b.category, areaType: b.areaType, description: b.description, lat: b.lat, lng: b.lng, photo: img, suggested: sg, lang: b.lang, force: b.force === true });
    if (!r.ok) {
      if (r.error === 'similar_exists') { metrics.record({ type: 'report', action: 'similar_shown', category: b.category }); return json(res, 200, { created: false, similar: r.similar }); }
      return fail(res, r.error === 'photo_too_large' ? 413 : 400, r.error === 'photo_too_large' ? 'too_large' : 'bad_request');
    }
    metrics.record({ type: 'report', action: 'created', category: r.ticket.category, aiSuggested: !!sg?.category, aiAccepted: r.ticket.suggested.by === 'ai' });
    json(res, 200, { created: true, id: r.ticket.id, body: r.ticket.body, status: r.ticket.status, photoKept: !!r.ticket.photo, locationKept: r.ticket.lat != null });
  };
  const reportSupport = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (reportLimited(clientIp(req))) return fail(res, 429, 'rate_limited');
    const b = await readJson(req, res, 512); if (!b || typeof b.id !== 'string' || !CODE_RE.test(b.id)) return b ? fail(res, 400, 'bad_request') : undefined;
    const t = opts.reports!.support(b.id); if (!t) return fail(res, 404, 'not_found');
    metrics.record({ type: 'report', action: 'support', category: t.category }); json(res, 200, t);
  };
  const reportTrack = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (trackLimited(clientIp(req))) return fail(res, 429, 'rate_limited');
    const b = await readJson(req, res, 512); if (!b || typeof b.id !== 'string') return b ? fail(res, 400, 'bad_request') : undefined;
    const t = opts.reports!.track(b.id.trim().toUpperCase()); if (!t) return fail(res, 404, 'not_found'); json(res, 200, t);
  };

  // ---------- agency console ----------
  const agencyAuth = (req: http.IncomingMessage, res: http.ServerResponse): boolean => {
    if (!opts.agencyToken || !opts.reports) { fail(res, 404, 'not_found'); return false; }
    const ip = clientIp(req);
    if (agencyBlocked(ip)) { fail(res, 429, 'rate_limited'); return false; }
    const m = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''));
    if (!m || !sameToken(m[1], opts.agencyToken)) { agencyFailed(ip); res.setHeader('WWW-Authenticate', 'Bearer'); fail(res, 401, 'unauthorized'); return false; }
    if (agencyLimited(clientIp(req))) { fail(res, 429, 'rate_limited'); return false; }
    return true;
  };
  const agencyList = (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => {
    if (!agencyAuth(req, res)) return;
    const status = url.searchParams.get('status') ?? undefined, category = url.searchParams.get('category') ?? undefined;
    json(res, 200, { ...reportsConfig(), tickets: opts.reports!.list({ status, category }).map((t) => ({ ...t, hasPhoto: !!t.photo, photo: undefined })), summary: opts.reports!.publicSummary(1) });
  };
  const agencyStatus = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (!agencyAuth(req, res)) return;
    const b = await readJson(req, res, 2048); if (!b) return;
    if (typeof b.id !== 'string' || typeof b.status !== 'string' || (b.note != null && typeof b.note !== 'string')) return fail(res, 400, 'bad_request');
    const t = opts.reports!.setStatus(b.id, b.status, b.note ?? ''); if (!t) return fail(res, 404, 'not_found'); json(res, 200, { id: t.id, status: t.status, note: t.note });
  };

  const feedback = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (chatLimited(clientIp(req))) return fail(res, 429, 'rate_limited');
    const b = await readJson(req, res, 1024); if (!b) return;
    // Only fixed fields are accepted. There is deliberately no free-text comment, because free text invites personal data.
    if (typeof b !== 'object' || Array.isArray(b) || Object.keys(b).sort().join() !== 'helpful,kind,topic') return fail(res, 400, 'bad_request');
    if (!['answer', 'check'].includes(b.kind) || typeof b.helpful !== 'boolean' || typeof b.topic !== 'string' || !/^[A-Za-z0-9:_-]{1,60}$/.test(b.topic)) return fail(res, 400, 'bad_request');
    metrics.record({ type: 'feedback', kind: b.kind, helpful: b.helpful, topic: b.topic });
    json(res, 200, { ok: true });
  };

  const sameToken = (given: string, expected: string) => timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(expected).digest());
  const insights = (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (!opts.insightsToken) return fail(res, 404, 'not_found');
    if (insightsLimited(clientIp(req))) return fail(res, 429, 'rate_limited');
    const m = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''));
    if (!m || !sameToken(m[1], opts.insightsToken)) { res.setHeader('WWW-Authenticate', 'Bearer'); return fail(res, 401, 'unauthorized'); }
    json(res, 200, metrics.snapshot());
  };

  return http.createServer(async (req, res) => {
    const started = Date.now();
    if (opts.trustProxy && req.headers['x-forwarded-proto'] === 'https') res.setHeader('Strict-Transport-Security', 'max-age=15552000');
    const url = (req.url ?? '/').split('?')[0];
    res.on('finish', () => log(`${req.method} ${url} ${res.statusCode} ${Date.now() - started}ms`));   // never bodies, never IPs
    try {
      if (req.method === 'GET' && url === '/healthz') return json(res, 200, { ok: true });
      if (req.method === 'GET' && url === '/api/services') return json(res, 200, servicesView());
      if (req.method === 'POST' && url === '/api/check') return await check(req, res);
      if (req.method === 'POST' && url === '/api/chat') return await chat(req, res);
      if (req.method === 'POST' && url === '/api/feedback') return await feedback(req, res);
      if (req.method === 'GET' && url === '/api/insights') return insights(req, res);
      if (req.method === 'POST' && url === '/api/plain') return await plain(req, res);
      if (opts.reports) {
        if (req.method === 'GET' && url === '/api/reports/config') return json(res, 200, reportsConfig());
        if (req.method === 'GET' && url === '/api/reports/summary') return json(res, 200, opts.reports.publicSummary());
        if (req.method === 'POST' && url === '/api/reports/classify') return await reportClassify(req, res);
        if (req.method === 'POST' && url === '/api/reports') return await reportCreate(req, res);
        if (req.method === 'POST' && url === '/api/reports/support') return await reportSupport(req, res);
        if (req.method === 'POST' && url === '/api/reports/track') return await reportTrack(req, res);
        if (req.method === 'GET' && url === '/api/agency/tickets') return agencyList(req, res, new URL(req.url ?? '/', 'http://x'));
        if (req.method === 'POST' && url === '/api/agency/status') return await agencyStatus(req, res);
        if (req.method === 'GET' && url === '/api/agency/export.csv') { if (!agencyAuth(req, res)) return; return send(res, 200, opts.reports.csv(), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="kagojready-reports.csv"', 'Cache-Control': 'no-store' }); }
        const ph = /^\/api\/agency\/photo\/(KR-[A-Z0-9]{4}-[A-Z0-9]{4})$/.exec(url);
        if (req.method === 'GET' && ph) { if (!agencyAuth(req, res)) return; const b = opts.reports.photo(ph[1]); return b ? send(res, 200, b, 'image/jpeg', { 'Cache-Control': 'no-store' }) : fail(res, 404, 'not_found'); }
      }
      if (req.method === 'GET') {
        const name = url === '/' ? 'index.html' : normalize(url).replace(/^[/\\]+/, '');
        const full = join(publicDir, name);
        const ext = name.slice(name.lastIndexOf('.'));
        if (!name.includes('..') && full.startsWith(publicDir) && TYPES[ext] && existsSync(full))
          return send(res, 200, readFileSync(full), TYPES[ext], { 'Cache-Control': ext === '.woff2' ? 'public, max-age=86400' : 'no-cache' });
      }
      return fail(res, 404, 'not_found');
    } catch {
      if (!res.headersSent) fail(res, 500, 'server_error');
    }
  });
}
