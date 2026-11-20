/* Plain-language lane: paste a notice, circular or bill and get what it means, what to do by when, and the hard words explained. */
(() => {
'use strict';
const KR = window.KR; if (!KR) return;
const { el, icon, S, t, pick } = KR;
KR.strings({
  en: { lanePlain: 'Plain language', plainTitle: 'Plain-language reader', plainSub: 'Paste a government notice, circular or bill. I show what it means, the deadlines and amounts, and explain the hard words. Your text is not stored.',
    plainPaste: 'Paste the text here (Bangla or English)', plainSample: 'Try a sample', plainSampleNote: 'The sample is made-up text written for this demo, not a real law.', plainGo: 'Explain in plain words', plainBusy: 'Reading…', plainClear: 'Clear',
    plainShort: 'Paste at least a couple of sentences.', plainTruncated: 'The text was long, so only the first 6,000 characters were read.', plainRedacted: 'Personal numbers in the text were hidden before it was processed.',
    plainPoints: 'In plain words', plainPointsAi: 'Each point links to the sentence it comes from. Open the original to check it.', plainPointsExt: 'No AI was used. These are the most important sentences, unchanged.', plainDropped: (n) => `${n} AI point${n === 1 ? ' was' : 's were'} removed because the numbers did not match the original.`,
    plainRejected: 'The AI rewrite did not pass the checks, so the key sentences are shown unchanged.', plainFacts: 'Deadlines, money and penalties', plainDuties: 'What it says you must do', plainBans: 'What it says you must not do', plainPen: 'Penalties it mentions',
    plainHard: 'Hard words explained', plainOrig: 'Original text, sentence by sentence', plainLong: 'long sentence', plainLevel: 'How hard is this text?', plainLvl_plain: 'Easy to read', plainLvl_moderate: 'Somewhat hard', plainLvl_dense: 'Dense and hard',
    plainStats: (s, w, j) => `${s} sentences, about ${w} words each, ${j} hard terms per 100 words. A rough guide, not a score.`, plainDisclaimer: 'A general explanation, not legal advice. The original text is what counts. Ask the office if unsure.',
    plainSentence: (n) => `sentence ${n}`, k_deadline: 'Time limit', k_date: 'Date', k_money: 'Money', k_percent: 'Percent', plainNoFacts: 'No dates, amounts or time limits were found.' },
  bn: { lanePlain: 'সহজ ভাষা', plainTitle: 'সহজ ভাষায় পড়ুন', plainSub: 'সরকারি বিজ্ঞপ্তি, পরিপত্র বা বিলের লেখা পেস্ট করুন। আমি দেখাব এর মানে কী, কবে কত টাকা বা কী করতে হবে, আর কঠিন শব্দের অর্থ। আপনার লেখা জমা রাখা হয় না।',
    plainPaste: 'এখানে লেখা পেস্ট করুন (বাংলা বা ইংরেজি)', plainSample: 'নমুনা দেখুন', plainSampleNote: 'নমুনাটি এই ডেমোর জন্য বানানো লেখা, প্রকৃত আইন নয়।', plainGo: 'সহজ ভাষায় বুঝিয়ে দিন', plainBusy: 'পড়া হচ্ছে…', plainClear: 'মুছুন',
    plainShort: 'অন্তত কয়েকটি বাক্য পেস্ট করুন।', plainTruncated: 'লেখাটি বড়, তাই শুরুর ৬,০০০ অক্ষর পড়া হয়েছে।', plainRedacted: 'লেখার ব্যক্তিগত নম্বর প্রক্রিয়ার আগেই লুকানো হয়েছে।',
    plainPoints: 'সহজ কথায়', plainPointsAi: 'প্রতিটি পয়েন্ট মূল যে বাক্য থেকে এসেছে তার সঙ্গে যুক্ত। মূল লেখা খুলে মিলিয়ে নিন।', plainPointsExt: 'এআই ব্যবহার হয়নি। এগুলো সবচেয়ে গুরুত্বপূর্ণ বাক্য, অপরিবর্তিত।', plainDropped: (n) => `${KR.bn(n)}টি এআই পয়েন্ট বাদ দেওয়া হয়েছে, কারণ সংখ্যা মূল লেখার সঙ্গে মেলেনি।`,
    plainRejected: 'এআইয়ের লেখা যাচাইয়ে টেকেনি, তাই মূল বাক্যগুলো অপরিবর্তিত দেখানো হচ্ছে।', plainFacts: 'সময়সীমা, টাকা ও শাস্তি', plainDuties: 'যা করতে হবে বলে আছে', plainBans: 'যা করা যাবে না বলে আছে', plainPen: 'যে শাস্তির কথা আছে',
    plainHard: 'কঠিন শব্দের অর্থ', plainOrig: 'মূল লেখা, বাক্য ধরে ধরে', plainLong: 'দীর্ঘ বাক্য', plainLevel: 'লেখাটি কতটা কঠিন?', plainLvl_plain: 'সহজে পড়া যায়', plainLvl_moderate: 'কিছুটা কঠিন', plainLvl_dense: 'জটিল ও কঠিন',
    plainStats: (s, w, j) => `${KR.bn(s)}টি বাক্য, গড়ে প্রায় ${KR.bn(w)} শব্দ, প্রতি ১০০ শব্দে ${KR.bn(j)}টি কঠিন পদ। মোটামুটি ধারণা, নম্বর নয়।`, plainDisclaimer: 'এটি সাধারণ ব্যাখ্যা, আইনি পরামর্শ নয়। মূল লেখাই চূড়ান্ত। নিশ্চিত না হলে অফিসে জিজ্ঞাসা করুন।',
    plainSentence: (n) => `${KR.bn(n)} নম্বর বাক্য`, k_deadline: 'সময়সীমা', k_date: 'তারিখ', k_money: 'টাকা', k_percent: 'শতাংশ', plainNoFacts: 'কোনো তারিখ, টাকার অঙ্ক বা সময়সীমা পাওয়া যায়নি।' },
});

let sample = null;
async function loadSample() { if (sample) return sample; try { const r = await fetch('/samples/plain-sample.json'); sample = r.ok ? (await r.json()).samples : null; } catch { sample = null; } sample = sample || { en: '', bn: '' }; return sample; }

function start() { KR.drop((m) => m.kind === 'plain'); KR.push({ role: 'bot', kind: 'plain', text: '', busy: false, result: null, error: '' }); KR.render(true); }

async function run(m) {
  if (m.busy) return; if (m.text.trim().length < 20) { m.error = t('plainShort'); return KR.render(); }
  m.busy = true; m.error = ''; KR.render();
  try {
    const r = await KR.api('/api/plain', { text: m.text, lang: S.lang });
    if (!r.ok) { m.error = t(KR.errKey(r.status)); } else { m.result = await r.json(); KR.announce(t('announceBot')); }
  } catch { m.error = t('errNet'); }
  m.busy = false; KR.render();
}

const sentenceLink = (m, i) => el('button', { type: 'button', class: 'cite wide', 'aria-label': t('plainSentence')(i + 1), on: { click: () => { const d = document.getElementById(`orig-${m.id}`); if (d) d.open = true; const li = document.getElementById(`orig-${m.id}-${i}`); if (!li) return; li.parentNode.querySelectorAll('.hl').forEach((x) => x.classList.remove('hl')); li.classList.add('hl'); li.setAttribute('tabindex', '-1'); li.focus(); if (li.scrollIntoView) li.scrollIntoView({ block: 'nearest' }); } } }, String(i + 1));

function viewResult(m) {
  const r = m.result, a = r.analysis, S_ = a.sentences, rd = a.readability, d = r.droppedPoints;
  const byKind = (k) => a.facts.filter((f) => f.kind === k);
  const sentenceList = (kind) => [...new Set(byKind(kind).map((f) => f.sentence))].slice(0, 5);
  const quote = (i) => el('li', null, S_[i].length > 220 ? `${S_[i].slice(0, 220)}…` : S_[i], ' ', sentenceLink(m, i));
  const valued = a.facts.filter((f) => f.value && ['deadline', 'date', 'money', 'percent'].includes(f.kind));
  const lvlTxt = t(`plainLvl_${rd.level}`);
  const pointsAi = r.mode === 'ai_grounded';
  return el('div', null,
    r.truncated && el('p', { class: 'notice' }, t('plainTruncated')), r.redactions.length > 0 && el('p', { class: 'notice' }, t('plainRedacted')),
    el('div', { class: `level ${rd.level}` }, el('strong', null, `${t('plainLevel')} `), lvlTxt), el('p', { class: 'sm' }, t('plainStats')(rd.sentences, rd.avgWords, rd.jargonPer100)),
    el('h3', { class: 'sm hh' }, t('plainPoints')),
    r.steps.some((s) => s.startsWith('rejected:')) && el('p', { class: 'notice' }, t('plainRejected')),
    el('p', { class: 'sm' }, pointsAi ? t('plainPointsAi') : t('plainPointsExt')), d > 0 && el('p', { class: 'notice' }, t('plainDropped')(d)),
    el('ul', { class: 'pts' }, r.points.map((p) => el('li', null, p.text, ' ', sentenceLink(m, p.sentence)))),
    el('h3', { class: 'sm hh' }, t('plainFacts')),
    valued.length ? el('ul', { class: 'facts' }, valued.map((f) => el('li', null, el('span', { class: 'tag' }, t(`k_${f.kind}`)), ' ', el('strong', null, f.value), ' ', sentenceLink(m, f.sentence)))) : el('p', { class: 'sm' }, t('plainNoFacts')),
    sentenceList('duty').length > 0 && [el('h3', { class: 'sm hh' }, t('plainDuties')), el('ul', { class: 'pts' }, sentenceList('duty').map(quote))],
    sentenceList('prohibition').length > 0 && [el('h3', { class: 'sm hh' }, t('plainBans')), el('ul', { class: 'pts' }, sentenceList('prohibition').map(quote))],
    sentenceList('penalty').length > 0 && [el('h3', { class: 'sm hh' }, t('plainPen')), el('ul', { class: 'pts' }, sentenceList('penalty').map(quote))],
    a.jargon.length > 0 && el('details', { open: true }, el('summary', null, `${t('plainHard')} (${S.lang === 'bn' ? KR.bn(a.jargon.length) : a.jargon.length})`),
      el('dl', { class: 'gloss' }, a.jargon.slice(0, 14).map((j) => [el('dt', null, j.term, ' ', sentenceLink(m, j.sentence)), el('dd', null, j.plain)]))),
    el('details', { id: `orig-${m.id}` }, el('summary', null, t('plainOrig')), el('ol', { class: 'orig' }, S_.map((x, i) => el('li', { id: `orig-${m.id}-${i}` }, x, rd.longSentences.includes(i) && el('span', { class: 'tag' }, t('plainLong')))))),
    el('p', { class: 'sm' }, t('plainDisclaimer')),
    el('div', { class: 'actions' }, KR.listenBtn(r.points.map((p) => p.text).join(' ')), el('button', { type: 'button', class: 'btn ghost', on: { click: () => { m.result = null; KR.render(); } } }, t('plainClear'))),
    KR.fbRow(m, 'answer', 'plain'));
}
function viewPlain(m) {
  if (m.result) return el('div', { class: 'body' }, el('div', { class: 'card' }, el('h3', null, t('plainTitle')), viewResult(m)));
  const ta = el('textarea', { class: 'bigarea', rows: 8, maxlength: 6000, 'aria-label': t('plainPaste'), placeholder: t('plainPaste'), on: { input: (e) => { m.text = e.target.value; const b = document.getElementById(`pgo-${m.id}`); if (b) b.disabled = m.busy || m.text.trim().length < 20; } } }); ta.value = m.text;
  return el('div', { class: 'body' }, el('div', { class: 'card' }, el('h3', null, t('plainTitle')), el('p', { class: 'sm' }, t('plainSub')), ta,
    m.error && el('p', { class: 'notice err', role: 'alert' }, m.error),
    el('div', { class: 'actions' },
      el('button', { type: 'button', class: 'btn', id: `pgo-${m.id}`, disabled: m.busy || m.text.trim().length < 20, on: { click: () => run(m) } }, m.busy ? t('plainBusy') : t('plainGo')),
      el('button', { type: 'button', class: 'btn ghost', 'data-plain-sample': true, disabled: m.busy, on: { click: async () => { const s = await loadSample(); m.text = s[S.lang] || s.en; KR.render(); } } }, t('plainSample'))),
    m.text && /নমুনা লেখা|SAMPLE TEXT/.test(m.text) && el('p', { class: 'sm' }, t('plainSampleNote'))));
}
KR.views.plain = viewPlain;
KR.register({ id: 'plain', order: 3, icon: 'M4 6h16M4 12h10M4 18h16', label: { en: 'Plain language', bn: 'সহজ ভাষা' }, start });
})();
