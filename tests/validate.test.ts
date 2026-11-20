import { describe, expect, it } from 'vitest';
// @ts-expect-error plain browser module
import { validateField, fromSpeech, parseDate as clientParse, crossCheck, MESSAGES, say, sayDate, COACH_FIELDS } from '../public/lib/validate.mjs';
import { parseDate as serverParse } from '../src/normalize/dates';

const TODAY = '2026-11-19';
const v = (k: string, x: string) => validateField(k, x, { today: TODAY });

describe('form coach: field checks', () => {
  it('NID: accepts 10, 13 and 17 digits in either script with spaces or dashes, rejects other lengths and letters', () => {
    for (const ok of ['1234567890', '১২৩৪৫৬৭৮৯০', '1234 5678 90', '1234567890123', '12345678901234567']) expect(v('nid', ok).level, ok).toBe('ok');
    expect(v('nid', '123456789012')).toMatchObject({ level: 'error', code: 'nid_length', arg: 12 });
    expect(v('nid', '12345abc90').code).toBe('nid_chars');
    expect(v('nid', '').level).toBe('empty');
  });
  it('mobile: accepts 01x, 8801x and +8801x forms and returns the local form; rejects bad operator digits and lengths', () => {
    for (const ok of ['01712345678', '+8801712345678', '8801712345678', '০১৭১২৩৪৫৬৭৮', '01712-345678']) expect(v('mobile', ok), ok).toMatchObject({ level: 'ok', value: '01712345678' });
    for (const bad of ['01212345678', '0171234567', '1712345678', '017123456789']) expect(v('mobile', bad).level, bad).toBe('error');
  });
  it('passport number and e-mail', () => {
    expect(v('passport', 'a12345678')).toMatchObject({ level: 'ok', value: 'A12345678' });
    expect(v('passport', 'AB1234567').level).toBe('ok'); expect(v('passport', '12345678').level).toBe('error'); expect(v('passport', 'A123').level).toBe('error');
    expect(v('email', 'Rahim@Example.com').value).toBe('rahim@example.com'); expect(v('email', 'rahim@').level).toBe('error');
  });
  it('English name: rejects Bangla letters, digits and symbols; warns on a single word', () => {
    expect(v('name_en', 'আব্দুর রহিম').code).toBe('name_script'); expect(v('name_en', 'Rahim 2').code).toBe('name_digits');
    expect(v('name_en', 'Rahim@Karim').code).toBe('name_symbols'); expect(v('name_en', 'Md. Abdur Rahim').level).toBe('ok');
    expect(v('name_en', 'Rahim')).toMatchObject({ level: 'warn', code: 'name_one_word' }); expect(v('name_en', 'Al').code).toBe('name_short');
    expect(v('name_en', "Shah  Jalal-O'Neil").value).toBe("Shah Jalal-O'Neil");
  });
  it('date of birth: real calendar dates only, never in the future, never over 120, warns under 18', () => {
    expect(v('dob', '12/03/1990')).toMatchObject({ level: 'ok', value: '1990-03-12' });
    expect(v('dob', '১২ মার্চ ১৯৯০').value).toBe('1990-03-12'); expect(v('dob', 'March 12 1990').value).toBe('1990-03-12');
    expect(v('dob', '31/02/1990').code).toBe('date_unreadable'); expect(v('dob', 'yesterday').code).toBe('date_unreadable');
    expect(v('dob', '01/01/2030').code).toBe('dob_future'); expect(v('dob', '01/01/1880').code).toBe('date_unreadable'); expect(v('dob', '01/01/1900').code).toBe('dob_old');
    expect(v('dob', '01/01/2015')).toMatchObject({ level: 'warn', code: 'dob_minor', arg: 11 });
  });
  it('expiry: warns when already past', () => { expect(v('expiry', '01/01/2020').code).toBe('expiry_past'); expect(v('expiry', '01/01/2030').level).toBe('ok'); });
  it('cross-field checks', () => {
    expect(crossCheck({ dob: '12/03/1990', expiry: '01/01/1980' })[0].code).toBe('expiry_before_birth');
    expect(crossCheck({ name: 'Abdur Rahim', father_name: 'abdur rahim' })[0].code).toBe('name_equals_father'); expect(crossCheck({ name: 'A B', father_name: 'C D' })).toEqual([]);
  });
  it('the browser date parser agrees with the server date parser on a grid of inputs (one source of truth)', () => {
    const inputs = ['12/03/1990', '12-03-1990', '12.03.1990', '1990-03-12', '১২/০৩/১৯৯০', '12 Mar 1990', '12 March 1990', '১২ মার্চ ১৯৯০', '31/02/1990', '00/01/1990', '12/13/1990', 'garbage', '', '29/02/2000', '29/02/1900', '1/1/1901'];
    for (const i of inputs) expect(clientParse(i), i).toBe(serverParse(i));
  });
});
describe('form coach: speaking into a field', () => {
  it('digit words in English and Bangla become digits', () => {
    expect(fromSpeech('mobile', 'zero one seven one two three four five six seven eight')).toBe('01712345678');
    expect(fromSpeech('nid', 'এক দুই তিন চার পাঁচ ছয় সাত আট নয় শূন্য')).toBe('1234567890');
    expect(fromSpeech('passport', 'A 1 2 3 4 5 6 7 8')).toBe('A12345678');
  });
  it('spoken dates and e-mail addresses', () => {
    expect(v('dob', fromSpeech('dob', '১২ মার্চ ১৯৯০')).value).toBe('1990-03-12');
    expect(v('dob', fromSpeech('dob', '12 March one nine nine zero')).value).toBe('1990-03-12');
    expect(fromSpeech('email', 'rahim at example dot com')).toBe('rahim@example.com');
  });
  it('never invents: unintelligible speech stays as heard and validation explains', () => { expect(v('dob', fromSpeech('dob', 'umm sometime in spring')).level).toBe('error'); });
});
describe('form coach: messages', () => {
  it('every message code the validator can return has both languages', () => {
    for (const [code, m] of Object.entries(MESSAGES as Record<string, { en: unknown; bn: unknown }>)) { if (code === 'empty') continue; expect(m.en, code).toBeTruthy(); expect(m.bn, code).toBeTruthy(); expect(typeof m.en, code).toBe(typeof m.bn); }
    expect(say('nid_length', 'bn', 12)).toContain('১২'); expect(sayDate('1990-03-12', 'bn')).toBe('১২ মার্চ ১৯৯০'); expect(sayDate('1990-03-12', 'en')).toBe('12 March 1990');
  });
  it('every coach field has a label and a hint in both languages and a known kind', () => {
    for (const f of COACH_FIELDS) { expect(f.label.en && f.label.bn && f.hint.en && f.hint.bn, f.id).toBeTruthy(); expect(() => validateField(f.kind, 'x', { today: TODAY })).not.toThrow(); }
  });
});
