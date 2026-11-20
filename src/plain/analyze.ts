import { toAsciiDigits } from '../normalize/digits';
import { tokenize } from '../rag/tokenize';
import { compileGlossary, findJargon, type GlossEntry, type GlossHit } from './glossary';

export type Lang = 'bn' | 'en';
export type FactKind = 'deadline' | 'money' | 'percent' | 'duty' | 'prohibition' | 'penalty' | 'date';
export interface Fact { kind: FactKind; sentence: number; value: string }
export interface Analysis {
  lang: Lang; sentences: string[]; facts: Fact[]; jargon: GlossHit[];
  readability: { words: number; sentences: number; avgWords: number; longSentences: number[]; jargonPer100: number; level: 'plain' | 'moderate' | 'dense' };
  summary: number[];     // sentence numbers (0-based), in reading order
}

export const MAX_CHARS = 6000;
export const detectLang = (s: string): Lang => ((s.match(/[\u0980-\u09FF]/g) ?? []).length > (s.match(/[A-Za-z]/g) ?? []).length ? 'bn' : 'en');

/** Splits on full stops, Bangla danda, question marks and line breaks, while keeping numbers like 3.5 and abbreviations such as "Tk." together. */
export function splitSentences(text: string): string[] {
  const t = text.replace(/\r/g, '').replace(/\b(Tk|No|Sec|Art|Rs|Dr|Mr|Mrs|Md|Ltd|Co|etc|viz|vs|cf)\./gi, '$1\u0001').replace(/(\d)\.(\d)/g, '$1\u0002$2');
  return t.split(/(?<=[.?!।])\s+|\n{2,}|\n(?=\s*(?:\(?\d+[.)]|\([a-z]\)|[ক-হ][.)]))/u).map((s) => s.replace(/\u0001/g, '.').replace(/\u0002/g, '.').replace(/\s+/g, ' ').trim()).filter((s) => s.length > 2);
}

const NUM = '\\d+(?:,\\d+)*(?:\\.\\d+)?';
const MONEY = new RegExp(`(?:৳|\\bTk\\.?|\\bBDT|\\bTaka|টাকা)\\s*${NUM}(?:\\s*(?:lakh|crore|লাখ|কোটি))?|${NUM}\\s*(?:Tk\\b|BDT|taka|টাকা|lakh|crore|লাখ|কোটি)`, 'giu');
const PERCENT = /\d+(?:\.\d+)?\s*(?:%|percent|per cent|শতাংশ)/giu;   // all patterns below run on a copy with ASCII digits, because JavaScript's \d does not match Bangla digits
const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|জানুয়ারি|জানুয়ারী|ফেব্রুয়ারি|ফেব্রুয়ারী|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|আগষ্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর)';
const DATE = new RegExp(`\\b\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4}\\b|\\b\\d{1,2}\\s+${MONTH}\\.?,?\\s+\\d{4}|\\b${MONTH}\\s+\\d{1,2},?\\s+\\d{4}|\\b${MONTH}\\s+\\d{4}`, 'giu');
const DURATION = /(?:within|not later than|no later than|after|for a period of|a period of)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|thirty|sixty|ninety)\s*(?:\([\d]+\)\s*)?(?:working\s+)?(?:days?|weeks?|months?|years?)|\d+\s*(?:দিন|সপ্তাহ|মাস|বছর)(?:ের|র)?\s*(?:মধ্যে|ভিতরে|পর|পরে)/giu;
const DUTY = /\b(?:shall|must|is required to|are required to|is obliged to|are obliged to|has to|have to)\b(?!\s+not)|(?:করিতে\s+হইবে|করতে\s+হবে|দাখিল\s+করিবেন|পরিশোধ\s+করিবেন|করিবেন|করবেন|বাধ্য\s+থাকিবেন|বাধ্য\s+থাকবেন|হইবে|হবে)(?!\s*না)/giu;
const PROHIB = /\b(?:shall not|must not|may not|is prohibited|are prohibited|is not permitted|are not permitted|not allowed)\b|(?:পারিবেন\s+না|পারবেন\s+না|নিষিদ্ধ|করা\s+যাইবে\s+না|করা\s+যাবে\s+না)/giu;
const PENALTY = /\b(?:penalty|penalties|fine|fines|imprisonment|punishable|liable|surcharge|late fee)\b|(?:জরিমানা|অর্থদণ্ড|কারাদণ্ড|দণ্ডনীয়|দণ্ড)/giu;

