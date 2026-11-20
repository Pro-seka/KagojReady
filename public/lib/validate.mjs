/**
 * Form Coach field checks. Runs ONLY in the browser: what a person types or says into the coach is never sent anywhere.
 * Pure functions, no DOM, so the same file is unit-tested in Node. Messages are bilingual and keyed by code.
 */
const BN = '০১২৩৪৫৬৭৮৯';
export const toAscii = (s) => String(s ?? '').replace(/[০-৯]/g, (c) => String(BN.indexOf(c)));
const BN_MONTHS = { 'জানুয়ারি': 1, 'জানুয়ারী': 1, 'ফেব্রুয়ারি': 2, 'ফেব্রুয়ারী': 2, 'মার্চ': 3, 'এপ্রিল': 4, 'মে': 5, 'জুন': 6, 'জুলাই': 7, 'আগস্ট': 8, 'আগষ্ট': 8, 'সেপ্টেম্বর': 9, 'অক্টোবর': 10, 'নভেম্বর': 11, 'ডিসেম্বর': 12 };
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = { en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], bn: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'] };

function validYmd(y, m, d) {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/** Numeric dates are day-month-year, the convention on Bangladeshi documents. Month names in English or Bangla are accepted. Returns ISO or null. */
export function parseDate(raw) {
  const s = toAscii(String(raw ?? '')).normalize('NFC').trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/); if (m) return validYmd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/); if (m) return validYmd(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[ -]([^\d\s-]+)[ -](\d{4})$/);
  if (m) { const mo = BN_MONTHS[m[2]] ?? (EN_MONTHS.indexOf(m[2].slice(0, 3)) + 1 || undefined); return mo ? validYmd(+m[3], mo, +m[1]) : null; }
  m = s.match(/^([^\d\s-]+) (\d{1,2}) (\d{4})$/);       // "March 12 1990"
  if (m) { const mo = EN_MONTHS.indexOf(m[1].slice(0, 3)) + 1; return mo ? validYmd(+m[3], mo, +m[2]) : null; }
  return null;
}
export function ageOn(dobIso, todayIso) {
  const [by, bm, bd] = dobIso.split('-').map(Number), [ty, tm, td] = todayIso.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}
export function sayDate(iso, lang) { const [y, m, d] = iso.split('-').map(Number); const num = (n) => (lang === 'bn' ? String(n).replace(/[0-9]/g, (c) => BN[+c]) : String(n)); return `${num(d)} ${MONTH_NAMES[lang][m - 1]} ${num(y)}`; }

export const MESSAGES = {
  empty: { en: '', bn: '' },
  ok: { en: 'Looks right.', bn: 'ঠিক আছে।' },
  name_digits: { en: 'A name should not contain numbers.', bn: 'নামে সংখ্যা থাকা উচিত নয়।' },
  name_script: { en: 'Write your name in English letters, exactly as on your passport or NID (English side).', bn: 'পাসপোর্ট বা এনআইডির ইংরেজি অংশে যেমন আছে, ঠিক তেমন ইংরেজি অক্ষরে নাম লিখুন।' },
  name_short: { en: 'This looks too short for a full name.', bn: 'পূর্ণ নামের জন্য এটি খুব ছোট মনে হচ্ছে।' },
  name_symbols: { en: 'Use letters only. Dots, hyphens and apostrophes are fine.', bn: 'শুধু অক্ষর ব্যবহার করুন। ডট, হাইফেন ও অ্যাপোস্ট্রফি চলবে।' },
  name_one_word: { en: 'Only one word. That is fine if your documents show a single name. Otherwise add the rest.', bn: 'মাত্র একটি শব্দ। কাগজে একটিই নাম থাকলে ঠিক আছে, নইলে বাকি অংশ যোগ করুন।' },
  nid_chars: { en: 'An NID number has digits only.', bn: 'এনআইডি নম্বরে শুধু অঙ্ক থাকে।' },
  nid_length: { en: (n) => `An NID number has 10, 13 or 17 digits. You have ${n}.`, bn: (n) => `এনআইডি নম্বর ১০, ১৩ বা ১৭ অঙ্কের হয়। আপনার ${toBn(n)} অঙ্ক আছে।` },
  mobile_format: { en: 'A Bangladesh mobile number is 11 digits starting with 013 to 019, for example 01712345678.', bn: 'বাংলাদেশের মোবাইল নম্বর ১১ অঙ্কের এবং ০১৩ থেকে ০১৯ দিয়ে শুরু হয়, যেমন ০১৭১২৩৪৫৬৭৮।' },
  email_format: { en: 'This does not look like an e-mail address (name@example.com).', bn: 'এটি ইমেইল ঠিকানার মতো দেখাচ্ছে না (name@example.com)।' },
  passport_format: { en: 'A passport number is one or two capital letters followed by 7 or 8 digits, for example A12345678.', bn: 'পাসপোর্ট নম্বর এক বা দুটি বড় হাতের ইংরেজি অক্ষর এবং তারপর ৭ বা ৮টি অঙ্ক, যেমন A12345678।' },
  date_unreadable: { en: 'I cannot read this as a date. Try 12/03/1990 or 12 March 1990.', bn: 'এটি তারিখ হিসেবে পড়া যাচ্ছে না। ১২/০৩/১৯৯০ বা ১২ মার্চ ১৯৯০ লিখে দেখুন।' },
  dob_future: { en: 'This date is in the future.', bn: 'এই তারিখটি ভবিষ্যতের।' },
  dob_old: { en: 'This would make the person over 120 years old. Check the year.', bn: 'এতে বয়স ১২০ বছরের বেশি হয়। সালটি দেখে নিন।' },
  dob_minor: { en: (a) => `This makes the applicant ${a} years old. Under 18 follows different rules, and this service covers adults only.`, bn: (a) => `এতে আবেদনকারীর বয়স ${toBn(a)} বছর। ১৮ বছরের কম বয়সীদের নিয়ম আলাদা, আর এই সেবা শুধু প্রাপ্তবয়স্কদের জন্য।` },
  expiry_past: { en: 'This date has already passed. An expired passport may need a different process. Confirm with the office.', bn: 'এই তারিখ পার হয়ে গেছে। মেয়াদোত্তীর্ণ পাসপোর্টের প্রক্রিয়া আলাদা হতে পারে। অফিসে নিশ্চিত হয়ে নিন।' },
  read_as: { en: (s) => `Read as ${s}.`, bn: (s) => `${s} হিসেবে পড়া হয়েছে।` },
};
function toBn(n) { return String(n).replace(/[0-9]/g, (c) => BN[+c]); }
export const say = (code, lang, arg) => { const m = MESSAGES[code]?.[lang]; return typeof m === 'function' ? m(arg) : m ?? ''; };

