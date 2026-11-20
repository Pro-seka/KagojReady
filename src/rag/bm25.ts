import { tokenize } from './tokenize';

export interface Indexable { id: string; title: string; text: string; tags?: string[] }
export interface Hit { id: string; index: number; score: number; matched: number; coverage: number }

/** BM25 over an inverted index. Handles tens of thousands of passages in milliseconds. */
export class Bm25Index {
  private postings = new Map<string, Array<[number, number]>>();
  private lengths: number[] = [];
  private avg = 0;
  readonly size: number;
  private k1: number; private b: number;
  constructor(private docs: Indexable[], private o: { k1?: number; b?: number; expand?: (term: string) => string[] } = {}) {
    this.k1 = o.k1 ?? 1.2; this.b = o.b ?? 0.75;
    this.size = docs.length;
    docs.forEach((d, i) => {
      const tokens = [...tokenize(d.title), ...tokenize(d.title), ...tokenize(d.text), ...tokenize((d.tags ?? []).join(' '))];   // the title counts double
      this.lengths.push(tokens.length);
      const tf = new Map<string, number>(); for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const [t, n] of tf) { const p = this.postings.get(t); if (p) p.push([i, n]); else this.postings.set(t, [[i, n]]); }
    });
    this.avg = this.lengths.reduce((a, b) => a + b, 0) / Math.max(1, this.size);
  }
  /** Every indexed word with the number of passages containing it. Used to spot likely typos. */
  vocabulary(): ReadonlyMap<string, number> { return new Map([...this.postings].map(([t, p]) => [t, p.length])); }
  has(term: string): boolean { return this.postings.has(term); }
  private scoreBuf = new Float64Array(0); private bestBuf = new Float64Array(0); private matchBuf = new Uint16Array(0);
  search(query: string, k = 5): Hit[] {
    const terms = [...new Set(tokenize(query))]; if (!terms.length) return [];
    if (this.scoreBuf.length !== this.size) { this.scoreBuf = new Float64Array(this.size); this.bestBuf = new Float64Array(this.size); this.matchBuf = new Uint16Array(this.size); }
    const score = this.scoreBuf, best = this.bestBuf, matched = this.matchBuf; const touched: number[] = [];
    for (const t of terms) {
      // A query word and its synonyms count as one term: each document keeps its best score among them and matches the term once.
      const inGroup: number[] = [];
      for (const m of this.o.expand ? this.o.expand(t) : [t]) {
        const p = this.postings.get(m); if (!p) continue;
        const idf = Math.log(1 + (this.size - p.length + 0.5) / (p.length + 0.5)), weight = (m === t ? 1 : 0.85) * idf * (this.k1 + 1);   // a synonym counts a little less
        for (let j = 0; j < p.length; j++) {
          const i = p[j][0], tf = p[j][1];
          const v = (weight * tf) / (tf + this.k1 * (1 - this.b + (this.b * this.lengths[i]) / this.avg));
          if (best[i] === 0) inGroup.push(i);
          if (v > best[i]) best[i] = v;
        }
      }
      for (const i of inGroup) { if (score[i] === 0 && matched[i] === 0) touched.push(i); score[i] += best[i]; matched[i]++; best[i] = 0; }
    }
    // keep only the best k: a small insertion list instead of sorting every touched document
    const top: number[] = [];
    for (const i of touched) {
      if (top.length < k || score[i] > score[top[top.length - 1]]) {
        let pos = top.length; while (pos > 0 && score[top[pos - 1]] < score[i]) pos--;
        top.splice(pos, 0, i); if (top.length > k) top.pop();
      }
    }
    const out = top.map((i) => ({ id: this.docs[i].id, index: i, score: score[i], matched: matched[i], coverage: matched[i] / terms.length }));
    for (const i of touched) { score[i] = 0; matched[i] = 0; }     // reset only what this query used
    return out;
  }
}
