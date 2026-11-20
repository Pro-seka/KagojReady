/** Labelled retrieval queries. A query passes when ANY accepted card is in the top 3. Out-of-scope queries must be refused (no passages). */
export interface Q { q: string; accept: string[] }
const P = 'bd-passport-adult-renewal', N = 'bd-nid-correction';

// Written while building the system. Used to sanity-check, not as the headline number.
export const DEV: Q[] = [
  { q: 'What do I need to renew my passport?', accept: ['pp-existing', `${P}:overview`, 'pp-identity-doc'] },
  { q: 'My name is spelled differently on my NID and passport', accept: [`${P}:RN-011`, 'pp-name-strictness'] },
  { q: 'Date of birth different on NID and old passport', accept: [`${P}:RN-010`, 'pp-match'] },
  { q: 'I do not have an NID can I use my birth certificate', accept: ['pp-identity-doc'] },
  { q: 'How long does NID correction take', accept: ['nid-slow'] },
  { q: 'What documents are needed to correct date of birth on NID', accept: ['nid-dob-proof'] },
  { q: 'Can I correct my NID twice', accept: ['nid-once'] },
  { q: 'Is there any relief for expats NID correction', accept: ['nid-expat-proposal'] },
  { q: 'Applying for a passport under 18', accept: ['pp-under18', `${P}:RN-030`] },
  { q: 'Is my data stored? privacy', accept: ['kr-privacy'] },
  { q: 'Where do these rules come from', accept: ['kr-sources'] },
  { q: 'my photo is blurry what happens', accept: ['kr-unreadable'] },
  { q: 'passport fee how much', accept: ['kr-no-fees'] },
  { q: 'পাসপোর্ট নবায়নের জন্য কী কী কাগজ লাগে?', accept: ['pp-existing', `${P}:overview`, 'pp-identity-doc'] },
  { q: 'এনআইডি আর পাসপোর্টে নামের বানান আলাদা', accept: [`${P}:RN-011`, 'pp-name-strictness'] },
  { q: 'জন্ম তারিখ মিলছে না', accept: [`${P}:RN-010`, 'pp-match'] },
  { q: 'এনআইডি না থাকলে জন্মনিবন্ধন সনদ দিয়ে হবে?', accept: ['pp-identity-doc'] },
  { q: 'এনআইডি সংশোধনে কত সময় লাগে?', accept: ['nid-slow'] },
  { q: 'জন্ম তারিখ সংশোধনের জন্য কোন কাগজ লাগবে', accept: ['nid-dob-proof'] },
  { q: 'একবার সংশোধন করলে আবার করা যায়?', accept: ['nid-once'] },
  { q: '১৮ বছরের কম বয়সীদের পাসপোর্ট', accept: ['pp-under18', `${P}:RN-030`] },
  { q: 'আমার ছবি কি আপনারা জমা রাখেন?', accept: ['kr-privacy'] },
  { q: 'ফি কত?', accept: ['kr-no-fees'] },
];
export const DEV_OUT: string[] = ['What is the weather in Dhaka today?', 'Who won the cricket match?', 'Recommend a good restaurant', 'আজকের আবহাওয়া কেমন?', 'বিটকয়েনের দাম কত?', 'How do I get a US visa?', 'building permit for a new shop', 'How do I renew my driving licence?'];

