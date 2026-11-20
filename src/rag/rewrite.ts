import { tokenize } from './tokenize';
import { editDistance, allowedSlips } from './fuzzy';
import { fromBanglish, isRomanFiller } from './banglish';

export interface Rewrite { text: string; typos: Array<{ from: string; to: string }>; romanized: Array<{ from: string; to: string }> }
export interface Vocab { has(term: string): boolean; vocabulary(): ReadonlyMap<string, number> }

const script = (t: string) => (/^[\u0980-\u09FF]+$/.test(t) ? 'bn' : /^[a-z]+$/.test(t) ? 'en' : 'other');

/**
 * Makes a noisy question searchable without ever inventing words: romanized Bangla is mapped to the Bangla word it most likely means,
 * and a word the knowledge base has never seen is replaced by the closest known word only when it is a small slip away.
 * Words that stay unknown still count against coverage, so a question about something else is still refused.
 */
export function rewriteQuery(query: string, vocab: Vocab, synonyms: (t: string) => string[]): Rewrite {
  const typos: Rewrite['typos'] = [], romanized: Rewrite['romanized'] = [];
  let df: ReadonlyMap<string, number> | null = null;
  const known = (t: string) => vocab.has(t) || synonyms(t).length > 1;
  const out: string[] = [];
  for (const t of tokenize(query)) {
    if (known(t) || /^\d+$/.test(t)) { out.push(t); continue; }
    if (script(t) === 'en') {
      if (isRomanFiller(t)) continue;
      const bn = fromBanglish(t);
      if (bn) { romanized.push({ from: t, to: bn }); out.push(...tokenize(bn)); continue; }
    }
    const sc = script(t), slips = allowedSlips(t.length);
    if (slips > 0 && sc !== 'other') {
      df ??= vocab.vocabulary();
      let best: { w: string; d: number; n: number } | null = null;
      for (const [w, n] of df) {
        if (script(w) !== sc || Math.abs(w.length - t.length) > slips) continue;
        const d = editDistance(t, w, slips); if (d > slips) continue;
        if (!best || d < best.d || (d === best.d && n > best.n)) best = { w, d, n };
      }
      if (best) { typos.push({ from: t, to: best.w }); out.push(best.w); continue; }
    }
    out.push(t);
  }
  return { text: out.join(' '), typos, romanized };
}
