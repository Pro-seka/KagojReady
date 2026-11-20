/* Civic report lane: photo -> suggested category (you confirm) -> optional location -> a ticket with a tracking code. */
(() => {
'use strict';
const KR = window.KR; if (!KR) return;
const { el, icon, S, t } = KR;
KR.strings({
  en: { laneReport: 'Report a problem', repTitle: 'Report a problem in your area', repSub: 'Take a photo of a road, drain, light or rubbish problem. I suggest a category, you confirm it, and the report gets a tracking code.',
    repPhoto: 'Take or choose a photo', repPhotoNew: 'Replace photo', repPhotoTip: 'Keep people’s faces and vehicle number plates out of the photo.', repPhotoKept: 'The photo is kept with the report so the office can see the problem, and is deleted automatically after the report is closed, and in any case within 6 months. Its location data is removed.',
    repReading: 'Looking at the photo…', repSuggested: (c) => `Suggested from the photo: ${c}. Please check it.`, repNoSuggest: 'I could not tell what this shows. Please choose the category yourself.',
    repNoModel: 'In this mode the photo is not analysed. Please choose the category yourself.', repNotInfra: 'This does not look like a problem in a public place. If it shows people or a private space, retake it.',
    repCategory: 'What is the problem?', repChoose: 'Choose…', repArea: 'Where is it?', repAreaHint: 'This decides which office it is addressed to.', repDesc: 'Anything the office should know (optional)', repDescHint: 'Do not write phone or ID numbers.',
    repLoc: 'Use my location', repLocOn: 'Location added (rounded to about 100 metres).', repLocRemove: 'Remove location', repLocBusy: 'Finding your location…', repLocErr: 'Could not get your location. You can still send the report without it.', repLocWhy: 'A location lets the office find the place, and lets me spot a report of the same problem nearby.',
    repSend: 'Send report', repSending: 'Sending…', repNeedCat: 'Choose what the problem is.', repTrack: 'Track a report', repTrackCode: 'Tracking code', repTrackGo: 'Check status', repTrackNone: 'No report found with this code.',
    repSimilarTitle: 'A similar report already exists nearby', repSimilarSub: 'If this is the same problem, add your support instead of a new report. More support raises its priority.', repMeToo: 'Same problem: add my support', repDifferent: 'It is a different problem: send mine', repSupported: 'Thank you. Your support was added.',
    repAway: (m) => `${m} m away`, repSupporters: (n) => `${n} supporter${n === 1 ? '' : 's'}`, repDoneTitle: 'Report received', repCode: 'Your tracking code', repCodeNote: 'Write this down. It is the only way to check the status later. There are no accounts.', repCopy: 'Copy code', repCopied: 'Copied',
    repAddressed: (b) => `Addressed to: ${b}`, repDraftRoute: 'Routing is a draft and not confirmed by any authority.', repPilot: 'This is a pilot. The report is recorded and shown to the agency console. It is not sent into any government system automatically, and its status changes only when an office updates it.',
    repKeptPhoto: 'Photo kept with the report.', repKeptLoc: 'Rounded location kept.', repAnother: 'Report another problem', repStatus: 'Status', repUpdated: 'Last update', repNote: 'Office note', repOffice: 'Office',
    st_received: 'Received', st_in_review: 'Being reviewed', st_forwarded: 'Forwarded to the office', st_resolved: 'Resolved', st_rejected: 'Closed without action', repCfgErr: 'The report form could not load. Try again later.' },
  bn: { laneReport: 'সমস্যা জানান', repTitle: 'আপনার এলাকার সমস্যা জানান', repSub: 'রাস্তা, ড্রেন, বাতি বা ময়লার সমস্যার ছবি তুলুন। আমি একটি ধরন সুপারিশ করি, আপনি নিশ্চিত করেন, আর অভিযোগটি একটি ট্র্যাকিং কোড পায়।',
    repPhoto: 'ছবি তুলুন বা বেছে নিন', repPhotoNew: 'ছবি বদলান', repPhotoTip: 'ছবিতে মানুষের মুখ ও গাড়ির নম্বর প্লেট রাখবেন না।', repPhotoKept: 'অফিস যাতে সমস্যাটি দেখতে পায় তাই ছবি অভিযোগের সঙ্গে রাখা হয়। অভিযোগ বন্ধ হলে এবং যেকোনো ক্ষেত্রে ৬ মাসের মধ্যে তা নিজে থেকেই মুছে যায়। ছবি থেকে অবস্থানের তথ্য সরিয়ে ফেলা হয়।',
    repReading: 'ছবি দেখা হচ্ছে…', repSuggested: (c) => `ছবি থেকে সুপারিশ: ${c}। অনুগ্রহ করে মিলিয়ে নিন।`, repNoSuggest: 'ছবিতে কী আছে বুঝতে পারিনি। নিজে ধরনটি বেছে নিন।',
    repNoModel: 'এই মোডে ছবি বিশ্লেষণ করা হয় না। নিজে ধরনটি বেছে নিন।', repNotInfra: 'এটি জনসাধারণের স্থানের সমস্যা বলে মনে হচ্ছে না। ছবিতে মানুষ বা ব্যক্তিগত জায়গা থাকলে আবার তুলুন।',
    repCategory: 'সমস্যাটি কী?', repChoose: 'বেছে নিন…', repArea: 'কোথায়?', repAreaHint: 'এটি ঠিক করে অভিযোগটি কোন অফিসের নামে যাবে।', repDesc: 'অফিসের জানা দরকার এমন কিছু (ঐচ্ছিক)', repDescHint: 'ফোন বা আইডি নম্বর লিখবেন না।',
    repLoc: 'আমার অবস্থান ব্যবহার করুন', repLocOn: 'অবস্থান যোগ হয়েছে (প্রায় ১০০ মিটারে গোল করা)।', repLocRemove: 'অবস্থান সরান', repLocBusy: 'আপনার অবস্থান খোঁজা হচ্ছে…', repLocErr: 'অবস্থান পাওয়া যায়নি। অবস্থান ছাড়াই অভিযোগ পাঠাতে পারেন।', repLocWhy: 'অবস্থান থাকলে অফিস জায়গাটি খুঁজে পায়, আর আশপাশে একই সমস্যার অভিযোগ থাকলে আমি ধরতে পারি।',
    repSend: 'অভিযোগ পাঠান', repSending: 'পাঠানো হচ্ছে…', repNeedCat: 'সমস্যাটি কী তা বেছে নিন।', repTrack: 'অভিযোগের অবস্থা দেখুন', repTrackCode: 'ট্র্যাকিং কোড', repTrackGo: 'অবস্থা দেখুন', repTrackNone: 'এই কোডে কোনো অভিযোগ পাওয়া যায়নি।',
    repSimilarTitle: 'কাছাকাছি একই রকম অভিযোগ আগে থেকেই আছে', repSimilarSub: 'একই সমস্যা হলে নতুন অভিযোগের বদলে সমর্থন যোগ করুন। সমর্থন বেশি হলে অগ্রাধিকার বাড়ে।', repMeToo: 'একই সমস্যা: আমার সমর্থন যোগ করুন', repDifferent: 'এটি আলাদা সমস্যা: আমারটি পাঠান', repSupported: 'ধন্যবাদ। আপনার সমর্থন যোগ হয়েছে।',
    repAway: (m) => `${KR.bn(m)} মিটার দূরে`, repSupporters: (n) => `${KR.bn(n)} জন সমর্থক`, repDoneTitle: 'অভিযোগ পাওয়া গেছে', repCode: 'আপনার ট্র্যাকিং কোড', repCodeNote: 'এটি লিখে রাখুন। পরে অবস্থা দেখার এটিই একমাত্র উপায়। কোনো অ্যাকাউন্ট নেই।', repCopy: 'কোড কপি করুন', repCopied: 'কপি হয়েছে',
    repAddressed: (b) => `যার নামে পাঠানো হয়েছে: ${b}`, repDraftRoute: 'কোন অফিসে যাবে তা খসড়া, কোনো কর্তৃপক্ষ এখনো নিশ্চিত করেনি।', repPilot: 'এটি পরীক্ষামূলক চালু। অভিযোগ রেকর্ড হয় এবং এজেন্সি কনসোলে দেখা যায়। এটি আপনা-আপনি কোনো সরকারি ব্যবস্থায় যায় না, আর অবস্থা বদলায় কেবল কোনো অফিস হালনাগাদ করলে।',
    repKeptPhoto: 'ছবি অভিযোগের সঙ্গে রাখা হয়েছে।', repKeptLoc: 'গোল করা অবস্থান রাখা হয়েছে।', repAnother: 'আরেকটি সমস্যা জানান', repStatus: 'অবস্থা', repUpdated: 'সর্বশেষ হালনাগাদ', repNote: 'অফিসের নোট', repOffice: 'অফিস',
    st_received: 'পাওয়া গেছে', st_in_review: 'দেখা হচ্ছে', st_forwarded: 'অফিসে পাঠানো হয়েছে', st_resolved: 'সমাধান হয়েছে', st_rejected: 'ব্যবস্থা ছাড়াই বন্ধ', repCfgErr: 'অভিযোগের ফর্ম লোড হয়নি। পরে চেষ্টা করুন।' },
});

let cfg = null;
const wipe = (m) => { if (m.preview) URL.revokeObjectURL(m.preview); m.photo = null; m.preview = null; };
async function loadCfg() { if (cfg) return cfg; try { const r = await KR.api('/api/reports/config'); if (r.ok) cfg = await r.json(); } catch { /* shown as an error */ } return cfg; }
const catName = (id) => { const c = cfg && cfg.categories.find((x) => x.id === id); return c ? c[`name_${S.lang}`] : id; };

async function start() {
  KR.drop((m) => m.kind === 'report');
  KR.push({ role: 'bot', kind: 'report', step: 'form', photo: null, preview: null, cls: { state: 'idle', reason: '', category: null, confidence: null }, category: '', areaType: 'unknown', description: '', loc: null, locState: 'idle', busy: false, error: '', similar: [], result: null, supported: false, trackId: '', track: null, trackErr: '', copied: false });
  await loadCfg(); KR.render(true);
}

async function toJpeg(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  let scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height)), q = 0.72, url = '';
  for (let i = 0; i < 6; i++) {
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    url = c.toDataURL('image/jpeg', q); if (url.length * 0.75 < 380 * 1024) break; if (q > 0.45) q -= 0.1; else scale *= 0.8;
  }
  if (bmp.close) bmp.close(); return url;        // re-encoding through a canvas also drops EXIF, including GPS
}
async function addPhoto(m, file) {
  m.error = '';
  try {
    if (!file || !file.type.startsWith('image/')) throw new Error('not image');
    wipe(m); m.photo = await toJpeg(file); m.preview = URL.createObjectURL(file); m.cls = { state: 'busy', reason: '', category: null, confidence: null }; KR.render();
    const r = await KR.api('/api/reports/classify', { image: m.photo });
    if (!r.ok) { m.cls = { state: 'done', reason: 'model_failed', category: null, confidence: null }; }
    else { const d = await r.json(); m.cls = { state: 'done', reason: d.reason, category: d.category, confidence: d.confidence }; if (d.category) m.category = d.category; }
  } catch { m.photo = null; m.cls = { state: 'idle', reason: '', category: null, confidence: null }; m.error = t('photoBad'); }
  KR.render();
}
function getLocation(m) {
  if (!navigator.geolocation) { m.locState = 'err'; return KR.render(); }
  m.locState = 'busy'; KR.render();
  navigator.geolocation.getCurrentPosition((p) => { m.loc = { lat: p.coords.latitude, lng: p.coords.longitude }; m.locState = 'on'; KR.render(); }, () => { m.loc = null; m.locState = 'err'; KR.render(); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}
async function submit(m, force) {
  if (m.busy) return; if (!m.category) { m.error = t('repNeedCat'); return KR.render(); }
  m.busy = true; m.error = ''; KR.render();
  try {
    const r = await KR.api('/api/reports', { category: m.category, areaType: m.areaType, description: m.description, lat: m.loc ? m.loc.lat : null, lng: m.loc ? m.loc.lng : null, image: m.photo, lang: S.lang, force: !!force, suggested: m.cls.category ? { category: m.cls.category, confidence: m.cls.confidence } : undefined });
    if (!r.ok) m.error = t(KR.errKey(r.status));
    else { const d = await r.json(); if (d.created) { m.result = d; m.step = 'done'; wipe(m); KR.announce(t('repDoneTitle')); } else { m.similar = d.similar; m.step = 'similar'; } }
  } catch { m.error = t('errNet'); }
  m.busy = false; KR.render(true);
}
async function meToo(m, id) {
  m.busy = true; KR.render();
  try { const r = await KR.api('/api/reports/support', { id }); if (r.ok) { m.supported = true; m.step = 'supported'; wipe(m); } else m.error = t(KR.errKey(r.status)); } catch { m.error = t('errNet'); }
  m.busy = false; KR.render(true);
}
async function track(m) {
  m.trackErr = ''; m.track = null; const id = m.trackId.trim().toUpperCase(); if (!id) return;
  try { const r = await KR.api('/api/reports/track', { id }); if (r.ok) m.track = await r.json(); else m.trackErr = r.status === 404 ? t('repTrackNone') : t(KR.errKey(r.status)); } catch { m.trackErr = t('errNet'); }
  KR.render();
}
const copyBtn = (m, text) => el('button', { type: 'button', class: 'btn ghost', 'data-copy-code': true, on: { click: async () => { try { await navigator.clipboard.writeText(text); m.copied = true; } catch { m.copied = false; } KR.render(); } } }, m.copied ? t('repCopied') : t('repCopy'));
const dateOnly = (iso) => String(iso).slice(0, 10);

function trackBox(m) {
  const tr = m.track;
  return el('details', { class: 'trackbox', open: !!(m.track || m.trackErr || m.trackId) }, el('summary', null, t('repTrack')),
    el('div', { class: 'frow' }, el('input', { type: 'text', 'aria-label': t('repTrackCode'), placeholder: 'KR-XXXX-XXXX', autocomplete: 'off', value: m.trackId, on: { input: (e) => { m.trackId = e.target.value; } } }), el('button', { type: 'button', class: 'btn ghost', on: { click: () => track(m) } }, t('repTrackGo'))),
    m.trackErr && el('p', { class: 'notice err', role: 'alert' }, m.trackErr),
    tr && el('div', { class: 'item' }, el('h4', null, `${t('repStatus')}: ${t(`st_${tr.status}`)}`), el('p', { class: 'sm' }, `${catName(tr.category)} · ${t('repOffice')}: ${tr.body[`body_${S.lang}`]}`), el('p', { class: 'sm' }, `${t('repUpdated')}: ${dateOnly(tr.updatedAt)} · ${t('repSupporters')(tr.supporters)}`), tr.note && el('p', null, `${t('repNote')}: ${tr.note}`)));
}

function viewReport(m) {
  if (!cfg) return el('div', { class: 'body' }, el('p', { class: 'notice err', role: 'alert' }, t('repCfgErr')));
  if (m.step === 'done') {
    const d = m.result;
    return el('div', { class: 'body' }, el('div', { class: 'card' }, el('h3', null, t('repDoneTitle')), el('p', { class: 'sm' }, t('repCode')), el('p', { class: 'bigcode', 'data-code': d.id }, d.id), el('p', { class: 'notice' }, t('repCodeNote')),
      el('p', null, t('repAddressed')(d.body[`body_${S.lang}`])), el('p', { class: 'sm' }, t('repDraftRoute')), el('p', { class: 'sm' }, [d.photoKept && t('repKeptPhoto'), d.locationKept && t('repKeptLoc')].filter(Boolean).join(' ')), el('p', { class: 'sm' }, t('repPilot')),
      el('div', { class: 'actions' }, copyBtn(m, d.id), el('button', { type: 'button', class: 'btn ghost', on: { click: () => start() } }, t('repAnother'))), trackBox(m)));
  }
  if (m.step === 'supported') return el('div', { class: 'body' }, el('div', { class: 'card' }, el('p', { class: 'ok', role: 'status' }, t('repSupported')), el('div', { class: 'actions' }, el('button', { type: 'button', class: 'btn ghost', on: { click: () => start() } }, t('repAnother')))));
  if (m.step === 'similar') {
    return el('div', { class: 'body' }, el('div', { class: 'card' }, el('h3', null, t('repSimilarTitle')), el('p', { class: 'sm' }, t('repSimilarSub')),
      m.similar.map((s) => el('div', { class: 'item' }, el('h4', null, `${catName(s.category)} · ${t(`st_${s.status}`)}`), el('p', { class: 'sm' }, `${t('repAway')(s.distanceM)} · ${t('repSupporters')(s.supporters)} · ${dateOnly(s.createdAt)}`),
        el('button', { type: 'button', class: 'btn', 'data-metoo': s.id, disabled: m.busy, on: { click: () => meToo(m, s.id) } }, t('repMeToo')))),
      m.error && el('p', { class: 'notice err', role: 'alert' }, m.error),
      el('div', { class: 'actions' }, el('button', { type: 'button', class: 'btn ghost', 'data-force': true, disabled: m.busy, on: { click: () => submit(m, true) } }, t('repDifferent')))));
  }
  const cls = m.cls, note = cls.state === 'busy' ? t('repReading') : cls.state !== 'done' ? '' : cls.reason === 'ok' ? t('repSuggested')(catName(cls.category)) : cls.reason === 'no_model' ? t('repNoModel') : cls.reason === 'not_infrastructure' ? t('repNotInfra') : t('repNoSuggest');
  const sel = (id, label, hint, options, value, onChange) => el('div', { class: 'field' }, el('label', { for: id }, label), hint && el('p', { class: 'sm' }, hint),
    el('select', { id, on: { change: (e) => onChange(e.target.value) } }, options.map((o) => el('option', { value: o[0], selected: o[0] === value }, o[1]))));
  return el('div', { class: 'body' }, el('div', { class: 'card report' }, el('h3', null, t('repTitle')), el('p', { class: 'sm' }, t('repSub')),
    el('div', { class: 'slot' }, el('div', null, m.preview && el('img', { class: 'thumb', src: m.preview, alt: '' }), el('strong', null, t('repPhoto'))),
      el('label', { class: 'file' }, el('input', { type: 'file', accept: 'image/*', capture: 'environment', 'data-report-photo': true, on: { change: (e) => { const x = e.target.files && e.target.files[0]; if (x) addPhoto(m, x); } } }), el('span', null, m.photo ? t('repPhotoNew') : t('repPhoto'))),
      el('p', { class: 'tip' }, t('repPhotoTip'))),
    note && el('p', { class: `notice${cls.reason === 'ok' ? ' good' : ''}`, role: 'status', 'data-suggestion': cls.reason }, note),
    m.photo && el('p', { class: 'sm' }, t('repPhotoKept')),
    sel('rep-cat', t('repCategory'), null, [['', t('repChoose')], ...cfg.categories.map((c) => [c.id, c[`name_${S.lang}`]])], m.category, (v) => { m.category = v; }),
    sel('rep-area', t('repArea'), t('repAreaHint'), cfg.areaTypes.map((a) => [a.id, a[`name_${S.lang}`]]), m.areaType, (v) => { m.areaType = v; }),
    el('div', { class: 'field' }, el('label', { for: 'rep-desc' }, t('repDesc')), el('p', { class: 'sm' }, t('repDescHint')), el('textarea', { id: 'rep-desc', rows: 2, maxlength: 280, on: { input: (e) => { m.description = e.target.value; } } }, m.description)),
    el('div', { class: 'field' }, m.locState === 'on' ? [el('p', { class: 'ok', role: 'status' }, t('repLocOn')), el('button', { type: 'button', class: 'btn ghost', on: { click: () => { m.loc = null; m.locState = 'idle'; KR.render(); } } }, t('repLocRemove'))]
      : [el('p', { class: 'sm' }, t('repLocWhy')), el('button', { type: 'button', class: 'btn ghost', 'data-use-location': true, disabled: m.locState === 'busy', on: { click: () => getLocation(m) } }, m.locState === 'busy' ? t('repLocBusy') : t('repLoc')), m.locState === 'err' && el('p', { class: 'notice', role: 'alert' }, t('repLocErr'))]),
    m.error && el('p', { class: 'notice err', role: 'alert' }, m.error),
    el('div', { class: 'actions' }, el('button', { type: 'button', class: 'btn', 'data-send-report': true, disabled: m.busy, on: { click: () => submit(m, false) } }, m.busy ? t('repSending') : t('repSend'))),
    trackBox(m)));
}
KR.views.report = viewReport;
KR.register({ id: 'report', order: 4, icon: 'M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13zM12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z', label: { en: 'Report a problem', bn: 'সমস্যা জানান' }, available: () => KR.S.reports, start });
})();
