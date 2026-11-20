const BN = '০১২৩৪৫৬৭৮৯';
/** Convert Bangla digits to ASCII digits. */
export function toAsciiDigits(s: string): string {
  return s.replace(/[০-৯]/g, (c) => String(BN.indexOf(c)));
}