/** Finds amounts, dates, deadlines, duties, prohibitions and penalties, each tied to the sentence it came from. Nothing is rewritten: values are exactly as printed. */
export function extractFacts(sentences: string[]): Fact[] {
  const out: Fact[] = [];
  sentences.forEach((s, i) => {
    const n = toAsciiDigits(s);      // same length as s: one Bangla digit becomes one ASCII digit
    const add = (kind: FactKind, re: RegExp) => { for (const m of n.matchAll(re)) out.push({ kind, sentence: i, value: s.slice(m.index!, m.index! + m[0].length).trim() }); };
    add('money', MONEY); add('percent', PERCENT); add('date', DATE); add('deadline', DURATION);
    const has = (re: RegExp) => new RegExp(re.source, re.flags.replace('g', '')).test(n);
    const prohibits = has(PROHIB);
    if (prohibits) out.push({ kind: 'prohibition', sentence: i, value: '' });
    if (!prohibits && has(DUTY)) out.push({ kind: 'duty', sentence: i, value: '' });
    if (has(PENALTY)) out.push({ kind: 'penalty', sentence: i, value: '' });
  });
  return out;
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
/** Rough, explainable difficulty label. A heuristic, not a validated readability formula. */
export function readability(sentences: string[], jargon: number) {
  const words = sentences.reduce((a, s) => a + wordCount(s), 0), n = Math.max(1, sentences.length), avg = words / n;
  const longLimit = 35; const longSentences = sentences.map((s, i) => (wordCount(s) >= longLimit ? i : -1)).filter((i) => i >= 0);
  const jargonPer100 = words ? (100 * jargon) / words : 0;
  const score = avg / 10 + jargonPer100 / 2;
  return { words, sentences: sentences.length, avgWords: Math.round(avg * 10) / 10, longSentences, jargonPer100: Math.round(jargonPer100 * 10) / 10, level: (score < 2.6 ? 'plain' : score < 4.6 ? 'moderate' : 'dense') as 'plain' | 'moderate' | 'dense' };
}

/** Picks up to `k` sentences that carry the most of the text's own vocabulary and facts, returned in reading order. */
export function extractiveSummary(sentences: string[], facts: Fact[], k = 3): number[] {
  if (sentences.length <= k) return sentences.map((_, i) => i);
  const toks = sentences.map((s) => tokenize(s)); const tf = new Map<string, number>();
  for (const ts of toks) for (const t of new Set(ts)) tf.set(t, (tf.get(t) ?? 0) + 1);
  const factCount = new Map<number, number>(); for (const f of facts) factCount.set(f.sentence, (factCount.get(f.sentence) ?? 0) + 1);
  const score = sentences.map((s, i) => {
    const ts = toks[i]; if (ts.length < 4) return 0;
    const centrality = ts.reduce((a, t) => a + Math.min(tf.get(t) ?? 0, 4), 0) / Math.sqrt(ts.length);
    return centrality + 1.2 * Math.min(2, factCount.get(i) ?? 0) + (i === 0 ? 1.5 : 0) - (wordCount(s) > 60 ? 1 : 0);
  });
  return score.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]).slice(0, k).map((x) => x[1]).sort((a, b) => a - b);
}

export function analyze(text: string, glossary: GlossEntry[], langHint?: Lang): Analysis {
  const lang = langHint ?? detectLang(text);
  const sentences = splitSentences(text);
  const facts = extractFacts(sentences);
  const jargon = findJargon(sentences, compileGlossary(glossary), lang);
  return { lang, sentences, facts, jargon, readability: readability(sentences, jargon.length), summary: extractiveSummary(sentences, facts) };
}
