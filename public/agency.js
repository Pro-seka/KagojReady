(() => {
'use strict';
const $ = (id) => document.getElementById(id);
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k === 'on') for (const [e, f] of Object.entries(v)) n.addEventListener(e, f); else n.setAttribute(k, v === true ? '' : v); }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return n;
}
const STATUSES = ['received', 'in_review', 'forwarded', 'resolved', 'rejected'];
const LABEL = { received: 'Received', in_review: 'Being reviewed', forwarded: 'Forwarded', resolved: 'Resolved', rejected: 'Closed without action' };
let token = '', cfg = null, filter = { status: '', category: '' };
const headers = () => ({ authorization: `Bearer ${token}` });
const catName = (id) => (cfg.categories.find((c) => c.id === id) || {}).name_en || id;
const msg = (text) => { const m = $('msg'); m.textContent = text || ''; m.hidden = !text; };

async function load() {
  const q = new URLSearchParams(); if (filter.status) q.set('status', filter.status); if (filter.category) q.set('category', filter.category);
  const r = await fetch(`/api/agency/tickets?${q}`, { headers: headers() });
  if (r.status === 401) return msg('That token is not valid.'); if (r.status === 404) return msg('The agency console is not switched on for this server.'); if (r.status === 429) return msg('Too many attempts. Wait a few minutes.');
  if (!r.ok) return msg('Could not load the reports.');
  msg(''); const d = await r.json(); cfg = d; $('auth').hidden = true; show(d);      // signed in: the token box is not needed on screen any more
}
async function setStatus(t, status, note) {
  const r = await fetch('/api/agency/status', { method: 'POST', headers: { ...headers(), 'content-type': 'application/json' }, body: JSON.stringify({ id: t.id, status, note }) });
  if (!r.ok) return msg('Could not update the report.'); await load();
}
async function showPhoto(t, holder) {
  const r = await fetch(`/api/agency/photo/${t.id}`, { headers: headers() }); if (!r.ok) return msg('Photo not available.');
  holder.replaceChildren(el('img', { src: URL.createObjectURL(await r.blob()), alt: `Photo for ${t.id}`, class: 'ticketphoto' }));
}
async function exportCsv() {
  const r = await fetch('/api/agency/export.csv', { headers: headers() }); if (!r.ok) return msg('Export failed.');
  const a = el('a', { href: URL.createObjectURL(await r.blob()), download: 'kagojready-reports.csv' }); document.body.append(a); a.click(); a.remove();
}
function row(t) {
  const note = el('input', { type: 'text', 'aria-label': `Note for ${t.id}`, maxlength: 280, value: t.note || '', placeholder: 'Note for the reporter (no personal numbers)' });
  const sel = el('select', { 'aria-label': `Status of ${t.id}` }, STATUSES.map((s) => el('option', { value: s, selected: s === t.status }, LABEL[s])));
  const holder = el('div', null);
  return el('article', { class: 'item ticket', 'data-id': t.id, 'data-status': t.status },
    el('h4', null, `${t.id} · ${catName(t.category)}`),
    el('p', { class: 'sm' }, `Priority ${t.priority} · ${t.supporters} supporter${t.supporters === 1 ? '' : 's'} · ${t.createdAt.slice(0, 10)} · addressed to ${t.body.body_en}${t.lat != null ? ` · location ${t.lat}, ${t.lng}` : ''}`),
    t.description && el('p', null, t.description), t.suggested.by === 'ai' && el('p', { class: 'sm' }, `Category suggested by AI and confirmed by the reporter (confidence ${t.suggested.confidence}).`),
    t.hasPhoto && el('p', null, el('button', { type: 'button', class: 'btn ghost', on: { click: () => showPhoto(t, holder) } }, 'Show photo')), holder,
    el('div', { class: 'frow' }, sel, note, el('button', { type: 'button', class: 'btn', on: { click: () => setStatus(t, sel.value, note.value) } }, 'Save')));
}
function show(d) {
  const s = d.summary, fsel = (key, opts) => el('select', { 'aria-label': `Filter by ${key}`, on: { change: (e) => { filter[key] = e.target.value; load(); } } }, [el('option', { value: '' }, `All ${key === 'status' ? 'statuses' : 'categories'}`), ...opts.map(([v, l]) => el('option', { value: v, selected: filter[key] === v }, l))]);
  $('out').replaceChildren(
    el('div', { class: 'kpis' }, el('div', { class: 'kpi' }, el('b', null, s.total), el('span', null, 'Reports in total')), el('div', { class: 'kpi' }, el('b', null, d.tickets.length), el('span', null, 'Shown now')),
      el('div', { class: 'kpi' }, el('b', null, s.resolvedMedianDays == null ? 'n/a' : `${s.resolvedMedianDays} d`), el('span', null, 'Median days to resolve'))),
    el('div', { class: 'frow' }, fsel('status', STATUSES.map((x) => [x, LABEL[x]])), fsel('category', d.categories.map((c) => [c.id, c.name_en])), el('button', { type: 'button', class: 'btn ghost', on: { click: exportCsv } }, 'Export CSV')),
    ...(d.tickets.length ? d.tickets.map(row) : [el('p', { class: 'sm' }, 'No reports match.')]));
}
$('auth').addEventListener('submit', (e) => { e.preventDefault(); token = $('token').value; load().catch(() => msg('Could not load the reports.')); });
})();
