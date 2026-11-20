(() => {
'use strict';
const $ = (id) => document.getElementById(id);
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === 'class') n.className = v; else n.setAttribute(k, v); }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return n;
}
const pct = (v) => (v == null ? 'not enough data' : `${Math.round(v * 100)}%`);
const ms = (v) => (v == null ? 'n/a' : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`);
const kpi = (value, label) => el('div', { class: 'kpi' }, el('b', { class: /[a-z]/i.test(String(value)) ? 'txt' : null }, value), el('span', null, label));
function bars(title, rows) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return el('section', null, el('h2', { class: 'sm' }, title), rows.length ? rows.map((r) => el('div', { class: 'bar' }, el('span', null, r.label), el('div', { role: 'img', 'aria-label': `${r.label}: ${r.count}` }, el('i', { 'data-w': Math.round((100 * r.count) / max) })), el('b', null, r.count))) : el('p', { class: 'sm' }, 'No data yet'));
}
function show(d) {
  $('out').replaceChildren(...[
    d.demo && el('p', { class: 'strip' }, 'Synthetic demo numbers, not real usage.'),
    el('div', { class: 'kpis' },
      kpi(d.totals.questions, 'Questions asked'), kpi(pct(d.answerRate), 'Answered from sources'), kpi(pct(d.satisfaction), 'Found it helpful'),
      kpi(d.totals.checks, 'Document checks'), kpi(d.totals.plainRequests ?? 0, 'Plain-language reads'), kpi(d.totals.reports ?? 0, 'Problem reports'), kpi(pct(d.groundedByAiRate), 'Written by AI, then verified'), kpi(d.questionsWithPersonalNumbersRemoved, 'Questions with personal numbers hidden')),
    el('div', { class: 'grid2' }, bars('What people ask about', d.topics), bars('Language', d.languages), bars('How questions were answered', d.answerModes),
      bars('Document check outcomes', d.verdicts), bars('Rules that fail most often', d.topFailedRules),
      bars('Services people asked for that we do not cover yet', d.unmetDemand ?? []), bars('Problem reports by category', (d.reports && d.reports.byCategory) || []), bars('How hard the pasted texts were', (d.plain && d.plain.levels) || [])),
    d.reports && el('p', { class: 'sm' }, `Reports: ${d.reports.supports} "me too" supports, ${d.reports.duplicatesPrevented} duplicate reports avoided, AI category suggestion accepted ${pct(d.reports.aiSuggestionAcceptRate)}. Plain-language reads rewritten by AI and verified: ${pct(d.plain && d.plain.aiGroundedRate)}.`),
    el('p', { class: 'sm' }, `Median reply ${ms(d.latencyMs.chatP50)}, slowest 1 in 20 ${ms(d.latencyMs.chatP95)}. Median document check ${ms(d.latencyMs.checkP50)}. Counting since ${d.since.slice(0, 10)}. Groups under ${d.minCount} are hidden.`)].filter(Boolean));
  // bar widths are set through the DOM, not inline styles, so the strict content-security policy can stay on
  document.querySelectorAll('i[data-w]').forEach((i) => { i.style.width = `${i.getAttribute('data-w')}%`; });
}
$('auth').addEventListener('submit', async (e) => {
  e.preventDefault(); const msg = $('msg'); msg.hidden = true;
  try {
    const r = await fetch('/api/insights', { headers: { authorization: `Bearer ${$('token').value}` } });
    if (r.status === 401) { msg.textContent = 'That token is not valid.'; msg.hidden = false; return; }
    if (r.status === 404) { msg.textContent = 'Insights are not switched on for this server.'; msg.hidden = false; return; }
    if (r.status === 429) { msg.textContent = 'Too many attempts. Wait a few minutes.'; msg.hidden = false; return; }
    if (!r.ok) throw new Error(); show(await r.json());
  } catch { msg.textContent = 'Could not load the insights.'; msg.hidden = false; }
});
})();
