import { existsSync, readFileSync } from 'node:fs';

export interface OutOfScopeService { id: string; name_en: string; name_bn: string }
interface Entry extends OutOfScopeService { re: RegExp }

/** Loads the list of services people ask about that are not covered yet. */
export function loadOutOfScope(path = 'kb/out-of-scope.json'): Entry[] {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { services: Array<OutOfScopeService & { match: string[] }> };
  return raw.services.map((s) => ({ id: s.id, name_en: s.name_en, name_bn: s.name_bn, re: new RegExp(s.match.join('|'), 'i') }));
}

/**
 * The service the question is clearly about when it is one this assistant does not cover, or null.
 * Words that belong to a covered service (passport, NID) win: "I lost my passport, can I apply for a visa" is still passport-related, but "visa" alone is not.
 */
export function detectOutOfScope(q: string, list: Entry[], coveredWords = /passport|পাসপোর্ট|\bnid\b|এনআইডি|পরিচয়পত্র|national id/i): OutOfScopeService | null {
  if (coveredWords.test(q)) return null;
  return list.find((s) => s.re.test(q)) ?? null;
}
