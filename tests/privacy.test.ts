import { describe, expect, it } from 'vitest';
import { redactPii } from '../src/privacy/redact';

describe('personal-number removal', () => {
  const r = (s: string) => redactPii(s);
  it('removes NID-length numbers in ASCII and Bangla digits, with spaces or dashes', () => {
    expect(r('my NID is 1234567890 ok').text).toBe('my NID is [ID number hidden] ok');
    expect(r('আমার এনআইডি ১২৩৪৫৬৭৮৯০১২৩৪৫৬৭৮৯ ঠিক').text).not.toMatch(/\d/);
    expect(r('NID 1990 1234 5678 9').text).toContain('[ID number hidden]');
    expect(r('number 123-456-7890-123').redactions).toEqual([{ type: 'nid', count: 1 }]);
    expect(r('12345678901234567').redactions[0].type).toBe('nid');
  });
  it('removes Bangladesh mobile numbers in common formats', () => {
    for (const p of ['01712345678', '+8801712345678', '8801712345678', '017 1234 5678', '০১৭১২৩৪৫৬৭৮']) expect(r(`call ${p} now`).redactions, p).toEqual([{ type: 'phone', count: 1 }]);
  });
  it('removes e-mail addresses and passport-style numbers', () => {
    expect(r('write to rahim.k@example.com please').text).toBe('write to [email hidden] please');
    expect(r('passport A12345678 expires').text).toBe('passport [passport number hidden] expires');
    expect(r('BP1234567').redactions[0].type).toBe('passport');
  });
  it('removes other long digit runs but keeps ordinary numbers, ages and dates', () => {
    expect(r('card 4111 1111 1111').redactions[0].type).toBe('number');
    const keep = 'I am 25 years old, applied on 12/03/2026, in room 301, under 18';
    expect(r(keep).text).toBe(keep); expect(r(keep).redactions).toEqual([]);
  });
  it('counts several kinds at once and leaves the surrounding question readable', () => {
    const out = r('NID 1234567890, phone 01712345678, mail a@b.co: why mismatch?');
    expect(out.text).toBe('NID [ID number hidden], phone [phone hidden], mail [email hidden]: why mismatch?');
    expect(out.redactions.map((x) => x.type).sort()).toEqual(['email', 'nid', 'phone']);
  });
  it('is safe on empty and non-string-ish input', () => { expect(r('').text).toBe(''); expect(r('   ').redactions).toEqual([]); });
});
