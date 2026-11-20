import { existsSync, readFileSync } from 'node:fs';

export interface GlossEntry { id: string; match_en: string[]; match_bn: string[]; term_en: string; term_bn: string; plain_en: string; plain_bn: string }
export interface GlossHit { id: string; found: string; term: string; plain: string; sentence: number }
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Loads the glossary. Each entry carries both languages so the same list serves English and Bangla texts. */
export function loadGlossary(path = 'kb/glossary.json'): GlossEntry[] {
  if (!existsSync(path)) return [];
  return (JSON.parse(readFileSync(path, 'utf8')) as { entries: GlossEntry[] }).entries;
}

/** One compiled matcher per entry. English matches whole words; Bangla matches from a word start so that suffixes still match. */
export function compileGlossary(entries: GlossEntry[]) {
  return entries.map((e) => ({ e, re: new RegExp([
    ...e.match_en.map((m) => `\\b${esc(m).replace(/ /g, '\\s+')}\\b`),
    ...e.match_bn.map((m) => `(?<![\\u0980-\\u09FF])${esc(m).replace(/ /g, '\\s+')}`),
  ].join('|'), 'iu') }));
}

/** Every glossary term found in the sentences, once per term, with the sentence it first appears in. */
export function findJargon(sentences: string[], compiled: ReturnType<typeof compileGlossary>, lang: 'en' | 'bn'): GlossHit[] {
  const hits: GlossHit[] = []; const seen = new Set<string>();
  sentences.forEach((s, i) => { for (const { e, re } of compiled) { if (seen.has(e.id)) continue; const m = re.exec(s); if (!m) continue; seen.add(e.id);
    hits.push({ id: e.id, found: m[0], term: (lang === 'bn' ? e.term_bn || e.term_en : e.term_en || e.term_bn), plain: (lang === 'bn' ? e.plain_bn : e.plain_en), sentence: i }); } });
  return hits;
}