// Written afterwards as fresh paraphrases (including hard ones), then run once with nothing tuned. This is the honest number.
export const HELD_OUT: Q[] = [
  { q: 'which papers should I bring for passport renewal', accept: ['pp-existing', `${P}:overview`, 'pp-identity-doc', 'pp-nid-basis'] },
  { q: 'NID shows a different spelling of my name than my old passport', accept: [`${P}:RN-011`, 'pp-name-strictness', 'pp-match'] },
  { q: 'my birth date on the ID card is wrong compared with passport', accept: [`${P}:RN-010`, 'pp-match'] },
  { q: 'can a birth registration certificate replace the national ID', accept: ['pp-identity-doc'] },
  { q: 'is NID correction slow', accept: ['nid-slow'] },
  { q: 'what proof do I need to fix my date of birth on the NID', accept: ['nid-dob-proof'] },
  { q: 'can the same field on the ID be amended a second time', accept: ['nid-once'] },
  { q: 'will Bangladeshis living abroad get easier NID changes', accept: ['nid-expat-proposal'] },
  { q: 'child passport requirements', accept: ['pp-under18', `${P}:RN-030`] },
  { q: 'do you keep my document pictures', accept: ['kr-privacy'] },
  { q: 'how do you know these rules are right', accept: ['kr-sources'] },
  { q: 'the image I took is out of focus', accept: ['kr-unreadable'] },
  { q: 'how much does it cost', accept: ['kr-no-fees'] },
  { q: 'is this an official approval from the government', accept: ['kr-what'] },
  { q: 'নবায়নের সময় কোন কাগজ সঙ্গে নিতে হবে', accept: ['pp-existing', `${P}:overview`, 'pp-identity-doc', 'pp-nid-basis'] },
  { q: 'পাসপোর্টে আমার নামের বানান এনআইডির সঙ্গে মিলছে না', accept: [`${P}:RN-011`, 'pp-name-strictness', 'pp-match'] },
  { q: 'এনআইডি না থাকলে কোন সনদ লাগবে', accept: ['pp-identity-doc'] },
  { q: 'সংশোধনের আবেদনে কতদিন অপেক্ষা করতে হয়', accept: ['nid-slow'] },
  { q: 'জন্ম তারিখ ঠিক করতে কী প্রমাণ দিতে হবে', accept: ['nid-dob-proof'] },
  { q: 'বিদেশে থাকা বাংলাদেশিদের জন্য কোনো ছাড় আছে', accept: ['nid-expat-proposal'] },
  { q: 'আমার তথ্য কি আপনারা সংরক্ষণ করেন', accept: ['kr-privacy'] },
  { q: 'আবেদন কি সরকারি অনুমোদন?', accept: ['kr-what'] },
];
export const HELD_OUT_OUT: string[] = ['What is the capital of France?', 'tell me a joke', 'How do I register a company trade licence in Dhaka?', 'latest exchange rate of the dollar', 'আমাকে একটি গান শোনাও', 'ট্রেড লাইসেন্স কীভাবে করব', 'Can you help me file my income tax return?'];

// A second fresh set, written BEFORE the retrieval was improved so the before/after change can be measured. It is not perfectly blind: the
// synonym lists were written after it was drafted. The first held-out set is now a development set because its failures guided the fix.
export const HELD_OUT_2: Q[] = [
  { q: 'documents required to extend my Bangladeshi passport', accept: ['pp-existing', `${P}:overview`, 'pp-identity-doc'] },
  { q: 'my father name is spelled two ways on my NID and passport', accept: [`${P}:RN-011`, 'pp-name-strictness', 'pp-match'] },
  { q: 'birth year typed wrong on my national ID', accept: [`${P}:RN-010`, 'nid-dob-proof', 'pp-match'] },
  { q: 'I have a birth certificate but my NID was never issued', accept: ['pp-identity-doc'] },
  { q: 'how many weeks will an ID card correction take', accept: ['nid-slow'] },
  { q: 'which certificate is accepted as proof when changing date of birth', accept: ['nid-dob-proof'] },
  { q: 'I already corrected my NID once, can I change it again', accept: ['nid-once'] },
  { q: 'diaspora NID correction relaxation news', accept: ['nid-expat-proposal'] },
  { q: 'minor applying for passport', accept: ['pp-under18', `${P}:RN-030`] },
  { q: 'are my ID pictures kept on your servers', accept: ['kr-privacy'] },
  { q: 'which website did this information come from', accept: ['kr-sources'] },
  { q: 'glare on my passport photo', accept: ['kr-unreadable'] },
  { q: 'what is the price of an e-passport', accept: ['kr-no-fees'] },
  { q: 'does passing your check mean I am approved', accept: ['kr-what'] },
  { q: 'পাসপোর্ট নবায়নে কী কী জিনিস নিয়ে যেতে হবে', accept: ['pp-existing', `${P}:overview`, 'pp-identity-doc', 'pp-nid-basis'] },
  { q: 'এনআইডি ও পাসপোর্টের নাম একরকম নয়', accept: [`${P}:RN-011`, 'pp-name-strictness', 'pp-match'] },
  { q: 'জন্মনিবন্ধন দিয়ে কি পাসপোর্ট হবে যদি এনআইডি না থাকে', accept: ['pp-identity-doc'] },
  { q: 'এনআইডি ঠিক করতে মাস লাগে নাকি বছর', accept: ['nid-slow'] },
  { q: 'জন্মতারিখ বদলাতে কোন সার্টিফিকেট চাই', accept: ['nid-dob-proof'] },
  { q: 'প্রবাসীদের এনআইডি সংশোধনে নতুন কোনো সুবিধা', accept: ['nid-expat-proposal'] },
  { q: 'আপনারা কি আমার কাগজের ছবি সার্ভারে রেখে দেন', accept: ['kr-privacy'] },
  { q: 'এটা কি সরকারি অফিসের সিদ্ধান্ত', accept: ['kr-what'] },
];
export const HELD_OUT_2_OUT: string[] = ['What time does the sun set?', 'translate this sentence to French', 'How to apply for a National Park permit', 'পদ্মা সেতুর টোল কত', 'জমির দলিল কীভাবে করব', 'Explain how photosynthesis works', 'weather forecast for tomorrow', 'বাসের ভাড়া কত'];

export const NID_NOTE = N;
