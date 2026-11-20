import { describe, expect, it } from 'vitest';
import { toAsciiDigits } from '../src/normalize/digits';
import { ageOn, parseDate } from '../src/normalize/dates';
import { compareNames, jaroWinkler } from '../src/normalize/names';
import { f } from './helpers';

describe('digits', () => {
  it('converts Bangla digits', () => expect(toAsciiDigits('১২৩৪৫৬৭৮৯০ab1')).toBe('1234567890ab1'));
});

describe('parseDate', () => {
  it.each([
    ['12/03/1990', '1990-03-12'], ['12-03-1990', '1990-03-12'], ['12.03.1990', '1990-03-12'],
    ['1990-03-12', '1990-03-12'], ['12 Mar 1990', '1990-03-12'], ['12 March 1990', '1990-03-12'],
    ['১২/০৩/১৯৯০', '1990-03-12'], ['১২ মার্চ ১৯৯০', '1990-03-12'], ['5 জানুয়ারী 2001', '2001-01-05'],
  ])('%s -> %s', (raw, iso) => expect(parseDate(raw)).toBe(iso));
  it.each(['31/02/1990', '2026-13-01', '??/03/1990', 'hello', '12/03/90', '00/01/1990'])(
    'rejects %s', (raw) => expect(parseDate(raw)).toBeNull());
  it('computes age around the birthday', () => {
    expect(ageOn('2008-10-20', '2026-10-20')).toBe(18);
    expect(ageOn('2008-10-21', '2026-10-20')).toBe(17);
  });
});

describe('compareNames', () => {
  const level = (a: string, b: string) => compareNames(f(a), f(b))?.level;
  it('treats case, punctuation and spacing as exact', () => {
    expect(level('Md. Abdur Rahim', 'MD ABDUR  RAHIM')).toBe('exact');
    expect(level('Abdur-Rahim', 'abdur rahim')).toBe('exact');
  });
  it('treats honorific/alias differences as equivalent', () => {
    expect(level('Md. Abdur Rahim', 'Abdur Rahim')).toBe('equivalent');
    expect(level('Mohammad Rahim', 'Md Rahim')).toBe('equivalent');
  });
  it('flags small spelling differences as close', () => {
    expect(level('Abdur Rahim', 'Abdur Rohim')).toBe('close');
    expect(level('Abdur Rahim', 'Abdul Rahim')).toBe('close');
  });
  it('treats swapped word order as close, not exact', () => expect(level('Abdur Rahim', 'Rahim Abdur')).toBe('close'));
  it('treats different people as different', () => expect(level('Abdur Rahim', 'Karim Uddin')).toBe('different'));
  it('does not let a single-name "Mohammad" vanish', () => {
    expect(level('Mohammad', 'Mohammad')).toBe('exact');
    expect(level('Mohammad', 'Rahim')).toBe('different');
  });
  it('handles Bangla honorifics when both are Bangla', () => {
    const r = compareNames(f('মোঃ আব্দুর রহিম'), f('আব্দুর রহিম'));
    expect(r).toEqual({ level: 'equivalent', via: 'script' });
  });
  it('compares across scripts through the romanized form', () => {
    const bn = f('আব্দুর রহিম', 0.95, { romanized: 'Abdur Rahim' });
    expect(compareNames(bn, f('Abdur Rahim'))).toEqual({ level: 'exact', via: 'romanized' });
  });
  it('returns null when there is no common form', () => {
    expect(compareNames(f('আব্দুর রহিম'), f('Abdur Rahim'))).toBeNull();
  });
  it('jaroWinkler sanity', () => {
    expect(jaroWinkler('rahim', 'rahim')).toBe(1);
    expect(jaroWinkler('rahim', 'rohim')).toBeGreaterThan(0.85);
    expect(jaroWinkler('rahim', 'karim')).toBeLessThan(0.85);
  });
});
