import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parsePack } from '../src/pack/load';
import { validatePackSet } from '../src/pack/set';
import { loadDir, loadFile } from '../src/evidence/load';
import { Deployment, DeviceTest, HostLogCheck, Interview, LegalReview, UserTest } from '../src/evidence/schema';
import { deploymentGate, deviceGate, hostLogsGate, interviewsGate, legalGate, nrbGate, userTestsGate, type GateResult } from '../src/evidence/gates';

type Status = 'PASS' | 'FAIL' | 'PENDING';
const gates: Array<{ gate: string; status: Status; detail: string; auto: boolean }> = [];
const add = (gate: string, status: Status, detail: string, auto: boolean) => gates.push({ gate, status, detail, auto });
const sh = (cmd: string) => spawnSync(cmd, { shell: true, encoding: 'utf8' });
const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
const today = new Date().toISOString().slice(0, 10);
const MAX_CONFIDENT_MISREAD = 0.01;      // proposed threshold: tighten once real results are in

// ---- automatic gates ----
const tc = sh('npx tsc --noEmit');
add('Type check clean', tc.status === 0 ? 'PASS' : 'FAIL', tc.status === 0 ? 'tsc: no errors' : tc.stdout.slice(0, 200), true);

const ut = sh('npx vitest run');
const m = /Tests\s+(\d+) passed/.exec(plain(ut.stdout)); const files = /Test Files\s+(\d+) passed/.exec(plain(ut.stdout));
add('Tests pass (engine, extraction, server, UI, start-up guards, harness)', ut.status === 0 ? 'PASS' : 'FAIL',
  ut.status === 0 ? `${m?.[1] ?? '?'} tests in ${files?.[1] ?? '?'} files` : `failing: ${plain(ut.stdout + ut.stderr).split('\n').filter((l) => /FAIL |×/.test(l)).slice(0, 3).join(' | ').replace(/\s+/g, ' ').slice(0, 260) || 'unknown'}`, true);

const ev = sh('npx tsx eval/run.ts');
const g = (k: string) => new RegExp(`${k}:\\s+(\\d+)`).exec(ev.stdout)?.[1] ?? '?';
add('Decision-layer eval: 0 mismatches, 0 false passes', ev.status === 0 ? 'PASS' : 'FAIL',
  `${g('cases')} cases, ${g('rule mismatches')} mismatches, ${g('FALSE PASSES')} false passes (structured inputs, not photos)`, true);

// Real browser: real Chromium drives the real UI against the real server code (fake model). Run fresh every time.
const e2e = sh('npx tsx e2e/run.ts');
const e2eMatch = /(\d+)\/(\d+) checks passed in (Chromium [\d.]+)/.exec(e2e.stdout);
add('Real-browser end-to-end: UI flow, accessibility (WCAG AA), CSP, privacy, EXIF stripping',
  e2eMatch ? (e2e.status === 0 ? 'PASS' : 'FAIL') : 'PENDING',
  e2eMatch ? `${e2eMatch[1]}/${e2eMatch[2]} checks in ${e2eMatch[3]} (headless Linux with mobile emulation, not a real phone)` : 'browser could not start: ' + (e2e.stderr || e2e.stdout).slice(0, 160), true);

const vb = sh('npx tsx scripts/verify-build.ts');
add('Production build runs with production dependencies only', vb.status === 0 ? 'PASS' : 'FAIL',
  vb.status === 0 ? plain(vb.stdout).split('\n').filter((l) => l.startsWith('PASS')).join('').slice(5, 140) : plain(vb.stdout + vb.stderr).slice(0, 200), true);

const au = sh('npm audit --omit=dev --json');
try {
  const v = JSON.parse(au.stdout).metadata.vulnerabilities as Record<string, number>;
  const bad = (v.high ?? 0) + (v.critical ?? 0);
  add('No known high or critical vulnerabilities in runtime dependencies', bad === 0 ? 'PASS' : 'FAIL',
    `runtime deps: ${Object.entries(v).filter(([k]) => k !== 'total').map(([k, n]) => `${k} ${n}`).join(', ')}`, true);
} catch { add('No known high or critical vulnerabilities in runtime dependencies', 'PENDING', 'npm audit could not run (offline?)', true); }

