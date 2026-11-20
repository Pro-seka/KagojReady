import { editDistance } from './fuzzy';

/**
 * Romanized Bangla ("Banglish"): how many people actually type Bangla on a phone, e.g. "nid songshodhon korte koto din lage".
 * There is no single spelling, so words are folded to a rough sound key and matched to a small domain lexicon with at most one slip.
 * The lexicon is deliberately limited to words this service needs. Anything else stays unknown and the assistant abstains.
 */
const LEXICON: Record<string, string[]> = {
  'নবায়ন': ['nobayon', 'nobayan', 'nobayen', 'nabayan', 'noboyon', 'nobaion'],
  'সংশোধন': ['songshodhon', 'shongshodhon', 'sonshodhon', 'songshodhan', 'songsodhon', 'sangshodhan', 'songshoddhon'],
  'কাগজ': ['kagoj', 'kagoz', 'kagaz', 'kagoch'], 'কাগজপত্র': ['kagojpotro', 'kagozpatra', 'kagojpatro'],
  'লাগ': ['lage', 'lagbe', 'lagey', 'lagche', 'laga'], 'দিন': ['din', 'dine'], 'সময়': ['shomoy', 'somoy', 'samay', 'shomay'],
  'জন্ম': ['jonmo', 'janmo', 'jonmoo'], 'তারিখ': ['tarikh', 'tarik', 'tarikhe'], 'নাম': ['nam', 'naam', 'namer', 'namey'],
  'বানান': ['banan', 'bananer', 'bannan', 'baanan', 'banaan'], 'ছবি': ['chobi', 'chhobi', 'sobi', 'chobir'],
  'জমা': ['jama', 'joma', 'jomaa'], 'রাখ': ['rakhen', 'rakhe', 'rakhbe', 'rakhi', 'rakha'], 'প্রবাসী': ['probashi', 'probasi', 'probashider', 'probasider', 'prabasi'],
  'আবার': ['abar', 'abaar'], 'একবার': ['ekbar', 'ekbaar'], 'মিল': ['mil', 'milche', 'milchhe', 'milena', 'milbe', 'milse', 'miley'],
  'আলাদা': ['alada', 'aloda', 'alaada'], 'ঝাপসা': ['jhapsha', 'jhapsa', 'jhaapsa'], 'শিশু': ['shishu', 'sisu', 'sishu'], 'বয়স': ['boyosh', 'boyos', 'bayas'],
  'টাকা': ['taka', 'tk'], 'সনদ': ['sonod', 'shonod', 'sonad'], 'বিদেশ': ['bidesh', 'bideshe'],  'সংরক্ষণ': ['songrokkhon', 'songrokhon'], 'নিরাপদ': ['nirapod'],
};
/** Filler words that carry no search value in romanized Bangla. */
const FILLER = new Set('ar o e ki ke kore korte korle kora korbo korbe hole hobe hoy ache achhe nei na er ta te ami amar apni apnar kono ekta jonno theke diye kon kivabe kibhabe jay jabe jai nebo neo nite pabo paba koto kotha ta ei oi shei se'.split(' '));

/** Folds spelling variation: sh/ch/kh/th/dh/bh/ph/gh/jh digraphs, z/v/w, doubled letters, and ng. */
export function soundKey(w: string): string {
  return w.toLowerCase().replace(/chh/g, 'c').replace(/(sh|ch|kh|th|dh|bh|ph|gh|jh)/g, (m) => (m === 'ph' ? 'f' : m[0]))
    .replace(/z/g, 'j').replace(/v/g, 'b').replace(/w/g, 'o').replace(/ng/g, 'n').replace(/(.)\1+/g, '$1');
}
const KEYED: Array<{ bn: string; key: string }> = [];
for (const [bn, variants] of Object.entries(LEXICON)) for (const v of variants) KEYED.push({ bn, key: soundKey(v) });

export const isRomanFiller = (t: string) => FILLER.has(t);
/** The Bangla word a romanized token most likely stands for, or null. Short tokens must match exactly after folding. */
export function fromBanglish(token: string): string | null {
  if (!/^[a-z]+$/i.test(token) || token.length < 2) return null;
  const k = soundKey(token); let best: { bn: string; d: number } | null = null;
  for (const e of KEYED) {
    const d = editDistance(k, e.key, 1); if (d > 1) continue;
    if (d === 1 && k.length < 6) continue;      // "din" must not become "dim", and 5-letter slips are too ambiguous
    if (!best || d < best.d) best = { bn: e.bn, d };
    if (d === 0) break;
  }
  return best?.bn ?? null;
}
