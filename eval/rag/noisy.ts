/**
 * Noisy-input retrieval set: typos, romanized Bangla ("Banglish", how many people actually type on a phone), Bangla spelling variants.
 * Written BEFORE the typo and romanization layers were built, then run unchanged to measure them.
 * Out-of-scope questions include near-misses that contain a real domain word, because a typo corrector must never turn "driving licence renewal" into a passport answer.
 */
import type { Q } from './queries';
const P = 'bd-passport-adult-renewal', N = 'bd-nid-correction';

export const NOISY: Q[] = [
  // typos in English
  { q: 'pasport renewel documents', accept: ['pp-existing', `${P}:overview`, 'pp-identity-doc'] },
  { q: 'how long NID corection takes', accept: ['nid-slow'] },
  { q: 'my nmae is spelt diferently on nid and pasport', accept: [`${P}:RN-011`, 'pp-name-strictness', 'pp-match'] },
  { q: 'dat of birth mismtach between id and passport', accept: [`${P}:RN-010`, 'pp-match'] },
  { q: 'is my photo stord on your server', accept: ['kr-privacy'] },
  { q: 'can i corect nid second time', accept: ['nid-once'] },
  { q: 'pasport for under 18 childern', accept: ['pp-under18', `${P}:RN-030`] },
  { q: 'blury photo what hapens', accept: ['kr-unreadable'] },
  // romanized Bangla
  { q: 'passport nobayon korte ki ki kagoj lage', accept: ['pp-existing', `${P}:overview`, 'pp-identity-doc'] },
  { q: 'nid songshodhon korte koto din lage', accept: ['nid-slow'] },
  { q: 'nid ar passport e namer bananer mil nei', accept: [`${P}:RN-011`, 'pp-name-strictness', 'pp-match'] },
  { q: 'jonmo tarikh milche na', accept: [`${P}:RN-010`, 'pp-match'] },
  { q: 'amar chobi ki jama rakhen', accept: ['kr-privacy'] },
  { q: 'ekbar songshodhon korle abar kora jay', accept: ['nid-once'] },
  { q: 'probashider jonno nid songshodhon', accept: ['nid-expat-proposal'] },
  { q: 'chobi jhapsha hole ki hobe', accept: ['kr-unreadable'] },
  // Bangla spelling variants and slips
  { q: 'এনআইডি সংশোদন কত দিন লাগে', accept: ['nid-slow'] },
  { q: 'পাসপোর্ট নবায়ন এর কাগজ পত্র', accept: ['pp-existing', `${P}:overview`, 'pp-identity-doc'] },
  { q: 'জন্মতারিখ অমিল হলে কি করব', accept: [`${P}:RN-010`, 'pp-match'] },
  { q: 'নামের বানান ভুল এনআইডিতে', accept: [`${P}:RN-011`, 'pp-name-strictness', 'pp-match'] },
];
export const NOISY_OUT: string[] = [
  'wether in dhaka tomrrow', 'driving lisense renewel', 'cricket score aj', 'bitcoin dam koto', 'trade licence ke kore nebo',
  'ami ki visa pabo', 'tax return filing korbo kivabe', 'pasta recipe', 'ajker abohawa kemon', 'jomir dolil kivabe korbo',
  'birth certificate for my newborn', 'driving licence renewal',
];
