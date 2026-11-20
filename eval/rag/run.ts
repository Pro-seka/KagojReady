import { readdirSync, readFileSync } from 'node:fs';
import { parsePack } from '../../src/pack/load';
import { buildKb, Retriever } from '../../src/kb/load';
import { detectOutOfScope, loadOutOfScope } from '../../src/assistant/scope';
import { DEV, DEV_OUT, HELD_OUT, HELD_OUT_2, HELD_OUT_2_OUT, HELD_OUT_OUT, type Q } from './queries';

/** The same decision the assistant makes: a question about a service we do not cover is refused before retrieval. */
const scope = loadOutOfScope();
const decide = (r: Retriever, q: string) => (detectOutOfScope(q, scope) ? [] : r.retrieve(q, 3));

export function evaluate(r: Retriever, set: Q[], out: string[]) {
  let hit = 0, rr = 0; const misses: string[] = [];
  for (const { q, accept } of set) {
    const ids = decide(r, q).map((x) => x.card.id); const pos = ids.findIndex((id) => accept.includes(id));
    if (pos >= 0) { hit++; rr += 1 / (pos + 1); } else misses.push(`${q}  ->  [${ids.join(', ') || 'refused'}]`);
  }
  const wrongAnswers = out.filter((q) => decide(r, q).length > 0);
  return { n: set.length, recallAt3: hit / set.length, mrr: rr / set.length, misses, outN: out.length, wronglyAnswered: wrongAnswers };
}
export function load() {
  const packs = readdirSync('packs').filter((f) => f.endsWith('.json')).map((f) => parsePack(JSON.parse(readFileSync(`packs/${f}`, 'utf8'))));
  return new Retriever(buildKb(packs));
}
if (process.argv[1]?.endsWith('rag/run.ts')) {
  const r = load();
  for (const [name, set, out] of [['development', DEV, DEV_OUT], ['dev 2', HELD_OUT, HELD_OUT_OUT], ['held-out', HELD_OUT_2, HELD_OUT_2_OUT]] as const) {
    const e = evaluate(r, set, out);
    console.log(`${name.padEnd(12)} ${e.n} questions: recall@3 ${(100 * e.recallAt3).toFixed(0)}%  MRR ${e.mrr.toFixed(2)}  | ${e.outN} out-of-scope: ${e.wronglyAnswered.length} wrongly answered`);
    e.misses.forEach((m) => console.log(`   miss: ${m}`)); e.wronglyAnswered.forEach((m) => console.log(`   WRONGLY ANSWERED: ${m}`));
  }
  const held = evaluate(r, HELD_OUT_2, HELD_OUT_2_OUT), dev = evaluate(r, DEV, DEV_OUT), dev2 = evaluate(r, HELD_OUT, HELD_OUT_OUT);
  process.exit(held.recallAt3 >= 0.8 && dev.recallAt3 >= 0.9 && held.wronglyAnswered.length + dev.wronglyAnswered.length + dev2.wronglyAnswered.length === 0 ? 0 : 1);
}
