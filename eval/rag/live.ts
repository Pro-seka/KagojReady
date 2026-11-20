import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadDotEnv } from '../../src/config/env';
import { configureLlm } from '../../src/extract/provider';
import { parsePack } from '../../src/pack/load';
import { buildKb, Retriever } from '../../src/kb/load';
import { runRagLive } from '../../src/ops/rag-live';
import { DEV, DEV_OUT, HELD_OUT, HELD_OUT_2, HELD_OUT_2_OUT, HELD_OUT_OUT } from './queries';

loadDotEnv();
let cfg: ReturnType<typeof configureLlm> = null;
try { cfg = configureLlm(process.env); } catch (e) { console.error((e as Error).message); process.exit(2); }
if (!cfg) { console.error('No AI key found. Add GEMINI_API_KEY (free: https://aistudio.google.com/apikey) or ANTHROPIC_API_KEY to .env, then run again.'); process.exit(2); }
const packs = readdirSync('packs').filter((f) => f.endsWith('.json')).map((f) => parsePack(JSON.parse(readFileSync(`packs/${f}`, 'utf8'))));
const inScope = [...DEV, ...HELD_OUT, ...HELD_OUT_2].map((x) => x.q), outOfScope = [...DEV_OUT, ...HELD_OUT_OUT, ...HELD_OUT_2_OUT];
console.log(`LIVE grounded-answer run: about ${inScope.length} model calls via ${cfg.provider} (${cfg.model}, ${cfg.tier === 'n/a' ? 'paid' : cfg.tier} tier). Only sample questions are sent.`);
if (cfg.minIntervalMs) console.log(`Pacing to ${Math.round(60_000 / cfg.minIntervalMs)} requests a minute: about ${Math.ceil((inScope.length * cfg.minIntervalMs) / 60_000)} minutes.`);
const t0 = Date.now();
const r = await runRagLive({ llm: cfg.client, retriever: new Retriever(buildKb(packs)), services: packs.map((p) => ({ id: p.pack_id })), inScope, outOfScope });
console.log(`\nGrounded-answer evaluation | ${cfg.provider} ${cfg.client.stats?.modelVersion ?? cfg.model}\n`);
console.log(`  in-scope questions:       ${r.inScope}   (refused: ${r.inScopeRefused})`);
console.log(`  answered by the model and passed every check: ${r.modes.grounded}   shown from sources instead: ${r.modes.extractive}   -> ${(100 * r.groundedRate).toFixed(0)}% passed`);
console.log(`  answers rejected by the checks: ${JSON.stringify(r.rejected)}   model failures: ${r.llmFailures}`);
console.log(`  out-of-scope questions:   ${r.outOfScope}   wrongly answered: ${r.outOfScopeAnswered}`);
const st = cfg.client.stats; if (st) console.log(`\nAPI usage: ${st.calls} calls, ${st.inputTokens} input tokens, ${st.outputTokens} output tokens`);
mkdirSync('eval/results', { recursive: true });
const file = `eval/results/rag-live-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(file, JSON.stringify({ provider: cfg.provider, tier: cfg.tier, model: cfg.model, modelResolved: st?.modelVersion ?? null, date: new Date().toISOString(), seconds: (Date.now() - t0) / 1000, usage: st ?? null, ...r }, null, 1));
console.log(`\nSaved ${file}`);
process.exit(r.outOfScopeAnswered === 0 && r.groundedRate >= 0.7 ? 0 : 1);
