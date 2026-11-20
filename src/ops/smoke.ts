import http from 'node:http';
import https from 'node:https';

export interface SmokeCheck { name: string; ok: boolean; detail: string }
export interface SmokeResult {
  tool: 'smoke-remote@1'; date: string; url: string; https: boolean; demo: boolean;
  packs: Array<{ id: string; status: string }>; checks: SmokeCheck[]; all_passed: boolean;
}

const rawGet = (base: URL, path: string) => new Promise<number>((resolve, reject) => {
  const lib = base.protocol === 'https:' ? https : http;
  lib.get({ host: base.hostname, port: base.port || undefined, path }, (r) => { r.resume(); resolve(r.statusCode ?? 0); }).on('error', reject);
});

export async function runSmoke(urlStr: string, opts: { allowHttp?: boolean; rateLimitTest?: boolean } = {}): Promise<SmokeResult> {
  const base = new URL(urlStr), isHttps = base.protocol === 'https:';
  const checks: SmokeCheck[] = [];
  const add = (name: string, ok: boolean, detail = '') => checks.push({ name, ok, detail: ok ? '' : detail });
  let demo = false; let packs: SmokeResult['packs'] = [];
  const at = (p: string, init?: RequestInit) => fetch(new URL(p, base), init);

  add('served over HTTPS', isHttps || !!opts.allowHttp, 'plain http is not acceptable for a deployment');
  try {
    const h = await at('/healthz'); add('health endpoint answers', h.status === 200, `status ${h.status}`);
    const sv = await at('/api/services'); const body = (await sv.json()) as { demo?: boolean; llm?: { provider?: string; tier?: string } | null; services?: Array<{ id: string; status: string }> };
    demo = !!body.demo; packs = (body.services ?? []).map((s) => ({ id: s.id, status: s.status }));
    add('not running in demo mode', body.demo === false, 'demo mode does not read photos');
    add('AI provider is not on a free tier (free tiers may use photos to improve products)', body.llm?.tier !== 'free', `${body.llm?.provider} free tier`);
    add('at least one service is offered', packs.length >= 1, 'no services');
    add('API responses are not cacheable', (sv.headers.get('cache-control') ?? '').includes('no-store'), String(sv.headers.get('cache-control')));
    const home = await at('/'); const csp = home.headers.get('content-security-policy') ?? '';
    add('strict Content-Security-Policy', /script-src 'self'/.test(csp) && !/unsafe-inline|unsafe-eval/.test(csp) && /frame-ancestors 'none'/.test(csp), csp.slice(0, 120));
    add('nosniff and no-referrer headers', home.headers.get('x-content-type-options') === 'nosniff' && home.headers.get('referrer-policy') === 'no-referrer', 'missing');
    if (isHttps) add('HSTS header on HTTPS', !!home.headers.get('strict-transport-security'), 'missing (set TRUST_PROXY=1 behind a proxy)');
    const leaks: string[] = [];
    for (const p of ['/', '/app.js', '/app.css']) { const t = await (await at(p)).text(); if (/sk-ant-[A-Za-z0-9_-]{8,}|ANTHROPIC_API_KEY/.test(t)) leaks.push(p); }
    add('no API key in anything served to browsers', leaks.length === 0, leaks.join());
    const bad = await at('/api/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const badText = await bad.text();
    add('bad requests get a clean 400 with no stack trace', bad.status === 400 && !/\bat .*\(.*:\d+:\d+\)|node_modules|Error:/.test(badText), `status ${bad.status}`);
    const nf = await at('/definitely-not-here'); add('unknown paths return 404', nf.status === 404, `status ${nf.status}`);
    const trav = await Promise.all(['/../package.json', '/..%2fpackage.json', '/fonts/../../package.json'].map((p) => rawGet(base, p)));
    add('path traversal is blocked', trav.every((c) => c === 404), trav.join());
    if (opts.rateLimitTest) {
      const codes: number[] = []; for (let i = 0; i < 25; i++) codes.push((await at('/api/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status);
      add('rate limiting engages', codes.includes(429), 'no 429 after 25 requests (is TRUST_PROXY set correctly?)');
    }
  } catch (e) { add('site is reachable and behaves', false, (e as Error).message.slice(0, 120)); }
  return { tool: 'smoke-remote@1', date: new Date().toISOString(), url: base.origin, https: isHttps, demo, packs, checks, all_passed: checks.every((c) => c.ok) };
}
