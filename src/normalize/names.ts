import type { ExtractedField, MatchLevel } from '../types';

const nfc = (s: string) => s.normalize('NFC');
const HONORIFICS = new Set([
  'md', 'mohammad', 'muhammad', 'mohammed', 'mohd', 'mohamed', 'mst', 'mosammat', 'mrs', 'mr', 'miss',
  ...['মোঃ', 'মো', 'মোহাম্মদ', 'মুহাম্মদ', 'মোহাম্মাদ', 'মোছাঃ', 'মোসাঃ', 'মোছা', 'মোসা'].map(nfc),
]);
const hasBangla = (s: string) => /[\u0980-\u09FF]/.test(s);

/** Case, punctuation and spacing differences only. */
function basic(s: string): string {
  return nfc(s).toLowerCase().replace(/[.,'’`\-_()]/g, ' ').replace(/\s+/g, ' ').trim();
}
function stripHonorifics(s: string): string {
  const kept = s.split(' ').filter((t) => !HONORIFICS.has(t));
  return kept.length ? kept.join(' ') : s; // a name that is only "Mohammad" must not vanish
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const md = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const am = new Array<boolean>(a.length).fill(false);
  const bm = new Array<boolean>(b.length).fill(false);
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - md), hi = Math.min(i + md + 1, b.length);
    for (let j = lo; j < hi; j++) {
      if (bm[j] || a[i] !== b[j]) continue;
      am[i] = bm[j] = true; m++; break;
    }
  }
  if (!m) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!am[i]) continue;
    while (!bm[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t /= 2;
  const jaro = (m / a.length + m / b.length + (m - t) / m) / 3;
  let p = 0;
  while (p < Math.min(4, a.length, b.length) && a[p] === b[p]) p++;
  return jaro + p * 0.1 * (1 - jaro);
}

const latinForm = (f: ExtractedField): string | null =>
  f.value && !hasBangla(f.value) ? f.value : f.romanized ?? null;

export interface NameComparison { level: MatchLevel; via: 'script' | 'romanized' }

/** Compare two name fields. Returns null when they cannot be compared (no common script/form). */
export function compareNames(a: ExtractedField, b: ExtractedField): NameComparison | null {
  if (!a.value || !b.value) return null;
  let x: string | null, y: string | null, via: 'script' | 'romanized';
  if (hasBangla(a.value) && hasBangla(b.value)) { x = a.value; y = b.value; via = 'script'; }
  else { x = latinForm(a); y = latinForm(b); via = 'romanized'; }
  if (x == null || y == null) return null;
  const bx = basic(x), by = basic(y);
  if (bx === by) return { level: 'exact', via };
  const sx = stripHonorifics(bx), sy = stripHonorifics(by);
  if (sx === sy) return { level: 'equivalent', via };
  if (sx.split(' ').sort().join(' ') === sy.split(' ').sort().join(' ')) return { level: 'close', via };
  return { level: jaroWinkler(sx, sy) >= 0.85 ? 'close' : 'different', via };
}
