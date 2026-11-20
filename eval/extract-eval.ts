import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadPack } from '../src/pack/load';
import { extractDocument } from '../src/extract/extractor';
import { configureLlm } from '../src/extract/provider';
import { loadDotEnv } from '../src/config/env';
import { buildReport } from '../src/report/verdict';
import { compareNames } from '../src/normalize/names';
import { parseDate } from '../src/normalize/dates';
import { toAsciiDigits } from '../src/normalize/digits';
import type { LlmClient } from '../src/extract/types';
import type { ExtractedField, Submission } from '../src/types';

export interface SpecimenSet {
  id: string; case: string; profile: string; images: Record<string, string>;
  truth: Record<string, Record<string, { value: string | null; romanized?: string | null }> | null>;
  expect: Record<string, string>; verdict: 'READY' | 'ALMOST_READY' | 'NOT_READY';
}
const RANK = { NOT_READY: 0, ALMOST_READY: 1, READY: 2 } as const;
const DIR = 'testdata/specimens';
export const loadManifest = (): SpecimenSet[] => JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8'));
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** A perfect extractor that "reads" the answer key by recognizing the image bytes. Self-tests the harness only. */
export function oracleClient(manifest: SpecimenSet[]): LlmClient {
  const byHash = new Map<string, string>();
  for (const s of manifest) for (const [doc, rel] of Object.entries(s.images)) {
    const fields = Object.fromEntries(Object.entries(s.truth[doc] ?? {}).map(([k, v]) =>
      [k, { value: v.value, romanized: v.romanized ?? null, confidence: 0.95, legible: true }]));
    byHash.set(sha(readFileSync(`${DIR}/${rel}`)), JSON.stringify({ is_expected_document: true, fields }));
  }
  return { complete: async (req) => { const r = byHash.get(sha(Buffer.from(req.image!.base64, 'base64'))); if (!r) throw new Error('unknown image'); return r; } };
}

type Verdict = 'correct' | 'wrong' | 'unread' | 'skip';
export function judgeField(field: string, got: ExtractedField | undefined, truth: { value: string | null; romanized?: string | null } | undefined, min = 0.8): Verdict {
  if (!truth || truth.value === null) return got && got.legible && got.value ? 'wrong' : 'skip';   // invented a value that is not there
  if (!got || !got.legible || got.value == null || got.confidence < min) return 'unread';
  const t: ExtractedField = { value: truth.value, romanized: truth.romanized ?? null, confidence: 1, legible: true };
  if (['name', 'father_name', 'mother_name'].includes(field)) return compareNames(got, t)?.level === 'exact' ? 'correct' : 'wrong';
  if (['dob', 'expiry_date'].includes(field)) {
    const a = parseDate(got.value), b = parseDate(truth.value);
    return (a && b ? a === b : norm(got.value) === norm(truth.value)) ? 'correct' : 'wrong';
  }
  return norm(got.value) === norm(truth.value) ? 'correct' : 'wrong';
}
const norm = (s: string) => toAsciiDigits(s).replace(/\s+/g, '').toLowerCase();

export interface Bucket { sets: number; exact: number; falseReady: number; falsePass: number; falseAlarm: number; softened: number;
  fields: { correct: number; wrong: number; unread: number } }
const empty = (): Bucket => ({ sets: 0, exact: 0, falseReady: 0, falsePass: 0, falseAlarm: 0, softened: 0, fields: { correct: 0, wrong: 0, unread: 0 } });

export async function runExtractionEval(llm: LlmClient, manifest: SpecimenSet[], opts: { concurrency?: number; today?: string; packPath?: string } = {}) {
  const pack = loadPack(opts.packPath ?? 'packs/bd-passport-adult-renewal.json');
  const today = opts.today ?? '2026-10-20';
  const total = empty(); const byProfile: Record<string, Bucket> = {}; const problems: string[] = [];
  const queue = [...manifest];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const sub: Submission = { applicantType: 'adult', docs: {} };
      const fieldTally = { correct: 0, wrong: 0, unread: 0 };
      for (const d of pack.documents) {
        const rel = s.images[d.id]; if (!rel) continue;
        const dataUrl = `data:image/jpeg;base64,${readFileSync(`${DIR}/${rel}`).toString('base64')}`;
        const r = await extractDocument(llm, d, dataUrl);
        sub.docs[d.id] = r.doc;
        for (const f of d.fields) {
          const v = judgeField(f, r.doc?.[f], s.truth[d.id]?.[f]);
          if (v !== 'skip') fieldTally[v]++;
          if (v === 'wrong') problems.push(`${s.id}: ${d.id}.${f} misread with confidence`);
        }
      }
      const rep = buildReport(pack, sub, { today });
      const b = (byProfile[s.profile] ??= empty());
      for (const bucket of [total, b]) {
        bucket.sets++; bucket.fields.correct += fieldTally.correct; bucket.fields.wrong += fieldTally.wrong; bucket.fields.unread += fieldTally.unread;
        if (rep.verdict === s.verdict) bucket.exact++;
        if (s.verdict !== 'READY' && rep.verdict === 'READY') { bucket.falseReady++; problems.push(`${s.id}: FALSE READY`); }
        if (s.verdict === 'READY' && rep.verdict !== 'READY') bucket.falseAlarm++;
        if (s.verdict === 'NOT_READY' && rep.verdict === 'ALMOST_READY') bucket.softened++;
        for (const r of rep.results) if ((s.expect[r.ruleId] ?? 'PASS') !== 'PASS' && r.outcome === 'PASS') { bucket.falsePass++; problems.push(`${s.id}: ${r.ruleId} FALSE PASS`); }
      }
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? 1 }, worker));
  return { total, byProfile, problems };
}

