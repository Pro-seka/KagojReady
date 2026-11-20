import { toAsciiDigits } from './digits';

const nfc = (s: string) => s.normalize('NFC');
const BN_MONTHS: Record<string, number> = Object.fromEntries(
  Object.entries({
    'জানুয়ারি': 1, 'জানুয়ারী': 1, 'ফেব্রুয়ারি': 2, 'ফেব্রুয়ারী': 2, 'মার্চ': 3, 'এপ্রিল': 4,
    'মে': 5, 'জুন': 6, 'জুলাই': 7, 'আগস্ট': 8, 'আগষ্ট': 8, 'সেপ্টেম্বর': 9,
    'অক্টোবর': 10, 'নভেম্বর': 11, 'ডিসেম্বর': 12,
  }).map(([k, v]) => [nfc(k), v]),
);
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function valid(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Parse a printed date into ISO (YYYY-MM-DD). Returns null when it cannot be read as a real date.
 *  Numeric dates are read as day-month-year, which is the convention on Bangladeshi documents. */
export function parseDate(raw: string): string | null {
  const s = nfc(toAsciiDigits(raw)).trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  let mt = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (mt) return valid(+mt[1], +mt[2], +mt[3]);
  mt = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (mt) return valid(+mt[3], +mt[2], +mt[1]);
  mt = s.match(/^(\d{1,2})[ -]([^\d\s-]+)[ -](\d{4})$/);
  if (mt) {
    const name = mt[2];
    const m = BN_MONTHS[name] ?? (EN_MONTHS.indexOf(name.slice(0, 3)) + 1 || undefined);
    return m ? valid(+mt[3], m, +mt[1]) : null;
  }
  return null;
}

/** Whole years between an ISO birth date and an ISO reference date. */
export function ageOn(dobIso: string, todayIso: string): number {
  const [by, bm, bd] = dobIso.split('-').map(Number);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}
