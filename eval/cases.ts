import type { ExtractedDoc, Outcome, Verdict } from '../src/types';
import { cleanNid, cleanPassport, f } from '../tests/helpers';

export interface Case {
  name: string;
  nid?: Partial<ExtractedDoc> | null;       // null = document not uploaded
  passport?: Partial<ExtractedDoc> | null;
  /** Rules expected NOT to PASS. Every unlisted rule is expected to PASS. */
  expect: Record<string, Outcome>;
  verdict: Verdict;
}
const ILLEGIBLE = { value: null, confidence: 0.1, legible: false };

export const CASES: Case[] = [
  { name: 'clean_english', expect: {}, verdict: 'READY' },
  { name: 'date_formats_differ_bangla_digits', nid: { dob: f('১২/০৩/১৯৯০') }, passport: { dob: f('12 March 1990') }, expect: {}, verdict: 'READY' },
  { name: 'name_case_and_punctuation_only', nid: { name: f('Md. Abdur Rahim') }, passport: { name: f('MD ABDUR RAHIM') }, expect: {}, verdict: 'READY' },
  { name: 'single_name_equal', nid: { name: f('Mohammad') }, passport: { name: f('Mohammad') }, expect: {}, verdict: 'READY' },
  { name: 'cross_script_name_matches', nid: { name: f('আব্দুর রহিম', 0.95, { romanized: 'Abdur Rahim' }) }, expect: {}, verdict: 'READY' },
  { name: 'nid_number_spaces_bangla_digits', nid: { nid_number: f('১২৩৪ ৫৬৭৮ ৯০') }, expect: {}, verdict: 'READY' },
  { name: 'dob_year_mismatch', passport: { dob: f('12/03/1991') }, expect: { 'RN-010': 'FAIL' }, verdict: 'NOT_READY' },
  { name: 'dob_day_month_swapped', passport: { dob: f('03/12/1990') }, expect: { 'RN-010': 'FAIL' }, verdict: 'NOT_READY' },
  { name: 'name_honorific_missing', nid: { name: f('Md. Abdur Rahim') }, expect: { 'RN-011': 'FAIL' }, verdict: 'ALMOST_READY' },
  { name: 'name_spelling_close', passport: { name: f('Abdur Rohim') }, expect: { 'RN-011': 'FAIL' }, verdict: 'ALMOST_READY' },
  { name: 'name_word_order_swapped', passport: { name: f('Rahim Abdur') }, expect: { 'RN-011': 'FAIL' }, verdict: 'ALMOST_READY' },
  { name: 'name_completely_different', passport: { name: f('Karim Uddin') }, expect: { 'RN-011': 'FAIL' }, verdict: 'ALMOST_READY' },
  { name: 'cross_script_romanization_differs', nid: { name: f('আব্দুর রহিম', 0.95, { romanized: 'Abdur Rohim' }) }, expect: { 'RN-011': 'FAIL' }, verdict: 'ALMOST_READY' },
  { name: 'missing_old_passport', passport: null,
    expect: { 'RN-001': 'FAIL', 'RN-010': 'UNSURE', 'RN-011': 'UNSURE', 'RN-012': 'UNSURE' }, verdict: 'NOT_READY' },
  { name: 'missing_nid', nid: null,
    expect: { 'RN-002': 'FAIL', 'RN-010': 'UNSURE', 'RN-011': 'UNSURE', 'RN-020': 'UNSURE', 'RN-030': 'UNSURE' }, verdict: 'ALMOST_READY' },
  { name: 'low_confidence_nid_dob', nid: { dob: f('12 Mar 1990', 0.5) }, expect: { 'RN-010': 'UNSURE', 'RN-030': 'UNSURE' }, verdict: 'ALMOST_READY' },
  { name: 'illegible_passport_number', passport: { passport_number: ILLEGIBLE }, expect: { 'RN-012': 'UNSURE' }, verdict: 'ALMOST_READY' },
  { name: 'passport_number_absent', passport: { passport_number: f(null) }, expect: { 'RN-012': 'FAIL' }, verdict: 'ALMOST_READY' },
  { name: 'nid_number_too_short', nid: { nid_number: f('12345') }, expect: { 'RN-020': 'FAIL' }, verdict: 'ALMOST_READY' },
  { name: 'applicant_under_18', nid: { dob: f('05/06/2010') }, passport: { dob: f('05/06/2010') }, expect: { 'RN-030': 'FAIL' }, verdict: 'ALMOST_READY' },
  { name: 'dob_unparseable_both', nid: { dob: f('??/03/1990') }, passport: { dob: f('??/03/1990') }, expect: { 'RN-010': 'UNSURE', 'RN-030': 'UNSURE' }, verdict: 'ALMOST_READY' },
  { name: 'dob_impossible_date_both', nid: { dob: f('31/02/1990') }, passport: { dob: f('31/02/1990') }, expect: { 'RN-010': 'UNSURE', 'RN-030': 'UNSURE' }, verdict: 'ALMOST_READY' },
  { name: 'nid_entirely_unreadable',
    nid: { name: ILLEGIBLE, father_name: ILLEGIBLE, mother_name: ILLEGIBLE, dob: ILLEGIBLE, nid_number: ILLEGIBLE },
    expect: { 'RN-002': 'UNSURE', 'RN-010': 'UNSURE', 'RN-011': 'UNSURE', 'RN-020': 'UNSURE', 'RN-030': 'UNSURE' }, verdict: 'ALMOST_READY' },
  { name: 'two_problems_blocker_wins', passport: { dob: f('12/03/1991'), name: f('Abdur Rohim') },
    expect: { 'RN-010': 'FAIL', 'RN-011': 'FAIL' }, verdict: 'NOT_READY' },
];

export function buildSubmission(c: Case) {
  const merge = (base: ExtractedDoc, o?: Partial<ExtractedDoc> | null) => (o === null ? undefined : { ...base, ...o });
  return {
    applicantType: 'adult',
    docs: { nid: merge(cleanNid(), c.nid), old_passport: merge(cleanPassport(), c.passport) },
  };
}
