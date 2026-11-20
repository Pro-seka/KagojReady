// Exports the hand-labelled cases to testdata/cases.json so the specimen generator renders exactly what the oracle expects.
import { writeFileSync } from 'node:fs';
import { buildSubmission, CASES } from './cases';

const NOT_RENDERABLE = new Set(['cross_script_romanization_differs']);   // models transliteration noise, not printed content
const out: unknown[] = [];
for (const c of CASES) {
  const sub = buildSubmission(c);
  const docs: Record<string, Record<string, { value: string | null; romanized?: string | null }> | null> = {};
  let renderable = !NOT_RENDERABLE.has(c.name);
  for (const [id, doc] of Object.entries(sub.docs)) {
    if (!doc) { docs[id] = null; continue; }
    docs[id] = {};
    for (const [k, f] of Object.entries(doc)) {
      if (!f) continue;
      if (!f.legible || f.confidence < 0.9) renderable = false;      // a smudged field is a photo property, not content
      docs[id]![k] = { value: f.value, romanized: f.romanized ?? null };
    }
  }
  if (renderable) out.push({ name: c.name, docs, expect: c.expect, verdict: c.verdict });
}
writeFileSync('testdata/cases.json', JSON.stringify(out, null, 1));
console.log(`exported ${out.length} renderable cases of ${CASES.length}`);
