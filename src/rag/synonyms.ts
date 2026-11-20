import { tokenize } from './tokenize';

/** Words that mean the same thing in this domain, in English and Bangla (including common Bangla inflections). Used on the query side only. */
const GROUPS: string[][] = [
  ['renew', 'renewal', 'extend', 'extension', 'reissue', 're-issue', 'নবায়ন', 'নবায়নের', 'মেয়াদ বাড়ানো'],
  ['correct', 'correction', 'amend', 'amendment', 'fix', 'change', 'modify', 'update', 'edit', 'alter', 'rectify', 'সংশোধন', 'ঠিক', 'পরিবর্তন', 'বদল', 'বদলাতে', 'বদলান', 'শুধরে'],
  ['mismatch', 'different', 'differ', 'inconsistent', 'wrong', 'incorrect', 'unequal', 'অমিল', 'আলাদা', 'মিলছে', 'মিলতে', 'মিল', 'একরকম', 'ভিন্ন'],
  ['birth', 'dob', 'born', 'জন্ম', 'জন্মতারিখ'],
  ['certificate', 'sertificate', 'সনদ', 'সার্টিফিকেট', 'প্রত্যয়নপত্র'],
  ['document', 'documents', 'paper', 'papers', 'proof', 'evidence', 'কাগজ', 'কাগজপত্র', 'প্রমাণ', 'জিনিস'],
  ['blurry', 'blur', 'unclear', 'unreadable', 'focus', 'fuzzy', 'dim', 'glare', 'shadow', 'ঝাপসা', 'অস্পষ্ট', 'ঝলক'],
  ['photo', 'picture', 'pictures', 'image', 'images', 'scan', 'ছবি', 'ফটো'],
  ['store', 'stored', 'keep', 'kept', 'save', 'saved', 'retain', 'server', 'servers', 'জমা', 'সংরক্ষণ', 'রাখে', 'রাখেন', 'রেখে', 'রাখ', 'সার্ভারে'],
  ['price', 'cost', 'fee', 'fees', 'charge', 'much', 'টাকা', 'ফি', 'খরচ', 'দাম'],
  ['abroad', 'overseas', 'expat', 'expatriate', 'expatriates', 'diaspora', 'nrb', 'প্রবাসী', 'প্রবাসীদের', 'বিদেশ', 'বিদেশে', 'এনআরবি'],
  ['nid', 'id', 'identity', 'এনআইডি', 'এনআইডির', 'পরিচয়পত্র', 'আইডি'],
  ['minor', 'child', 'children', 'kid', 'underage', 'শিশু', 'নাবালক', 'কম বয়সী', 'কম বয়সীদের'],
  ['slow', 'long', 'weeks', 'months', 'years', 'delay', 'wait', 'duration', 'অপেক্ষা', 'মাস', 'বছর', 'সময়', 'দেরি', 'কতদিন', 'দিন', 'day', 'days'],
  ['official', 'government', 'approval', 'approved', 'approve', 'decision', 'সরকারি', 'অনুমোদন', 'সিদ্ধান্ত'],
  ['source', 'website', 'site', 'portal', 'origin', 'সূত্র', 'ওয়েবসাইট'],
  ['twice', 'again', 'second', 'once', 'repeat', 'আবার', 'দ্বিতীয়বার', 'একবার'],
  ['need', 'require', 'required', 'bring', 'carry', 'take', 'লাগে', 'লাগবে', 'চাই', 'নিতে', 'নিয়ে', 'যেতে'],
  ['relax', 'relaxation', 'ease', 'easier', 'relief', 'concession', 'benefit', 'proposal', 'সুবিধা', 'ছাড়', 'প্রস্তাব'],
];

const byTerm = new Map<string, Set<string>[]>();
for (const g of GROUPS) {
  const stems = new Set(g.flatMap((w) => tokenize(w)));
  for (const s of stems) { const list = byTerm.get(s) ?? []; list.push(stems); byTerm.set(s, list); }
}
/** The query term plus everything that means the same thing. */
export function expandTerm(term: string): string[] {
  const out = new Set([term]); for (const g of byTerm.get(term) ?? []) for (const s of g) out.add(s);
  return [...out];
}
