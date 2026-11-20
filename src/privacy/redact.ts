import { toAsciiDigits } from '../normalize/digits';

export type RedactionType = 'email' | 'phone' | 'nid' | 'passport' | 'number';
export interface Redaction { type: RedactionType; count: number }
const LABEL: Record<RedactionType, string> = { email: '[email hidden]', phone: '[phone hidden]', nid: '[ID number hidden]', passport: '[passport number hidden]', number: '[number hidden]' };

/**
 * Removes personal identifiers from typed text BEFORE it goes to an AI service or a log.
 * Catches e-mail addresses, Bangladesh mobile numbers, NID-length numbers (10, 13, 17 digits), passport-style numbers and other long digit runs,
 * in ASCII or Bangla digits, with spaces or dashes inside. It cannot find names or addresses, so it reduces risk rather than removing it.
 */
export function redactPii(input: string): { text: string; redactions: Redaction[] } {
  const counts = new Map<RedactionType, number>();
  const hit = (t: RedactionType) => { counts.set(t, (counts.get(t) ?? 0) + 1); return LABEL[t]; };
  let text = toAsciiDigits(input);
  text = text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, () => hit('email'));
  text = text.replace(/(?<![\w])\+?\d[\d\s-]{7,}\d(?![\w])/g, (m) => {
    const d = m.replace(/\D/g, '');
    if (/^(?:88)?01[3-9]\d{8}$/.test(d)) return hit('phone');
    if ([10, 13, 17].includes(d.length)) return hit('nid');
    return d.length >= 9 ? hit('number') : m;
  });
  text = text.replace(/\b[A-Z]{1,2}\d{7,8}\b/g, () => hit('passport'));
  return { text, redactions: [...counts].map(([type, count]) => ({ type, count })) };
}
