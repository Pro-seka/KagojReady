(() => {
'use strict';
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bn = (n) => String(n).replace(/[0-9]/g, (d) => BN_DIGITS[+d]);
const T = {
  en: {
    app: 'KagojReady', langLabel: 'Language', privacy: 'Privacy', newChat: 'New chat', attach: 'Check my documents', send: 'Send', mic: 'Voice typing',
    greet: 'How can I help with a government service today?', sub: 'Ask in Bangla or English. I answer from official sources, and I can check your documents before you travel.',
    placeholder: 'Ask about passports, NID or documents…', fine: 'A pre-check, not an official approval. Answers come from the sources shown.',
    prompts: ['What do I need to renew my passport?', 'My name is spelled differently on my NID and passport', 'How long does an NID correction take?', 'Check my documents'],
    consentTitle: 'Before you start', c1: 'Your questions and photos are sent to an AI service so it can read and answer. This service does not keep them.',
    c2: 'Phone, ID, passport and e-mail numbers you type are hidden before the text goes to the AI. Photos are deleted from this page as soon as a check finishes.',
    c3: 'This is a pre-check, not an official approval, and it is not connected to any government office.', c4: 'If you use voice typing, your browser’s own speech service hears your voice.',
    accept: 'I understand', close: 'Close', demo: 'Demo mode: results are not read from your photos.',
    freeTier: 'Free AI tier: the AI provider may use these photos to improve its products. Use sample documents only, not real ID papers.',
    draft: 'Draft guidance: these rules are not verified yet. Confirm with the office.', stale: 'This guidance may be out of date. Confirm with the office.',
    sources: (n) => `Sources (${n})`, checked: 'Last checked', how: 'How I answered', helpful: 'Helpful', notHelpful: 'Not helpful', thanks: 'Thanks for the feedback.',
    official: 'Official source', operator_reported: 'Reported by operators', unconfirmed: 'Not confirmed', product: 'KagojReady note',
    checkDocs: 'Check my documents', pickService: 'Which service do you want to check documents for?',
    s_redacted: 'Hid personal numbers before sending', s_retrieved: (n) => `Searched the sources and found ${n} relevant passage${n === 1 ? '' : 's'}`, s_none: 'No source covered this, so I did not guess',
    s_llm: 'Wrote the answer with AI, using only those passages', s_validated: 'Checked every citation and number against the sources', s_no_llm: 'No AI was used: showing the sources directly',
    s_llm_failed: 'The AI was unavailable, so I am showing the sources directly', s_rejected: 'The AI answer did not pass the checks, so I am showing the sources directly', s_intent: 'You asked me to check documents',
    formTitle: 'Add your documents', addPhoto: 'Take or choose photo', replacePhoto: 'Replace photo', added: 'Photo added', photoBad: 'This photo cannot be used. Use a JPEG or PNG photo.',
    check: 'Check my documents', checking: 'Checking…', cancel: 'Cancel', needOne: 'Add at least one document to continue.', again: 'Check again',
    READY: 'Looks ready', ALMOST_READY: 'Almost ready', NOT_READY: 'Not ready',
    vREADY: 'No problems found in the documents you added.', vALMOST_READY: 'Check the items below before you go.', vNOT_READY: 'Fix the items below before you go.',
    fix: 'What to fix', passed: (n) => `${n} check${n === 1 ? '' : 's'} passed`, why: 'Why this was flagged', rule: 'Rule', lastVerified: 'Last verified', notVerified: 'Not verified yet', source: 'Source',
    ruleOfficial: 'From an official source', ruleOperator: 'Reported by service operators', ruleUnconfirmed: 'Not confirmed yet. Check with the office.',
    fixFirst: 'Fix this first:', unsure: 'We could not check this.', tipLabel: 'Photo tip:',
    document_missing: 'Add this document to continue.', unreadable: 'We could not read this clearly. Retake the photo.', low_confidence: 'We could not read this clearly. Retake the photo.',
    not_extracted: 'We could not read this clearly. Retake the photo.', absent: 'We could not read this clearly. Retake the photo.', unparseable_date: 'The date could not be read. Retake the photo.', not_comparable: 'The two documents could not be compared. Retake the photos.',
    wrong_document: 'This does not look like the right document.', invalid_output: 'We could not read this photo. Retake it.', service_error: 'The reading service had a problem. Try again.', bad_image: 'This photo cannot be used. Use a JPEG or PNG photo.',
    readTitle: 'What we read from your photos', readHint: 'If something is wrong, retake that photo.', unclearValue: 'Not clear',
    errNet: 'I could not reach the service. Please try again.', errRate: 'Too many requests. Please wait a few minutes.', errUnavailable: 'This service is not available right now.', loadErr: 'Could not load the list of services.',
    voiceErr: 'Voice typing is not available right now.', cleared: 'Conversation cleared. Nothing was kept.', announceBot: 'New reply',
    s_typo_fixed: 'Fixed a likely typo in your question', s_romanized: 'Read your romanized Bangla as Bangla words', s_out_of_scope: 'This is a service I do not cover yet, so I did not guess',
    lanesLabel: 'What do you want to do?', laneAsk: 'Ask', laneCheck: 'Check documents', listen: 'Listen', stopListen: 'Stop', print: 'Print or save checklist', large: 'Larger text',
    sheetTitle: 'Visit checklist', sheetBring: 'Bring these', sheetFix: 'Fix before you go', sheetNone: 'No problems were found in the documents you added.', sheetNote: 'This sheet contains none of your personal details. It lists only document names and what to fix.', sheetDate: 'Prepared on',
    fields: { name: 'Name', father_name: 'Father’s name', mother_name: 'Mother’s name', dob: 'Date of birth', nid_number: 'NID number', passport_number: 'Passport number', expiry_date: 'Date of expiry' },
  },
  bn: {
    app: 'কাগজ রেডি', langLabel: 'ভাষা', privacy: 'গোপনীয়তা', newChat: 'নতুন চ্যাট', attach: 'আমার কাগজ যাচাই করুন', send: 'পাঠান', mic: 'কণ্ঠে লিখুন',
    greet: 'আজ কোন সরকারি সেবায় সাহায্য করতে পারি?', sub: 'বাংলা বা ইংরেজিতে জিজ্ঞাসা করুন। আমি সরকারি সূত্র থেকে উত্তর দিই, আর যাওয়ার আগে আপনার কাগজ যাচাই করে দিতে পারি।',
    placeholder: 'পাসপোর্ট, এনআইডি বা কাগজ নিয়ে জিজ্ঞাসা করুন…', fine: 'এটি প্রাথমিক যাচাই, সরকারি অনুমোদন নয়। উত্তর দেখানো সূত্র থেকে আসে।',
    prompts: ['পাসপোর্ট নবায়নের জন্য কী কী কাগজ লাগে?', 'এনআইডি আর পাসপোর্টে আমার নামের বানান আলাদা', 'এনআইডি সংশোধনে কত সময় লাগে?', 'আমার কাগজ যাচাই করুন'],
    consentTitle: 'শুরু করার আগে', c1: 'আপনার প্রশ্ন ও ছবি পড়া ও উত্তর দেওয়ার জন্য একটি এআই সেবার কাছে পাঠানো হয়। এই সেবা সেগুলো সংরক্ষণ করে না।',
    c2: 'আপনি যে ফোন, আইডি, পাসপোর্ট ও ইমেইল নম্বর লিখবেন, এআইকে পাঠানোর আগেই তা লুকিয়ে ফেলা হয়। যাচাই শেষ হলেই ছবি এই পাতা থেকে মুছে যায়।',
    c3: 'এটি প্রাথমিক যাচাই, সরকারি অনুমোদন নয়, এবং কোনো সরকারি অফিসের সঙ্গে যুক্ত নয়।', c4: 'কণ্ঠে লিখলে আপনার ব্রাউজারের নিজস্ব স্পিচ সেবা আপনার কণ্ঠ শুনতে পায়।',
    accept: 'বুঝেছি', close: 'বন্ধ করুন', demo: 'ডেমো মোড: ফলাফল আপনার ছবি থেকে পড়া হয়নি।',
    freeTier: 'বিনামূল্যের এআই সেবা: এআই সেবাদাতা এই ছবিগুলো তাদের পণ্য উন্নত করতে ব্যবহার করতে পারে। শুধু নমুনা কাগজ ব্যবহার করুন, আসল পরিচয়পত্র নয়।',
    draft: 'খসড়া নির্দেশনা: নিয়মগুলো এখনো যাচাই করা হয়নি। অফিসে নিশ্চিত হয়ে নিন।', stale: 'এই নির্দেশনা পুরোনো হতে পারে। অফিসে নিশ্চিত হয়ে নিন।',
    sources: (n) => `সূত্র (${bn(n)})`, checked: 'সর্বশেষ দেখা হয়েছে', how: 'কীভাবে উত্তর দিলাম', helpful: 'সহায়ক', notHelpful: 'সহায়ক নয়', thanks: 'মতামতের জন্য ধন্যবাদ।',
    official: 'সরকারি সূত্র', operator_reported: 'অপারেটরদের তথ্য', unconfirmed: 'নিশ্চিত নয়', product: 'কাগজরেডির নোট',
    checkDocs: 'আমার কাগজ যাচাই করুন', pickService: 'কোন সেবার জন্য কাগজ যাচাই করবেন?',
    s_redacted: 'পাঠানোর আগে ব্যক্তিগত নম্বর লুকানো হয়েছে', s_retrieved: (n) => `সূত্রে খুঁজে ${bn(n)}টি প্রাসঙ্গিক অংশ পাওয়া গেছে`, s_none: 'কোনো সূত্রে এটি নেই, তাই আন্দাজ করিনি',
    s_llm: 'শুধু ওই অংশগুলো থেকে এআই দিয়ে উত্তর লেখা হয়েছে', s_validated: 'প্রতিটি উদ্ধৃতি ও সংখ্যা সূত্রের সঙ্গে মিলিয়ে দেখা হয়েছে', s_no_llm: 'এআই ব্যবহার হয়নি: সূত্র সরাসরি দেখানো হচ্ছে',
    s_llm_failed: 'এআই পাওয়া যায়নি, তাই সূত্র সরাসরি দেখানো হচ্ছে', s_rejected: 'এআইয়ের উত্তর যাচাইয়ে টেকেনি, তাই সূত্র সরাসরি দেখানো হচ্ছে', s_intent: 'আপনি কাগজ যাচাই করতে বলেছেন',
    formTitle: 'আপনার কাগজ যোগ করুন', addPhoto: 'ছবি তুলুন বা বেছে নিন', replacePhoto: 'ছবি বদলান', added: 'ছবি যোগ হয়েছে', photoBad: 'এই ছবি ব্যবহার করা যাবে না। JPEG বা PNG ছবি ব্যবহার করুন।',
    check: 'যাচাই করুন', checking: 'যাচাই চলছে…', cancel: 'বাতিল', needOne: 'এগিয়ে যেতে অন্তত একটি কাগজ যোগ করুন।', again: 'আবার যাচাই করুন',
    READY: 'প্রস্তুত মনে হচ্ছে', ALMOST_READY: 'প্রায় প্রস্তুত', NOT_READY: 'প্রস্তুত নয়',
    vREADY: 'আপনার দেওয়া কাগজে কোনো সমস্যা পাওয়া যায়নি।', vALMOST_READY: 'যাওয়ার আগে নিচের বিষয়গুলো দেখে নিন।', vNOT_READY: 'যাওয়ার আগে নিচের বিষয়গুলো ঠিক করুন।',
    fix: 'যা ঠিক করতে হবে', passed: (n) => `${bn(n)}টি যাচাই ঠিক আছে`, why: 'কেন এটি চিহ্নিত হয়েছে', rule: 'নিয়ম', lastVerified: 'সর্বশেষ যাচাই', notVerified: 'এখনো যাচাই হয়নি', source: 'সূত্র',
    ruleOfficial: 'সরকারি সূত্র থেকে', ruleOperator: 'সেবা কেন্দ্রের অপারেটরদের তথ্য', ruleUnconfirmed: 'এখনো নিশ্চিত নয়। অফিসে যাচাই করুন।',
    fixFirst: 'আগে এটি ঠিক করুন:', unsure: 'এটি যাচাই করা যায়নি।', tipLabel: 'ছবি তোলার পরামর্শ:',
    document_missing: 'এগিয়ে যেতে এই কাগজটি যোগ করুন।', unreadable: 'এটি স্পষ্ট পড়া যায়নি। ছবিটি আবার তুলুন।', low_confidence: 'এটি স্পষ্ট পড়া যায়নি। ছবিটি আবার তুলুন।',
    not_extracted: 'এটি স্পষ্ট পড়া যায়নি। ছবিটি আবার তুলুন।', absent: 'এটি স্পষ্ট পড়া যায়নি। ছবিটি আবার তুলুন।', unparseable_date: 'তারিখটি পড়া যায়নি। ছবিটি আবার তুলুন।', not_comparable: 'দুটি কাগজ মেলানো যায়নি। ছবিগুলো আবার তুলুন।',
    wrong_document: 'এটি সঠিক কাগজ বলে মনে হচ্ছে না।', invalid_output: 'এই ছবি পড়া যায়নি। আবার তুলুন।', service_error: 'পড়ার সেবায় সমস্যা হয়েছে। আবার চেষ্টা করুন।', bad_image: 'এই ছবি ব্যবহার করা যাবে না। JPEG বা PNG ছবি ব্যবহার করুন।',
    readTitle: 'আপনার ছবি থেকে যা পড়া হয়েছে', readHint: 'কিছু ভুল হলে সেই ছবিটি আবার তুলুন।', unclearValue: 'স্পষ্ট নয়',
    errNet: 'সেবার সঙ্গে যোগাযোগ করা যায়নি। আবার চেষ্টা করুন।', errRate: 'অনেক বেশি অনুরোধ। কয়েক মিনিট অপেক্ষা করুন।', errUnavailable: 'এই সেবা এখন পাওয়া যাচ্ছে না।', loadErr: 'সেবার তালিকা লোড করা যায়নি।',
    voiceErr: 'কণ্ঠে লেখা এখন পাওয়া যাচ্ছে না।', cleared: 'কথোপকথন মুছে ফেলা হয়েছে। কিছু রাখা হয়নি।', announceBot: 'নতুন উত্তর',
    s_typo_fixed: 'আপনার প্রশ্নে সম্ভাব্য বানান ভুল ঠিক করে নেওয়া হয়েছে', s_romanized: 'ইংরেজি হরফে লেখা বাংলা শব্দ বাংলা হিসেবে পড়া হয়েছে', s_out_of_scope: 'এই সেবা এখনো আমি দেখি না, তাই আন্দাজ করিনি',
    lanesLabel: 'আপনি কী করতে চান?', laneAsk: 'জিজ্ঞাসা', laneCheck: 'কাগজ যাচাই', listen: 'শুনুন', stopListen: 'থামান', print: 'চেকলিস্ট প্রিন্ট বা সেভ করুন', large: 'বড় লেখা',
    sheetTitle: 'যাওয়ার চেকলিস্ট', sheetBring: 'এগুলো সঙ্গে নিন', sheetFix: 'যাওয়ার আগে ঠিক করুন', sheetNone: 'আপনার দেওয়া কাগজে কোনো সমস্যা পাওয়া যায়নি।', sheetNote: 'এই পাতায় আপনার কোনো ব্যক্তিগত তথ্য নেই। শুধু কাগজের নাম ও কী ঠিক করতে হবে তা আছে।', sheetDate: 'তৈরির তারিখ',
    fields: { name: 'নাম', father_name: 'পিতার নাম', mother_name: 'মাতার নাম', dob: 'জন্ম তারিখ', nid_number: 'এনআইডি নম্বর', passport_number: 'পাসপোর্ট নম্বর', expiry_date: 'মেয়াদ শেষের তারিখ' },
  },
};

const S = { lang: 'bn', consented: false, services: null, llm: null, demo: false, chat: true, reports: false, lane: 'ask', msgs: [], busy: false, form: null, listening: false, speaking: false, seq: 0 };
const t = (k) => T[S.lang][k];
const $ = (id) => document.getElementById(id);
const thread = $('thread'), input = $('input'), chatEl = $('chat');

function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (let [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('aria-') && typeof v === 'boolean') v = String(v);      // aria-pressed="false" must be written out, and "true" must not become an empty attribute
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v; else if (k === 'on') for (const [e, f] of Object.entries(v)) n.addEventListener(e, f);
    else if (v === true) n.setAttribute(k, ''); else n.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return n;
}
const SVG = 'http://www.w3.org/2000/svg';
function icon(d, cls) {
  const s = document.createElementNS(SVG, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'icon' + (cls ? ' ' + cls : '')); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', d); s.append(p); return s;
}
const THUMB = 'M7 10v12M15 5.9L14 10h5.8a2 2 0 011.9 2.6l-2.3 8a2 2 0 01-1.9 1.4H4a2 2 0 01-2-2v-8a2 2 0 012-2h2.8a2 2 0 001.8-1.1L12 2a3.1 3.1 0 013 3.9z';
const MARK = 'M6 12l4 4 8-8';
const safeUrl = (u) => /^https?:\/\//.test(u || '');
const pick = (o, base) => o[`${base}_${S.lang}`] ?? '';

// ---------- network ----------
async function api(path, body) {
  const r = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r;
}
const errKey = (status) => (status === 429 ? 'errRate' : status === 503 || status === 404 ? 'errUnavailable' : 'errNet');

async function loadServices() {
  try {
    const r = await api('/api/services'); if (!r.ok) throw new Error();
    const d = await r.json(); S.services = d.services; S.demo = d.demo; S.llm = d.llm; S.chat = d.chat !== false; S.reports = d.reports === true;
  } catch { S.services = []; push({ role: 'bot', kind: 'text', key: 'loadErr', err: true }); }
  renderBanners(); renderLanes(); syncComposer(); render();
}

// ---------- messages ----------
function push(m) { m.id = ++S.seq; S.msgs.push(m); return m; }
function drop(pred) { S.msgs = S.msgs.filter((m) => !pred(m)); }

async function sendMessage(text) {
  text = text.trim();
  if (!text || S.busy || !S.consented) return;
  S.busy = true; push({ role: 'user', text }); const typing = push({ role: 'bot', kind: 'typing' }); input.value = ''; autosize(); syncComposer(); render(true);
  try {
    const r = await api('/api/chat', { message: text, lang: S.lang });
    drop((m) => m === typing);
    if (!r.ok) push({ role: 'bot', kind: 'text', key: errKey(r.status), err: true });
    else {
      const d = await r.json(); push({ role: 'bot', kind: 'answer', data: d, fb: null }); $('announce').textContent = t('announceBot');
      if (d.mode === 'action' && d.actions[0]) startCheck(d.actions[0].packId, false);
    }
  } catch { drop((m) => m === typing); push({ role: 'bot', kind: 'text', key: 'errNet', err: true }); }
  finally { S.busy = false; syncComposer(); render(true); }
}

function feedback(m, helpful, kind, topic) {
  if (m.fb) return; m.fb = helpful ? 'up' : 'down'; render();
  api('/api/feedback', { kind, helpful, topic: /^[A-Za-z0-9:_-]{1,60}$/.test(topic) ? topic : 'general' }).catch(() => {});
}
function fbRow(m, kind, topic) {
  return el('div', { class: 'fb' },
    m.fb ? el('span', { role: 'status' }, t('thanks')) : [
      el('button', { type: 'button', class: 'iconbtn', 'data-fb': 'up', 'aria-label': t('helpful'), on: { click: () => feedback(m, true, kind, topic) } }, icon(THUMB)),
      el('button', { type: 'button', class: 'iconbtn', 'data-fb': 'down', 'aria-label': t('notHelpful'), on: { click: () => feedback(m, false, kind, topic) } }, icon(THUMB, 'down'))]);
}

// ---------- read aloud (the browser's own speech voice; nothing is sent to us) ----------
const canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
function speak(text) {
  if (!canSpeak) return;
  if (S.speaking) { speechSynthesis.cancel(); S.speaking = false; render(); return; }
  const u = new SpeechSynthesisUtterance(String(text).replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim()); u.lang = S.lang === 'bn' ? 'bn-BD' : 'en-US'; u.rate = 0.95;
  u.onend = u.onerror = () => { S.speaking = false; render(); }; S.speaking = true; speechSynthesis.speak(u); render();
}
const listenBtn = (text) => canSpeak && el('button', { type: 'button', class: 'btn ghost', 'data-listen': true, 'aria-pressed': S.speaking, on: { click: () => speak(text) } }, S.speaking ? t('stopListen') : t('listen'));

// ---------- answer ----------
function stepText(code) {
  if (code.startsWith('redacted:')) return t('s_redacted');
  if (code.startsWith('retrieved:')) { const n = Number(code.split(':')[1]); return n === 0 ? t('s_none') : t('s_retrieved')(n); }
  if (code === 'abstained') return null;
  if (code === 'typo_fixed' || code === 'romanized' || code === 'out_of_scope') return t(`s_${code}`);
  if (code.startsWith('rejected:')) return t('s_rejected');
  if (code.startsWith('intent:')) return t('s_intent');
  return t(`s_${code}`) || null;
}
function citeParts(par, n, mid) {
  return par.split(/(\[\d+\])/).map((chunk) => {
    const m = /^\[(\d+)\]$/.exec(chunk); const k = m ? Number(m[1]) : 0;
    if (!m || k < 1 || k > n) return chunk;
    return el('button', { type: 'button', class: 'cite', 'data-cite': k, 'aria-label': `${t('sources')(n)} ${k}`, on: { click: () => openSource(mid, k) } }, String(k));
  });
}
function openSource(mid, k) {
  const box = document.getElementById(`src-${mid}`); if (box) box.open = true;
  const li = document.getElementById(`src-${mid}-${k}`); if (!li) return;
  li.parentNode.querySelectorAll('.hl').forEach((x) => x.classList.remove('hl')); li.classList.add('hl'); li.focus(); if (li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
}
function sourcesBlock(m) {
  const ps = m.data.passages;
  return el('details', { id: `src-${m.id}` }, el('summary', null, t('sources')(ps.length)),
    el('ol', { class: 'src' }, ps.map((p) => el('li', { id: `src-${m.id}-${p.n}`, tabindex: '-1' },
      el('b', null, `${p.n}. ${p.title}`), el('span', { class: `tag ${p.status}` }, t(p.status)),
      el('p', { class: 'sm' }, p.snippet.length > 230 ? `${p.snippet.slice(0, 230)}…` : p.snippet),
      p.source && el('p', { class: 'sm' }, safeUrl(p.source.url) ? el('a', { href: p.source.url, target: '_blank', rel: 'noopener noreferrer' }, p.source.label) : p.source.label, ` · ${t('checked')}: ${p.source.retrieved}`)))));
}
function howBlock(d) {
  const lines = []; let hid = false;
  for (const c of d.steps) { const s = stepText(c); if (!s || (c.startsWith('redacted:') && hid)) continue; if (c.startsWith('redacted:')) hid = true; lines.push(s); }
  if (!lines.length) return null;
  return el('details', null, el('summary', null, t('how')), el('ul', { class: 'read' }, lines.map((l) => el('li', null, l))));
}
function viewAnswer(m) {
  const d = m.data, n = d.passages.length;
  return el('div', { class: 'body' },
    d.answer.split(/\n+/).filter(Boolean).map((par) => el('p', null, citeParts(par, n, m.id))),
    n > 0 && sourcesBlock(m),
    (d.actions.length > 0 || canSpeak) && el('div', { class: 'actions' }, d.actions.map((a) => el('button', { type: 'button', class: 'btn', on: { click: () => startCheck(a.packId) } }, t('checkDocs'))), d.mode !== 'abstained' && listenBtn(d.answer)),
    howBlock(d), fbRow(m, 'answer', d.topic));
}

// ---------- document check ----------
function startCheck(packId, pickIfMany = true) {
  if (!S.consented) return;
  const list = S.services || [];
  const svc = packId ? list.find((s) => s.id === packId) : list.length === 1 ? list[0] : null;
  drop((m) => m.kind === 'form' || m.kind === 'picker'); wipePhotos(); S.form = null;
  if (svc) { S.form = { svc, files: {}, previews: {}, bad: {}, busy: false, error: '' }; push({ role: 'bot', kind: 'form' }); }
  else if (list.length > 1 && pickIfMany) push({ role: 'bot', kind: 'picker' });
  render(true);
}
function wipePhotos() { if (S.form) { Object.values(S.form.previews).forEach((u) => URL.revokeObjectURL(u)); S.form.files = {}; S.form.previews = {}; } }
function readAsDataUrl(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
async function toJpegDataUrl(file) {
  try {
    const bmp = await createImageBitmap(file); const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
    return c.toDataURL('image/jpeg', 0.85);       // re-encoding also drops EXIF (location etc.)
  } catch {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 4 * 1024 * 1024) throw new Error('unusable');
    return readAsDataUrl(file);
  }
}
async function addFile(docId, file) {
  const f = S.form; if (!f) return; f.bad[docId] = false;
  try {
    if (!file || !file.type.startsWith('image/')) throw new Error('not image');
    f.files[docId] = await toJpegDataUrl(file);
    if (f.previews[docId]) URL.revokeObjectURL(f.previews[docId]); f.previews[docId] = URL.createObjectURL(file);
  } catch { delete f.files[docId]; f.bad[docId] = true; }
  render();
  const again = document.querySelector(`input[data-doc="${docId}"]`); if (again) again.focus();   // keep keyboard users where they were
}
async function submitCheck(msg) {
  const f = S.form; if (!f || f.busy) return; f.busy = true; f.error = ''; render();
  try {
    const r = await api('/api/check', { packId: f.svc.id, applicantType: f.svc.applicantTypes[0], images: f.files });
    if (!r.ok) { f.error = t(errKey(r.status)); f.busy = false; return render(); }
    const data = await r.json(); const svc = f.svc;
    wipePhotos(); S.form = null; drop((m) => m.kind === 'form');
    push({ role: 'bot', kind: 'result', data, svc, fb: null }); $('announce').textContent = t('announceBot');
  } catch { f.error = t('errNet'); f.busy = false; }
  render(true);
}
function viewPicker() {
  return el('div', { class: 'body' }, el('p', null, t('pickService')),
    el('div', { class: 'actions' }, (S.services || []).map((s) => el('button', { type: 'button', class: 'btn ghost', on: { click: () => startCheck(s.id) } }, pick(s, 'name')))));
}
function viewForm() {
  const f = S.form; if (!f) return el('div');
  const n = Object.keys(f.files).length;
  return el('div', { class: 'body' }, el('div', { class: 'card' },
    el('h3', null, t('formTitle')), el('p', { class: 'sm' }, pick(f.svc, 'name')),
    f.svc.status !== 'VERIFIED' && el('p', { class: 'notice' }, t('draft')), f.svc.stale && el('p', { class: 'notice' }, t('stale')),
    f.svc.documents.map((d) => {
      const has = !!f.files[d.id];
      return el('div', { class: 'slot' },
        el('div', null, has && el('img', { class: 'thumb', src: f.previews[d.id], alt: '' }), el('strong', null, pick(d, 'name')), has && el('div', { class: 'ok' }, t('added')),
          f.bad[d.id] && el('p', { class: 'notice err', role: 'alert' }, t('photoBad'))),
        el('label', { class: 'file' }, el('input', { type: 'file', accept: 'image/*', capture: 'environment', 'data-doc': d.id, on: { change: (e) => { const x = e.target.files && e.target.files[0]; if (x) addFile(d.id, x); } } }), el('span', null, has ? t('replacePhoto') : t('addPhoto'))),
        pick(d, 'tip') && el('p', { class: 'tip' }, pick(d, 'tip')));
    }),
    f.error && el('p', { class: 'notice err', role: 'alert' }, f.error),
    el('div', { class: 'actions' },
      el('button', { type: 'button', class: 'btn', id: 'checkBtn', disabled: n === 0 || f.busy, on: { click: () => submitCheck() } }, f.busy ? t('checking') : t('check')),
      el('button', { type: 'button', class: 'btn ghost', id: 'cancelBtn', disabled: f.busy, on: { click: () => { wipePhotos(); S.form = null; drop((m) => m.kind === 'form'); render(); } } }, t('cancel'))),
    n === 0 && el('p', { class: 'sm' }, t('needOne'))));
}
function sourceLink(src) {
  if (!src || !safeUrl(src.url)) return null;
  return el('p', { class: 'sm' }, `${t('source')}: `, el('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer' }, src.label));
}
function viewResult(m) {
  const r = m.data, sv = m.svc;
  const missing = new Set(r.results.filter((x) => x.outcome === 'FAIL' && x.reason === 'document_missing').flatMap((x) => x.docs));
  const bad = r.results.filter((x) => x.outcome !== 'PASS' && !(x.outcome === 'UNSURE' && x.reason === 'document_missing' && x.docs.some((d) => missing.has(d))));
  const passed = r.results.filter((x) => x.outcome === 'PASS').length;
  const names = Object.fromEntries((S.services || []).map((s) => [s.id, pick(s, 'name')]));
  const docName = (id) => { const d = sv.documents.find((x) => x.id === id); return d ? pick(d, 'name') : id; };
  return el('div', { class: 'body' },
    r.packStatus !== 'VERIFIED' && el('p', { class: 'notice' }, t('draft')), r.stale && el('p', { class: 'notice' }, t('stale')),
    el('div', { class: `stamp ${r.verdict}`, role: 'status' }, t(r.verdict)), el('p', null, t('v' + r.verdict)),
    Object.entries(r.issues || {}).map(([id, code]) => el('p', { class: 'notice err' }, `${docName(id)}: ${t(code)}`)),
    bad.length > 0 && el('h3', { class: 'sm' }, t('fix')),
    bad.map((x) => {
      const steps = S.lang === 'bn' ? x.fix_bn : x.fix_en;
      const tips = x.outcome === 'UNSURE' ? x.docs.map((id) => sv.documents.find((d) => d.id === id)).filter(Boolean).map((d) => pick(d, 'tip')).filter(Boolean) : [];
      return el('div', { class: `item ${x.outcome} ${x.severity}` },
        el('h4', null, x.outcome === 'UNSURE' ? t('unsure') : pick(x, 'message')),
        x.outcome === 'UNSURE' && el('p', null, t(x.reason) || t('unreadable')), x.outcome === 'UNSURE' && tips.length > 0 && el('p', { class: 'sm' }, `${t('tipLabel')} ${tips[0]}`),
        x.outcome === 'FAIL' && el('ol', null, steps.map((s) => el('li', null, s))),
        x.fixService && names[x.fixService] && el('p', null, el('strong', null, `${t('fixFirst')} `), names[x.fixService]),
        el('details', null, el('summary', null, t('why')),
          el('p', { class: 'sm' }, el('span', { class: 'tag' }, `${t('rule')} ${x.ruleId}`), ' ', t(x.ruleStatus === 'official' ? 'ruleOfficial' : x.ruleStatus === 'operator_reported' ? 'ruleOperator' : 'ruleUnconfirmed')),
          el('p', { class: 'sm' }, `${t('lastVerified')}: ${r.lastVerified || t('notVerified')}`), sourceLink(x.source)));
    }),
    el('p', { class: 'sm' }, t('passed')(passed)),
    r.read && Object.keys(r.read).length > 0 && el('details', { class: 'readbox' }, el('summary', null, t('readTitle')), el('p', { class: 'sm' }, t('readHint')),
      Object.entries(r.read).map(([id, fields]) => el('div', null, el('strong', null, docName(id)),
        el('ul', { class: 'read' }, fields.map((f) => el('li', null, el('span', { class: 'sm' }, `${t('fields')[f.field] || f.field}: `), f.value == null ? t('unclearValue') : f.value)))))),
    el('p', { class: 'sm' }, S.lang === 'bn' ? r.disclaimer_bn : r.disclaimer_en),
    el('div', { class: 'actions' }, el('button', { type: 'button', class: 'btn ghost', on: { click: () => startCheck(sv.id) } }, t('again')), el('button', { type: 'button', class: 'btn ghost', 'data-print': true, on: { click: () => printSheet(m, bad, docName) } }, t('print')), listenBtn(`${t(r.verdict)}. ${t('v' + r.verdict)}`)),
    fbRow(m, 'check', r.packId));
}

// ---------- printable visit checklist: document names and fixes only, never any value read from a photo ----------
function printSheet(m, bad, docName) {
  const r = m.data, sv = m.svc, steps = (x) => (S.lang === 'bn' ? x.fix_bn : x.fix_en) || [];
  const sheet = el('section', { class: 'printsheet', 'aria-hidden': 'true' },
    el('h1', null, `${t('sheetTitle')}: ${pick(sv, 'name')}`), el('p', null, `${t('sheetDate')}: ${new Date().toISOString().slice(0, 10)}`),
    el('p', { class: 'ps-verdict' }, `${t(r.verdict)}. ${t('v' + r.verdict)}`),
    el('h2', null, t('sheetBring')), el('ul', null, sv.documents.map((d) => el('li', null, `☐ ${pick(d, 'name')}`))),
    el('h2', null, t('sheetFix')),
    bad.length ? el('ol', null, bad.map((x) => el('li', null, el('strong', null, x.outcome === 'UNSURE' ? t('unsure') : pick(x, 'message')), steps(x).length > 0 && el('ul', null, steps(x).map((z) => el('li', null, z)))))) : el('p', null, t('sheetNone')),
    el('p', { class: 'ps-note' }, S.lang === 'bn' ? r.disclaimer_bn : r.disclaimer_en), el('p', { class: 'ps-note' }, t('sheetNote')));
  document.body.append(sheet);
  const done = () => { sheet.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); window.print();
}

// ---------- thread ----------
function viewMsg(m) {
  if (m.role === 'user') return el('div', { class: 'msg user' }, el('div', { class: 'bubble' }, m.text));
  const mark = el('span', { class: 'mark', 'aria-hidden': 'true' }, icon(MARK));
  let body;
  if (m.kind === 'typing') body = el('div', { class: 'body' }, el('div', { class: 'typing', role: 'status', 'aria-label': '…' }, el('i'), el('i'), el('i')));
  else if (m.kind === 'text') body = el('div', { class: 'body' }, el('p', { class: m.err ? 'notice err' : '', role: m.err ? 'alert' : null }, t(m.key)));
  else if (m.kind === 'answer') body = viewAnswer(m);
  else if (m.kind === 'picker') body = viewPicker();
  else if (m.kind === 'form') body = viewForm();
  else if (KR.views[m.kind]) body = KR.views[m.kind](m);
  else body = viewResult(m);
  return el('div', { class: 'msg bot' }, mark, body);
}
function viewEmpty() {
  return el('div', { class: 'empty' }, el('span', { class: 'mark', 'aria-hidden': 'true' }, icon(MARK)), el('h2', null, t('greet')), el('p', null, t('sub')),
    el('div', { class: 'chips' }, t('prompts').map((p, i) => el('button', { type: 'button', class: 'chip', 'data-prompt': i, on: { click: () => sendMessage(p) } }, p))));
}
function render(scroll) {
  const near = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 160;
  thread.replaceChildren(...(S.msgs.length ? S.msgs.map(viewMsg) : [viewEmpty()]));
  if (scroll || near) chatEl.scrollTop = chatEl.scrollHeight;
}

// ---------- chrome ----------
function renderBanners() {
  const b = []; if (S.demo) b.push(t('demo')); if (S.llm && S.llm.tier === 'free') b.push(t('freeTier'));
  $('banners').replaceChildren(...b.map((x) => el('p', { class: 'strip' }, x)));
}
function renderLanes() {
  const nav = $('lanes'); nav.setAttribute('aria-label', t('lanesLabel')); nav.hidden = !S.consented;      // nothing to tab to before consent, so the bar is not shown
  nav.replaceChildren(...KR.lanes.filter((l) => !l.available || l.available()).map((l) => el('button', { type: 'button', class: 'lane', 'data-lane': l.id, 'aria-pressed': S.lane === l.id, on: { click: () => { if (!S.consented) return; S.lane = l.id; l.start(); renderLanes(); } } }, icon(l.icon), el('span', null, l.label[S.lang]))));
}
function setLarge(on) { document.body.classList.toggle('large', on); $('largeBtn').setAttribute('aria-pressed', on); if (history.replaceState) history.replaceState(null, '', on ? '#large' : location.pathname + location.search); }
function applyLang() {
  document.documentElement.lang = S.lang;
  $('lang-bn').setAttribute('aria-pressed', S.lang === 'bn'); $('lang-en').setAttribute('aria-pressed', S.lang === 'en');
  $('appName').textContent = t('app'); input.placeholder = t('placeholder'); $('fine').textContent = t('fine');
  for (const [id, k] of [['infoBtn', 'privacy'], ['newBtn', 'newChat'], ['attachBtn', 'attach'], ['sendBtn', 'send'], ['micBtn', 'mic']]) { $(id).setAttribute('aria-label', t(k)); $(id).title = t(k); }
  $('largeBtn').setAttribute('aria-label', t('large')); $('largeBtn').title = t('large'); speechSynthesis_cancel();
  document.querySelector('.seg').setAttribute('aria-label', t('langLabel')); renderBanners(); renderLanes(); KR.langChanged.forEach((f) => f()); render();
}
function speechSynthesis_cancel() { if (canSpeak && S.speaking) { speechSynthesis.cancel(); S.speaking = false; } }
function syncComposer() {
  const on = S.consented; input.disabled = !on || S.busy; $('attachBtn').disabled = !on || S.busy; renderLanes();
  $('sendBtn').disabled = !on || S.busy || !input.value.trim(); $('micBtn').disabled = !on || S.busy;
}
function autosize() {
  input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 152)}px`;
  const c = $('count'); c.hidden = input.value.length < 500; c.textContent = `${input.value.length}/600`;
}
function newChat() {
  KR.resets.forEach((f) => f()); S.lane = 'ask'; wipePhotos(); S.form = null; S.msgs = []; S.busy = false; input.value = ''; autosize(); syncComposer(); render(true);
  if (S.consented) $('announce').textContent = t('cleared');
}

// ---------- consent / privacy dialog ----------
function showDialog(first) {
  const prev = document.activeElement;
  const close = () => { $('overlay').replaceChildren(); document.removeEventListener('keydown', onKey, true); if (!first && prev && prev.focus) prev.focus(); };
  const accept = el('button', { type: 'button', class: 'btn', id: 'accept', on: { click: () => { if (first) { S.consented = true; syncComposer(); loadServices(); input.focus(); } close(); } } }, first ? t('accept') : t('close'));
  const dlg = el('div', { class: 'dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlgTitle' }, el('h2', { id: 'dlgTitle' }, t('consentTitle')),
    el('ul', null, ['c1', 'c2', 'c3', 'c4'].map((k) => el('li', null, t(k)))), accept);
  function onKey(e) {
    if (e.key === 'Escape' && !first) return close();
    if (e.key !== 'Tab') return; const f = dlg.querySelectorAll('button'); if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
  document.addEventListener('keydown', onKey, true);
  $('overlay').replaceChildren(el('div', { class: 'veil' }, dlg)); accept.focus();
}

// ---------- voice typing ----------
const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
function toggleVoice() {
  if (!Rec || !S.consented) return;
  if (S.listening && rec) { rec.stop(); return; }
  rec = new Rec(); rec.lang = S.lang === 'bn' ? 'bn-BD' : 'en-US'; rec.interimResults = true; rec.continuous = false;
  const base = input.value ? `${input.value} ` : '';
  rec.onresult = (e) => { let s = ''; for (const r of e.results) s += r[0].transcript; input.value = (base + s).slice(0, 600); autosize(); syncComposer(); };
  rec.onerror = () => { S.listening = false; setMic(); push({ role: 'bot', kind: 'text', key: 'voiceErr', err: true }); render(true); };
  rec.onend = () => { S.listening = false; setMic(); input.focus(); };
  try { rec.start(); S.listening = true; } catch { S.listening = false; }
  setMic();
}
function setMic() { const b = $('micBtn'); b.setAttribute('aria-pressed', S.listening); b.classList.toggle('rec', S.listening); }

// ---------- wiring ----------
$('composer').addEventListener('submit', (e) => { e.preventDefault(); sendMessage(input.value); });
input.addEventListener('input', () => { autosize(); syncComposer(); });
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage(input.value); } });
$('attachBtn').addEventListener('click', () => startCheck());
$('newBtn').addEventListener('click', newChat);
$('infoBtn').addEventListener('click', () => showDialog(!S.consented));
$('lang-bn').addEventListener('click', () => { S.lang = 'bn'; applyLang(); });
$('lang-en').addEventListener('click', () => { S.lang = 'en'; applyLang(); });
if (Rec) { $('micBtn').hidden = false; $('micBtn').addEventListener('click', toggleVoice); }
$('largeBtn').addEventListener('click', () => setLarge(!document.body.classList.contains('large')));
if (/large/.test(location.hash)) setLarge(true);

// A small kit so each lane (form coach, plain language, civic report) lives in its own file and registers itself.
const KR = {
  S, el, icon, t, pick, api, errKey, push, drop, render, bn, safeUrl, fbRow, listenBtn, canSpeak, Rec, views: {}, lanes: [], resets: [], langChanged: [],
  strings(o) { for (const l of ['en', 'bn']) Object.assign(T[l], o[l] || {}); },
  register(lane) { KR.lanes.push(lane); KR.lanes.sort((a, b) => a.order - b.order); renderLanes(); },
  announce(x) { $('announce').textContent = x; }, startCheck, focusInput() { input.focus(); }, setLang: () => S.lang,
};
KR.lanes.push({ id: 'ask', order: 0, icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z', label: { en: 'Ask', bn: 'জিজ্ঞাসা' }, start: () => input.focus() });
KR.lanes.push({ id: 'check', order: 1, icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11', label: { en: 'Check documents', bn: 'কাগজ যাচাই' }, start: () => startCheck() });
window.KR = KR;
window.__kr = { state: S };      // read-only hook used by automated UI tests
applyLang(); showDialog(true);
})();