// ---------------- CLI ----------------
const isMain = process.argv[1]?.endsWith('extract-eval.ts');
if (isMain) {
  const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
  const mode = arg('mode') ?? 'oracle';
  let manifest = loadManifest();
  if (arg('profile')) manifest = manifest.filter((s) => s.profile === arg('profile'));
  if (arg('limit')) manifest = manifest.slice(0, Number(arg('limit')));
  let llm: LlmClient; let model = 'oracle'; let provider = 'oracle'; let tier = 'n/a'; let concurrency = 1;
  if (mode === 'live') {
    loadDotEnv();
    let cfg: ReturnType<typeof configureLlm> = null;
    try { cfg = configureLlm(process.env); } catch (e) { console.error((e as Error).message); process.exit(2); }
    if (!cfg) { console.error('No AI key found. Add GEMINI_API_KEY (free: https://aistudio.google.com/apikey) or ANTHROPIC_API_KEY to .env, then run again.'); process.exit(2); }
    llm = cfg.client; model = cfg.model; provider = cfg.provider; tier = cfg.tier; concurrency = Number(process.env.LLM_CONCURRENCY ?? 3);
    const calls = manifest.reduce((n, s) => n + Object.keys(s.images).length, 0);
    console.log(`LIVE run: ${calls} API calls via ${provider} (${model}, ${tier === 'n/a' ? 'paid' : tier} tier). Only synthetic SPECIMEN photos are sent.`);
    if (cfg.minIntervalMs) console.log(`Pacing to ${Math.round(60_000 / cfg.minIntervalMs)} requests a minute: about ${Math.ceil((calls * cfg.minIntervalMs) / 60_000)} minutes. Raise LLM_MAX_RPM if your limit is higher.`);
  } else llm = oracleClient(manifest);
  const t0 = Date.now();
  const res = await runExtractionEval(llm, manifest, { concurrency });
  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(0)}%` : 'n/a');
  console.log(`\nExtraction evaluation | mode: ${mode} | ${provider} ${llm.stats?.modelVersion ?? model} | ${res.total.sets} sets\n`);
  console.log('profile'.padEnd(12), 'sets'.padStart(4), 'exact'.padStart(6), 'falseREADY'.padStart(11), 'falsePASS'.padStart(10), 'falseAlarm'.padStart(11), 'fields ok'.padStart(10), 'misread'.padStart(8), 'unread'.padStart(7));
  for (const [name, b] of [...Object.entries(res.byProfile), ['TOTAL', res.total] as const]) {
    const judged = b.fields.correct + b.fields.wrong + b.fields.unread;
    console.log(name.padEnd(12), String(b.sets).padStart(4), pct(b.exact, b.sets).padStart(6), String(b.falseReady).padStart(11), String(b.falsePass).padStart(10),
      String(b.falseAlarm).padStart(11), pct(b.fields.correct, judged).padStart(10), String(b.fields.wrong).padStart(8), String(b.fields.unread).padStart(7));
  }
  res.problems.slice(0, 15).forEach((p) => console.log('  !', p));
  const st = llm.stats; if (st) console.log(`\nAPI usage: ${st.calls} calls, ${st.inputTokens} input tokens, ${st.outputTokens} output tokens (multiply by your current price to get cost)`);
  mkdirSync('eval/results', { recursive: true });
  const file = `eval/results/${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(file, JSON.stringify({ mode, provider, tier, model, modelResolved: st?.modelVersion ?? null, date: new Date().toISOString(), seconds: (Date.now() - t0) / 1000, usage: st ?? null, ...res }, null, 1));
  console.log(`\nSaved ${file}`);
  process.exit(res.total.falseReady + res.total.falsePass === 0 ? 0 : 1);
}
