/* Form Coach lane. Everything here runs in the browser. Nothing typed or spoken into the coach is ever sent to the server. */
(() => {
'use strict';
const KR = window.KR; if (!KR) return;
const { el, icon, S, t } = KR;
KR.strings({
  en: { laneCoach: 'Fill a form', coachTitle: 'Form coach', coachSub: 'Type or speak your details. I check each one as you go, so mistakes are caught before you reach the counter.',
    coachLocal: 'Stays on this device. Nothing you type or say here is sent anywhere.', coachCount: (a, b) => `${a} of ${b} filled in look right`, coachCopy: 'Copy my answers', coachCopied: 'Copied', coachClear: 'Clear everything',
    coachNext: 'Next: check my documents', coachSpeak: 'Speak this answer', coachListening: 'Listening…', coachOptional: 'optional', coachCross: 'Check these together', coachLoadErr: 'The form coach could not load. Reload the page.', coachRead: 'Read as' },
  bn: { laneCoach: 'ফর্ম পূরণ', coachTitle: 'ফর্ম কোচ', coachSub: 'আপনার তথ্য লিখুন বা বলুন। প্রতিটি তথ্য আমি সঙ্গে সঙ্গে দেখে নিই, যাতে কাউন্টারে যাওয়ার আগেই ভুল ধরা পড়ে।',
    coachLocal: 'এই ডিভাইসেই থাকে। এখানে আপনি যা লেখেন বা বলেন তা কোথাও পাঠানো হয় না।', coachCount: (a, b) => `${KR.bn(b)}টির মধ্যে ${KR.bn(a)}টি ঠিক মনে হচ্ছে`, coachCopy: 'আমার উত্তর কপি করুন', coachCopied: 'কপি হয়েছে', coachClear: 'সব মুছুন',
    coachNext: 'এরপর: আমার কাগজ যাচাই করুন', coachSpeak: 'এই উত্তর বলুন', coachListening: 'শুনছি…', coachOptional: 'ঐচ্ছিক', coachCross: 'এগুলো একসঙ্গে দেখুন', coachLoadErr: 'ফর্ম কোচ চালু হয়নি। পাতাটি আবার লোড করুন।', coachRead: 'পড়া হয়েছে' },
});

let V = null;                       // the validation module, loaded on first use
const state = { values: {}, listening: null, copied: false, loadErr: false };
const reset = () => { state.values = {}; state.listening = null; state.copied = false; };
KR.resets.push(reset);

async function start() {
  KR.drop((m) => m.kind === 'coach'); reset();
  try { V ??= await (window.__krImport ? window.__krImport('/lib/validate.mjs') : import('/lib/validate.mjs')); state.loadErr = false; } catch { state.loadErr = true; }
  KR.push({ role: 'bot', kind: 'coach' }); KR.render(true);
}

const lvl = (r) => (r.level === 'ok' ? 'ok' : r.level === 'warn' ? 'warn' : r.level === 'error' ? 'err' : '');
function statusText(f, r) {
  if (!r || r.level === 'empty') return '';
  if (r.code === 'read_as') return `${V.say('read_as', S.lang, V.sayDate(r.value, S.lang))}`;
  return V.say(r.code, S.lang, r.arg);
}
function check(f) { return V.validateField(f.kind, state.values[f.id] ?? ''); }
function counts() { const filled = V.COACH_FIELDS.filter((f) => (state.values[f.id] ?? '').trim()); const good = filled.filter((f) => ['ok', 'warn'].includes(check(f).level) && check(f).level === 'ok'); return [good.length, filled.length]; }

function speakInto(f, row) {
  const Rec = KR.Rec; if (!Rec) return;
  if (state.listening === f.id) { state.rec && state.rec.stop(); return; }
  const rec = new Rec(); state.rec = rec; rec.lang = S.lang === 'bn' ? 'bn-BD' : 'en-US'; rec.interimResults = false; rec.continuous = false;
  rec.onresult = (e) => { const heard = Array.from(e.results).map((r) => r[0].transcript).join(' '); const v = V.fromSpeech(f.kind, heard); state.values[f.id] = v; paint(row, f); updateSummary(); };
  rec.onend = () => { state.listening = null; KR.render(); }; rec.onerror = () => { state.listening = null; KR.render(); };
  try { rec.start(); state.listening = f.id; KR.render(); } catch { state.listening = null; }
}
function paint(row, f) {      // update one row in place so typing never loses focus
  const r = check(f), s = row.querySelector('.fstatus'), i = row.querySelector('input');
  if (i && i.value !== (state.values[f.id] ?? '')) i.value = state.values[f.id] ?? '';
  s.textContent = statusText(f, r); s.className = `fstatus ${lvl(r)}`; row.dataset.level = r.level; i.setAttribute('aria-invalid', r.level === 'error');
}
function updateSummary() {
  const box = document.getElementById('coachSummary'); if (!box) return; const [g, n] = counts(); box.textContent = n ? t('coachCount')(g, n) : '';
  const cross = document.getElementById('coachCross'); if (cross) { const found = V.crossCheck(state.values); cross.replaceChildren(...found.map((c) => el('p', { class: 'notice' }, V.say(c.code, S.lang)))); }
}
function answersText() { return V.COACH_FIELDS.map((f) => { const r = check(f); const v = r.level === 'empty' ? '' : (r.code === 'read_as' ? V.sayDate(r.value, S.lang) : r.value); return `${f.label[S.lang]}: ${v}`; }).join('\n'); }

function viewCoach() {
  queueMicrotask(updateSummary);
  if (state.loadErr || !V) return el('div', { class: 'body' }, el('p', { class: 'notice err', role: 'alert' }, t('coachLoadErr')));
  return el('div', { class: 'body' }, el('div', { class: 'card coach' },
    el('h3', null, t('coachTitle')), el('p', { class: 'sm' }, t('coachSub')), el('p', { class: 'notice local' }, t('coachLocal')),
    V.COACH_FIELDS.map((f) => {
      const id = `cf-${f.id}`, row = el('div', { class: 'field', 'data-field': f.id });
      const inp = el('input', { id, type: 'text', inputmode: f.kind === 'nid' || f.kind === 'mobile' ? 'numeric' : f.kind === 'email' ? 'email' : 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', value: state.values[f.id] ?? '', 'aria-describedby': `${id}-s ${id}-h`, on: { input: (e) => { state.values[f.id] = e.target.value; paint(row, f); updateSummary(); } } });
      const mic = KR.Rec && el('button', { type: 'button', class: 'iconbtn', 'aria-pressed': state.listening === f.id, 'aria-label': `${t('coachSpeak')}: ${f.label[S.lang]}`, title: t('coachSpeak'), on: { click: () => speakInto(f, row) } }, icon('M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v3'));
      row.append(el('label', { for: id }, f.label[S.lang], f.optional && el('span', { class: 'sm' }, ` (${t('coachOptional')})`)), el('p', { class: 'sm', id: `${id}-h` }, state.listening === f.id ? t('coachListening') : f.hint[S.lang]), el('div', { class: 'frow' }, inp, mic),
        el('p', { class: 'fstatus', id: `${id}-s`, role: 'status', 'aria-live': 'polite' }));
      queueMicrotask(() => paint(row, f)); return row;
    }),
    el('div', { id: 'coachCross' }), el('p', { id: 'coachSummary', class: 'ok', role: 'status' }),
    el('div', { class: 'actions' },
      el('button', { type: 'button', class: 'btn', 'data-coach-copy': true, on: { click: async () => { try { await navigator.clipboard.writeText(answersText()); state.copied = true; } catch { state.copied = false; } KR.render(); setTimeout(() => { state.copied = false; KR.render(); }, 2000); } } }, state.copied ? t('coachCopied') : t('coachCopy')),
      el('button', { type: 'button', class: 'btn ghost', on: { click: () => KR.startCheck() } }, t('coachNext')),
      el('button', { type: 'button', class: 'btn ghost', on: { click: () => { reset(); KR.render(); } } }, t('coachClear')))));
}
KR.views.coach = viewCoach;
KR.langChanged.push(() => {});
KR.register({ id: 'coach', order: 2, icon: 'M9 11H5a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2v-6a2 2 0 00-2-2h-4M12 3v12M8 7l4-4 4 4', label: { en: 'Fill a form', bn: 'ফর্ম পূরণ' }, start });
})();
