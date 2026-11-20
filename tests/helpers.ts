import type { ExtractedDoc, ExtractedField, Submission } from '../src/types';

export const f = (value: string | null, confidence = 0.95, extra: Partial<ExtractedField> = {}): ExtractedField =>
  ({ value, confidence, legible: true, ...extra });

export const cleanNid = (): ExtractedDoc => ({
  name: f('Abdur Rahim'), father_name: f('Karim Uddin'), mother_name: f('Rahima Begum'),
  dob: f('12 Mar 1990'), nid_number: f('1234567890'),
});
export const cleanPassport = (): ExtractedDoc => ({
  name: f('Abdur Rahim'), dob: f('12/03/1990'), passport_number: f('A12345678'), expiry_date: f('01/01/2027'),
});
export const cleanSubmission = (): Submission => ({
  applicantType: 'adult', docs: { nid: cleanNid(), old_passport: cleanPassport() },
});
export const TODAY = '2026-10-20';

// ---- extraction test helpers ----
export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
export const dataUrl = (b: Buffer, type = 'image/jpeg') => `data:${type};base64,${b.toString('base64')}`;

type Out = Record<string, { value: string | null; romanized?: string | null; confidence?: number; legible?: boolean }>;
export const reply = (fields: Out, isExpected = true) =>
  JSON.stringify({ is_expected_document: isExpected, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) =>
    [k, { romanized: null, confidence: 0.95, legible: true, ...v }])) });

export const NID_REPLY = reply({
  name: { value: 'Abdur Rahim' }, father_name: { value: 'Karim Uddin' }, mother_name: { value: 'Rahima Begum' },
  dob: { value: '12 Mar 1990' }, nid_number: { value: '1234567890' },
});
export const PASSPORT_REPLY = reply({
  name: { value: 'Abdur Rahim' }, dob: { value: '12/03/1990' }, passport_number: { value: 'A12345678' }, expiry_date: { value: '01/01/2027' },
});
/** A fake model: picks the reply by which document the prompt asks for. */
export function fakeLlm(replies: { nid?: string; old_passport?: string } = {}, calls: { n: number } = { n: 0 }) {
  return {
    async complete(req: { userText: string; image?: unknown }) {
      calls.n++;
      return req.userText.includes('National ID') ? (replies.nid ?? NID_REPLY) : (replies.old_passport ?? PASSPORT_REPLY);
    },
  };
}
