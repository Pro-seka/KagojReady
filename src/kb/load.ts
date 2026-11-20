import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pack } from '../pack/schema';
import type { Card, Source } from './types';
import { Bm25Index, type Hit } from '../rag/bm25';
import { expandTerm } from '../rag/synonyms';
import { rewriteQuery, type Rewrite } from '../rag/rewrite';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bn = (n: number) => String(n).replace(/[0-9]/g, (d) => BN_DIGITS[+d]);
const readable = (f: string) => f.replace(/_/g, ' ');

/** Cards generated from the rule packs, so the knowledge base and the document pre-check can never disagree. */
export function cardsFromPacks(packs: Pack[]): Card[] {
  const out: Card[] = [];
  for (const p of packs) {
    out.push({
      id: `${p.pack_id}:overview`, service: p.pack_id, kind: 'overview',
      title_en: `${p.service.name_en}: what the pre-check reads`, title_bn: `${p.service.name_bn}: প্রাক-যাচাই কী পড়ে`,
      text_en: `For ${p.service.name_en}, KagojReady reads these documents: ${p.documents.map((d) => `${d.name_en} (${d.fields.map(readable).join(', ')})`).join('; ')}. It then checks ${p.rules.length} rules and shows what to fix before you travel.`,
      text_bn: `${p.service.name_bn} এর জন্য কাগজরেডি এই কাগজগুলো পড়ে: ${p.documents.map((d) => d.name_bn).join(', ')}। তারপর ${bn(p.rules.length)}টি নিয়ম যাচাই করে এবং যাওয়ার আগে কী ঠিক করতে হবে তা দেখায়।`,
      source: null, status: 'product', tags: [p.service.id, ...p.documents.flatMap((d) => d.fields.map(readable))],
    });
    for (const r of p.rules) out.push({
      id: `${p.pack_id}:${r.id}`, service: p.pack_id, kind: 'rule',
      title_en: r.message_en.split(/(?<=\.)\s/)[0], title_bn: r.message_bn.split('।')[0],
      text_en: `${r.message_en} ${r.fix_en.join(' ')}`, text_bn: `${r.message_bn} ${r.fix_bn.join(' ')}`,
      source: r.source_ref !== undefined ? p.sources[r.source_ref] : null, status: r.rule_status,
      tags: [r.type, ...('field' in r ? [readable(r.field)] : []), ...('doc' in r ? [readable(r.doc)] : [])],
    });
  }
  return out;
}

export interface KbOptions { cardsPath?: string; ingestedDir?: string }
/** Curated cards + pack-derived cards + anything ingested with `npm run ingest`. */
export function buildKb(packs: Pack[], o: KbOptions = {}): Card[] {
  const path = o.cardsPath ?? 'kb/cards.json';
  const cards: Card[] = [];
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { sources: Record<string, Source>; cards: Array<Omit<Card, 'source'> & { source: string | null }> };
    for (const c of raw.cards) cards.push({ ...c, source: c.source ? raw.sources[c.source] ?? null : null });
  }
  cards.push(...cardsFromPacks(packs));
  const dir = o.ingestedDir ?? 'kb/ingested';
  if (existsSync(dir)) for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) cards.push(...(JSON.parse(readFileSync(join(dir, f), 'utf8')) as Card[]));
  const ids = new Set<string>();
  for (const c of cards) { if (ids.has(c.id)) throw new Error(`duplicate knowledge card id ${c.id}`); ids.add(c.id); }
  return cards;
}

export interface Retrieved { card: Card; score: number; coverage: number }
export interface RetrieverOptions { minCoverage?: number; minScore?: number }
export class Retriever {
  private index: Bm25Index;
  readonly minCoverage: number; readonly minScore: number;
  constructor(readonly cards: Card[], o: RetrieverOptions = {}) {
    this.minCoverage = o.minCoverage ?? 0.5; this.minScore = o.minScore ?? 1.0;
    this.index = new Bm25Index(cards.map((c) => ({ id: c.id, title: `${c.title_en} ${c.title_bn}`, text: `${c.text_en} ${c.text_bn}`, tags: c.tags })), { expand: expandTerm });
  }
  /** Returns the best passages, or an empty list when the knowledge base does not cover the question (so the assistant abstains). */
  retrieve(query: string, k = 4): Retrieved[] { return this.retrieveDetailed(query, k).hits; }
  /** Same, and also says which typos were fixed and which romanized Bangla words were mapped, so the interface can show it. */
  retrieveDetailed(query: string, k = 4): { hits: Retrieved[]; rewrite: Rewrite } {
    const rewrite = rewriteQuery(query, this.index, expandTerm);
    const hits: Hit[] = this.index.search(rewrite.text, k + 4);
    // Refuse when too little of the question is covered, or when one lone word (often a generic one like "price") is all that matched
    // while other words in the question are unknown to the knowledge base.
    if (!hits.length || hits[0].coverage < this.minCoverage || hits[0].score < this.minScore || (hits[0].matched < 2 && hits[0].coverage < 1)) return { hits: [], rewrite };
    return { rewrite, hits: hits.slice(0, k).filter((h) => h.coverage >= this.minCoverage * 0.6).map((h) => ({ card: this.cards[h.index], score: h.score, coverage: h.coverage })) };
  }
}