// Retrieval quality and abstention on three labelled question sets, run fresh. Small hand-written sets: a regression guard, not a benchmark.
const rag = sh('npx tsx eval/rag/run.ts'); const ragOut = plain(rag.stdout);
const ragLine = (name: string) => new RegExp(`^${name}\\s+(\\d+) questions: recall@3 (\\d+)%.*?\\| (\\d+) out-of-scope: (\\d+) wrongly`, 'm').exec(ragOut);
const [rd, rh] = [ragLine('development'), ragLine('held-out')];
add('Assistant retrieval: held-out recall@3 at least 85%, no out-of-scope question answered', rag.status === 0 && rd && rh ? 'PASS' : 'FAIL',
  rd && rh ? `held-out ${rh[2]}% (${rh[1]} questions), development ${rd[2]}% (${rd[1]}); ${(+rd[4]) + (+rh[4])} of ${(+rd[3]) + (+rh[3])} out-of-scope questions answered` : ragOut.slice(0, 200), true);

const ragLive = existsSync('eval/results') ? readdirSync('eval/results').filter((f) => f.startsWith('rag-live-')).sort().pop() : undefined;
if (!ragLive) add('Live grounded answers on a real model: 60+ questions, 0 out-of-scope answered, 70%+ pass the checks', 'PENDING', 'no live run yet. Run: npm run eval:rag-live', true);
else {
  const r = JSON.parse(readFileSync(`eval/results/${ragLive}`, 'utf8'));
  const ok = r.inScope >= 60 && r.outOfScopeAnswered === 0 && r.groundedRate >= 0.7;
  add('Live grounded answers on a real model: 60+ questions, 0 out-of-scope answered, 70%+ pass the checks', ok ? 'PASS' : 'FAIL',
    `${ragLive}: ${r.provider} ${r.modelResolved ?? r.model}${r.tier === 'free' ? ' (free tier)' : ''}, ${r.inScope} questions, ${Math.round(100 * r.groundedRate)}% passed, rejections ${JSON.stringify(r.rejected)}, out-of-scope answered ${r.outOfScopeAnswered}`, true);
}

// Noisy input (typos, romanized Bangla, Bangla spelling slips) and near-miss off-topic questions. Written before the typo layers were built.
const noisy = sh('npx tsx eval/rag/noisy-run.ts'); const nm = /noisy set (\d+) questions: recall@3 (\d+)%.*?\| (\d+) out-of-scope: (\d+) wrongly/.exec(plain(noisy.stdout));
add('Noisy-input retrieval: recall@3 at least 90%, no off-topic question answered', nm && +nm[2] >= 90 && +nm[4] === 0 ? 'PASS' : 'FAIL', nm ? `${nm[2]}% on ${nm[1]} typo / romanized / spelling-variant questions; ${nm[4]} of ${nm[3]} off-topic answered` : plain(noisy.stdout + noisy.stderr).slice(0, 200), true);

// Things only a person can confirm. They stay PENDING until someone named signs them off in the file.
try {
  const routing = JSON.parse(readFileSync('kb/report-routing.json', 'utf8')); const gloss = JSON.parse(readFileSync('kb/glossary.json', 'utf8'));
  add('Civic report routing table confirmed by a named local-government officer', routing.verified_by ? 'PASS' : 'PENDING', routing.verified_by ? `verified by ${routing.verified_by}` : 'kb/report-routing.json is DRAFT_UNVERIFIED: it is a draft from general knowledge. Needed before any pilot.', false);
  add('Plain-language glossary reviewed by a legal-language editor', gloss.reviewed_by ? 'PASS' : 'PENDING', gloss.reviewed_by ? `reviewed by ${gloss.reviewed_by}` : `${gloss.entries.length} entries written by the team, not yet reviewed (kb/glossary.json reviewed_by is empty)`, false);
} catch (e) { add('Report routing and glossary files load', 'FAIL', String(e).slice(0, 160), true); }

let sets = 0;
try { sets = JSON.parse(readFileSync('testdata/specimens/manifest.json', 'utf8')).length; } catch { /* missing */ }
add('Specimen photo set has 30+ sets', sets >= 30 ? 'PASS' : 'FAIL', `${sets} sets`, true);