const res = (level, code, value, arg) => ({ level, code, value, arg });   // level: empty | ok | warn | error
/**
 * Checks one field. `kind` is one of: name_en, nid, mobile, email, passport, dob, expiry.
 * Returns { level, code, value (cleaned), arg }. Nothing is ever blocked: a warning explains, an error says what to fix.
 */
export function validateField(kind, raw, ctx = {}) {
  const v = String(raw ?? '').trim(); const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  if (!v) return res('empty', 'empty', '');
  if (kind === 'name_en') {
    const s = v.replace(/\s+/g, ' ');
    if (/[\u0980-\u09FF]/.test(s)) return res('error', 'name_script', s);
    if (/\d/.test(toAscii(s))) return res('error', 'name_digits', s);
    if (/[^A-Za-z .'’-]/.test(s)) return res('error', 'name_symbols', s);
    if (s.replace(/[^A-Za-z]/g, '').length < 3) return res('error', 'name_short', s);
    if (!s.includes(' ')) return res('warn', 'name_one_word', s);
    return res('ok', 'ok', s);
  }
  if (kind === 'nid') {
    const d = toAscii(v).replace(/[\s-]/g, '');
    if (!/^\d+$/.test(d)) return res('error', 'nid_chars', d);
    if (![10, 13, 17].includes(d.length)) return res('error', 'nid_length', d, d.length);
    return res('ok', 'ok', d);
  }
  if (kind === 'mobile') {
    let d = toAscii(v).replace(/[\s()-]/g, ''); if (d.startsWith('+')) d = d.slice(1); if (d.startsWith('880')) d = `0${d.slice(3)}`;
    return /^01[3-9]\d{8}$/.test(d) ? res('ok', 'ok', d) : res('error', 'mobile_format', d);
  }
  if (kind === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? res('ok', 'ok', v.toLowerCase()) : res('error', 'email_format', v);
  if (kind === 'passport') { const s = v.replace(/\s/g, '').toUpperCase(); return /^[A-Z]{1,2}\d{7,8}$/.test(toAscii(s)) ? res('ok', 'ok', toAscii(s)) : res('error', 'passport_format', s); }
  if (kind === 'dob' || kind === 'expiry') {
    const iso = parseDate(v); if (!iso) return res('error', 'date_unreadable', v);
    if (kind === 'dob') {
      if (iso > today) return res('error', 'dob_future', iso);
      const a = ageOn(iso, today); if (a > 120) return res('error', 'dob_old', iso);
      if (a < 18) return res('warn', 'dob_minor', iso, a);
    } else if (iso < today) return res('warn', 'expiry_past', iso);
    return res('ok', 'read_as', iso);
  }
  throw new Error(`unknown field kind ${kind}`);
}

// ---------- speaking into a field ----------
const DIGIT_WORDS = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, 'শূন্য': 0, 'এক': 1, 'দুই': 2, 'দুই.': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5, 'ছয়': 6, 'ছয়.': 6, 'সাত': 7, 'আট': 8, 'নয়': 9 };
/**
 * Turns what speech recognition heard into a candidate value for the field. Handles spoken digits in English and Bangla ("এক দুই তিন", "one two three"),
 * "at"/"dot" in e-mail addresses, and dates. It never guesses: if nothing sensible comes out the original text is returned and validation explains.
 */
export function fromSpeech(kind, transcript) {
  let t = toAscii(String(transcript ?? '')).normalize('NFC').trim();
  if (kind === 'email') return t.toLowerCase().replace(/\s+at\s+|\s*অ্যাট\s*/g, '@').replace(/\s+dot\s+|\s*ডট\s*/g, '.').replace(/\s+/g, '');
  if (kind === 'name_en') return t.replace(/\s+/g, ' ');
  if (kind === 'dob' || kind === 'expiry') {
    const tokens = t.toLowerCase().replace(/,/g, ' ').split(/\s+/).map((w) => (w in DIGIT_WORDS ? String(DIGIT_WORDS[w]) : w));
    return tokens.join(' ').replace(/(\d) (?=\d)/g, '$1');   // "1 9 9 0" -> "1990"
  }
  // nid, mobile, passport: digits and capital letters
  const parts = t.split(/[\s,.-]+/).filter(Boolean).map((w) => (w.toLowerCase() in DIGIT_WORDS ? String(DIGIT_WORDS[w.toLowerCase()]) : w));
  return parts.join('');
}

/** The fields of the coach, in order. `hint` explains where to find the value on a document. */
export const COACH_FIELDS = [
  { id: 'name', kind: 'name_en', label: { en: 'Full name (English)', bn: 'পূর্ণ নাম (ইংরেজি)' }, hint: { en: 'As printed in English on your NID or passport.', bn: 'এনআইডি বা পাসপোর্টে ইংরেজিতে যেমন ছাপা আছে।' } },
  { id: 'father_name', kind: 'name_en', label: { en: 'Father’s name (English)', bn: 'পিতার নাম (ইংরেজি)' }, hint: { en: 'As printed in English on your NID.', bn: 'এনআইডিতে ইংরেজিতে যেমন ছাপা আছে।' } },
  { id: 'dob', kind: 'dob', label: { en: 'Date of birth', bn: 'জন্ম তারিখ' }, hint: { en: 'Day, month, year. For example 12/03/1990.', bn: 'দিন, মাস, সাল। যেমন ১২/০৩/১৯৯০।' } },
  { id: 'nid', kind: 'nid', label: { en: 'NID number', bn: 'এনআইডি নম্বর' }, hint: { en: '10, 13 or 17 digits.', bn: '১০, ১৩ বা ১৭ অঙ্ক।' } },
  { id: 'passport', kind: 'passport', label: { en: 'Current passport number', bn: 'বর্তমান পাসপোর্ট নম্বর' }, hint: { en: 'Letters then digits, for example A12345678.', bn: 'অক্ষর ও তারপর অঙ্ক, যেমন A12345678।' } },
  { id: 'expiry', kind: 'expiry', label: { en: 'Passport expiry date', bn: 'পাসপোর্টের মেয়াদ শেষের তারিখ' }, hint: { en: 'Printed on the data page.', bn: 'ডেটা পাতায় ছাপা আছে।' } },
  { id: 'mobile', kind: 'mobile', label: { en: 'Mobile number', bn: 'মোবাইল নম্বর' }, hint: { en: 'For example 01712345678.', bn: 'যেমন ০১৭১২৩৪৫৬৭৮।' } },
  { id: 'email', kind: 'email', label: { en: 'E-mail (optional)', bn: 'ইমেইল (ঐচ্ছিক)' }, hint: { en: 'Leave empty if you do not have one.', bn: 'না থাকলে ফাঁকা রাখুন।' }, optional: true },
];

/** Cross-field checks that need two answers. Return a list of { fields, code } warnings. */
export function crossCheck(values, ctx = {}) {
  const out = []; const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  const dob = values.dob ? parseDate(values.dob) : null, exp = values.expiry ? parseDate(values.expiry) : null;
  if (dob && exp && exp <= dob) out.push({ fields: ['dob', 'expiry'], code: 'expiry_before_birth' });
  if (values.name && values.father_name && values.name.trim().toLowerCase() === values.father_name.trim().toLowerCase()) out.push({ fields: ['name', 'father_name'], code: 'name_equals_father' });
  void today; return out;
}
MESSAGES.expiry_before_birth = { en: 'The expiry date is before the date of birth. Check both dates.', bn: 'মেয়াদ শেষের তারিখ জন্ম তারিখের আগে। দুটি তারিখই দেখে নিন।' };
MESSAGES.name_equals_father = { en: 'Your name and your father’s name are identical. Check that you did not copy one into the other.', bn: 'আপনার নাম ও পিতার নাম হুবহু এক। একটির নাম অন্যটিতে লেখা হয়নি তো, দেখে নিন।' };
