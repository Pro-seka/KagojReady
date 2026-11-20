import { afterAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/server/app';
import { loadPack } from '../src/pack/load';
import { runSmoke } from '../src/ops/smoke';
import { deploymentGate } from '../src/evidence/gates';
import { Deployment } from '../src/evidence/schema';
import { fakeLlm } from './helpers';

const servers: http.Server[] = [];
const listen = (s: http.Server) => new Promise<string>((r) => { servers.push(s); s.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${(s.address() as AddressInfo).port}`)); });
afterAll(() => servers.forEach((s) => s.close()));
const pack = loadPack('packs/bd-passport-adult-renewal.json');
const real = (o: object = {}) => createApp({ llm: fakeLlm(), packs: [pack], log: () => {}, ...o });

describe('deployment smoke test', () => {
  it('passes against the real server, and local http can never satisfy the deployment gate', async () => {
    const url = await listen(real());
    const r = await runSmoke(url, { allowHttp: true, rateLimitTest: true });
    expect(r.checks.filter((c) => !c.ok)).toEqual([]); expect(r.all_passed).toBe(true); expect(r.https).toBe(false);
    const g = deploymentGate({ file: 'x', ok: true, data: Deployment.parse({ ...r, demo: false }) }, new Date().toISOString().slice(0, 10));
    expect(g.status).toBe('FAIL'); expect(g.detail).toMatch(/HTTPS/);
  });
  it('refuses plain http by default', async () => {
    const r = await runSmoke(await listen(real()));
    expect(r.checks.find((c) => c.name === 'served over HTTPS')!.ok).toBe(false); expect(r.all_passed).toBe(false);
  });
  it('detects demo mode', async () => {
    const r = await runSmoke(await listen(real({ demo: true })), { allowHttp: true });
    expect(r.demo).toBe(true); expect(r.checks.find((c) => c.name === 'not running in demo mode')!.ok).toBe(false);
  });
  it('CATCHES a badly configured site: weak CSP, leaked key, stack traces, traversal, no 404', async () => {
    const bad = http.createServer((req, res) => {
      const u = req.url ?? '/';
      if (u === '/healthz') return void res.end('{"ok":true}');
      if (u === '/api/services') return void res.end(JSON.stringify({ demo: false, services: [{ id: 'x', status: 'VERIFIED' }] }));
      if (u === '/api/check') { res.statusCode = 500; return void res.end('Error: boom\n    at handler (/srv/node_modules/x/index.js:10:5)'); }
      if (u.includes('..')) return void res.end('root:x:0:0');
      res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline'"); res.end('<script>const k="sk-ant-api03-AAAAAAAAAAAA"</script>');
    });
    const r = await runSmoke(await listen(bad), { allowHttp: true });
    const failed = r.checks.filter((c) => !c.ok).map((c) => c.name);
    for (const n of ['strict Content-Security-Policy', 'nosniff and no-referrer headers', 'no API key in anything served to browsers', 'bad requests get a clean 400 with no stack trace',
      'API responses are not cacheable', 'unknown paths return 404', 'path traversal is blocked']) expect(failed, n).toContain(n);
    expect(r.all_passed).toBe(false);
  });
  it('reports an unreachable site instead of crashing', async () => {
    const r = await runSmoke('http://127.0.0.1:1', { allowHttp: true }); expect(r.all_passed).toBe(false);
  });
});

describe('HSTS', () => {
  const hdr = async (o: object, headers: Record<string, string>) => (await fetch(await listen(real(o)) + '/', { headers })).headers.get('strict-transport-security');
  it('is sent only when behind a trusted proxy that reports HTTPS', async () => {
    expect(await hdr({ trustProxy: true }, { 'x-forwarded-proto': 'https' })).toBe('max-age=15552000');
    expect(await hdr({ trustProxy: true }, {})).toBeNull();
    expect(await hdr({}, { 'x-forwarded-proto': 'https' })).toBeNull();
  });
});
