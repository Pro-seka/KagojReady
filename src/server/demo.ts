import type { LlmClient } from '../extract/types';

const R = (fields: Record<string, string>) => JSON.stringify({ is_expected_document: true, fields: Object.fromEntries(
  Object.entries(fields).map(([k, v]) => [k, { value: v, romanized: null, confidence: 0.95, legible: true }])) });

/**
 * Demo only: does NOT read the photo. It alternates, so a live demo is predictable: the first check finds matching documents ("looks ready"),
 * the second finds a date-of-birth mismatch ("not ready"), the third matches again, and so on. A check counts when a passport photo is added.
 */
export function makeDemoLlm(): LlmClient {
  let passportReads = 0;
  return {
    async complete(req) {
      if (req.userText.includes('National ID'))
        return R({ name: 'Abdur Rahim', father_name: 'Karim Uddin', mother_name: 'Rahima Begum', dob: '12 Mar 1990', nid_number: '1234567890' });
      passportReads++;
      return R({ name: 'Abdur Rahim', dob: passportReads % 2 === 0 ? '12/03/1991' : '12/03/1990', passport_number: 'A12345678', expiry_date: '01/01/2027' });
    },
  };
}
