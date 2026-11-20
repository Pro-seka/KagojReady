// Proves the production build runs with PRODUCTION dependencies only (no tsx, no dev tools), as it would on a real host.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fail = (m: string): never => { console.error('FAIL ' + m); process.exit(1); };
const run = (cmd: string, cwd: string) => spawnSync(cmd, { cwd, shell: true, encoding: 'utf8' });

let r = run('npm run build', process.cwd()); if (r.status !== 0) fail('build failed: ' + r.stderr.slice(0, 300));
const dir = mkdtempSync(join(tmpdir(), 'kr-prod-'));
for (const f of ['dist', 'packs', 'public', 'package.json', 'package-lock.json']) cpSync(f, join(dir, f), { recursive: true });
r = run('npm ci --omit=dev --no-audit --no-fund', dir); if (r.status !== 0) fail('npm ci --omit=dev failed: ' + r.stderr.slice(0, 300));
const tree = JSON.parse(run('npm ls --omit=dev --all --json', dir).stdout || '{}') as { dependencies?: Record<string, unknown> };
const mods = Object.keys(tree.dependencies ?? {});
const ALLOWED = ['zod'];
const extra = mods.filter((m) => !ALLOWED.includes(m));
if (extra.length || !mods.includes('zod')) fail(`production install should contain exactly [${ALLOWED}], found [${mods}]`);
const real = readdirSync(join(dir, 'node_modules')).flatMap((m) => m.startsWith('@') ? readdirSync(join(dir, 'node_modules', m)).map((x) => `${m}/${x}`) : [m]).filter((m) => !m.startsWith('.'));
if (real.some((m) => !ALLOWED.includes(m))) fail('unexpected packages on disk: ' + real.join());

const port = 3300 + Math.floor(Math.random() * 500);
const p = spawn('node', ['dist/server.mjs'], { cwd: dir, detached: true,
  env: { PATH: process.env.PATH!, NODE_ENV: 'production', ANTHROPIC_API_KEY: 'sk-fake', ALLOW_DRAFT_PACKS: '1', PORT: String(port) } });
let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
const kill = () => { try { process.kill(-p.pid!, 'SIGKILL'); } catch { /* gone */ } };
try {
  for (let i = 0; i < 60 && !/KagojReady on/.test(out); i++) await new Promise((res) => setTimeout(res, 250));
  if (!/KagojReady on/.test(out)) fail('server did not start: ' + out.slice(0, 300));
  const get = (path: string) => fetch(`http://127.0.0.1:${port}${path}`);
  if ((await get('/healthz')).status !== 200) fail('/healthz');
  const svc = await (await get('/api/services')).json() as { services: unknown[] }; if (svc.services.length < 2) fail('services missing');
  const home = await get('/'); if (home.status !== 200 || !/script-src 'self'/.test(home.headers.get('content-security-policy') ?? '')) fail('app shell / CSP');
  const bad = await fetch(`http://127.0.0.1:${port}/api/check`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  if (bad.status !== 400) fail('bad request not rejected: ' + bad.status);
  console.log(`PASS production build runs with production dependencies only (${real.join(', ')}); health, services, app shell, CSP and validation OK`);
} finally { kill(); rmSync(dir, { recursive: true, force: true }); }