let packsOk = true; const packNotes: string[] = []; const packs = [];
for (const file of readdirSync('packs').filter((x) => x.endsWith('.json'))) {
  try {
    const p = parsePack(JSON.parse(readFileSync(`packs/${file}`, 'utf8'))); packs.push(p);
    if (p.status !== 'VERIFIED') { packsOk = false; packNotes.push(`${p.pack_id}: ${p.status}`); }
    else if (p.review_by! < today) { packsOk = false; packNotes.push(`${p.pack_id}: stale (review_by ${p.review_by})`); }
    const weak = p.rules.filter((r) => r.rule_status === 'unconfirmed').length;
    if (weak) packNotes.push(`${p.pack_id}: ${weak}/${p.rules.length} rules unconfirmed`);
  } catch { packsOk = false; packNotes.push(`${file}: invalid`); }
}
const links = validatePackSet(packs); if (links.length) { packsOk = false; packNotes.push(...links); }
add('All packs valid, linked, VERIFIED and not stale', packsOk ? 'PASS' : 'FAIL', packNotes.join('; ') || 'ok', true);

// Live extraction accuracy is derived from an evidence file written by `npm run eval:live`, never from a checkbox.
const live = existsSync('eval/results') ? readdirSync('eval/results').filter((f) => f.startsWith('live-')).sort().pop() : undefined;
if (!live) add('Live extraction eval on real model: 30+ sets, 0 false READY, 0 false passes', 'PENDING',
  'no live run yet. Run: ANTHROPIC_API_KEY=... npm run eval:live', true);
else {
  const r = JSON.parse(readFileSync(`eval/results/${live}`, 'utf8'));
  const t = r.total, judged = t.fields.correct + t.fields.wrong + t.fields.unread, misread = judged ? t.fields.wrong / judged : 1;
  const ok = t.sets >= 30 && t.falseReady === 0 && t.falsePass === 0 && misread <= MAX_CONFIDENT_MISREAD;
  add('Live extraction eval on real model: 30+ sets, 0 false READY, 0 false passes', ok ? 'PASS' : 'FAIL',
    `${live}: ${r.provider ?? 'anthropic'} ${r.modelResolved ?? r.model}${r.tier === 'free' ? ' (free tier)' : ''}, ${t.sets} sets, falseREADY ${t.falseReady}, falsePASS ${t.falsePass}, confident misreads ${(100 * misread).toFixed(1)}% (max ${100 * MAX_CONFIDENT_MISREAD}%)`, true);
}

// ---- evidence gates: each reads structured files from evidence/. See evidence/README.md ----
const dayNow = new Date().toISOString().slice(0, 10);
const interviews = loadDir('evidence/interviews', Interview);
const userTests = loadDir('evidence/user-tests', UserTest);
const evidenceGates: Array<[string, GateResult]> = [
  ['Interviews: 2+ recorded, at least one with an operator', interviewsGate(interviews, dayNow)],
  ['User tests: 10+ recorded, 70% finish unaided, no wrong READY', userTestsGate(userTests, dayNow)],
  ['NRB participant in a recorded test', nrbGate(userTests, dayNow)],
  ['Real Android phone, slow network, all steps pass', deviceGate(loadDir('evidence/device-tests', DeviceTest), dayNow)],
  ['Deployed over HTTPS and smoke-tested (npm run smoke)', deploymentGate(loadFile('evidence/deployment.json', Deployment), dayNow)],
  ['Host logs reviewed: no personal data', hostLogsGate(loadFile('evidence/host-log-check.json', HostLogCheck), dayNow)],
  ['Legal and privacy review', legalGate(loadFile('evidence/legal-review.json', LegalReview), dayNow)],
];
for (const [name, r] of evidenceGates) add(name, r.status, r.detail, false);

// ---- report ----
const icon = { PASS: 'PASS   ', FAIL: 'FAIL   ', PENDING: 'PENDING' };
console.log('KagojReady production-readiness gates\n');
for (const x of gates) console.log(`  [${icon[x.status]}] ${x.gate}${x.auto ? '' : '  (evidence)'}\n            ${x.detail}`);
const failing = gates.filter((x) => x.status !== 'PASS');
console.log(`\n${gates.length - failing.length}/${gates.length} gates passed.`);
console.log(failing.length === 0 ? 'RECOMMENDATION: GO' : `RECOMMENDATION: NO-GO (${failing.length} gate(s) open)`);
process.exit(failing.length === 0 ? 0 : 1);
