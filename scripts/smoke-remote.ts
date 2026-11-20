import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runSmoke } from '../src/ops/smoke';

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:\/\//.test(a));
const flag = (n: string) => args.includes(`--${n}`);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'evidence/deployment.json';
if (!url) { console.error('Usage: npm run smoke -- https://your-host [--with-rate-limit] [--out file] [--allow-http (local testing only)]'); process.exit(2); }
const r = await runSmoke(url, { allowHttp: flag('allow-http'), rateLimitTest: flag('with-rate-limit') });
for (const c of r.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : '  -> ' + c.detail}`);
console.log(`\npacks served: ${r.packs.map((p) => `${p.id} (${p.status})`).join(', ') || 'none'}`);
if (r.demo) console.log('NOTE: demo mode detected. Evidence file not written.');
else { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(r, null, 2)); console.log(`Saved ${out}${r.https ? '' : ' (not HTTPS: this cannot satisfy the deployment gate)'}`); }
process.exit(r.all_passed ? 0 : 1);
