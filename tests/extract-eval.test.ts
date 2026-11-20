import { describe, expect, it } from 'vitest';
import { judgeField, loadManifest, oracleClient, runExtractionEval } from '../eval/extract-eval';
import { anthropicClient } from '../src/extract/anthropic';
import { JPEG } from './helpers';
import type { LlmClient } from '../src/extract/types';

const manifest = loadManifest();
const PACK = 'tests/fixtures/packs/bd-passport-adult-renewal.json';   // frozen fixture: these tests check the harness, not the real pack's current rules
/** Wrap the oracle and let a test tamper with the JSON it returns. */
const tamper = (fn: (doc: string, out: any) => void): LlmClient => {
  const base = oracleClient(manifest);
  return { complete: async (req) => { const out = JSON.parse(await base.complete(req)); fn(req.userText.includes('National ID') ? 'nid' : 'old_passport', out); return JSON.stringify(out); } };
};

describe('specimen set', () => {
  it('has 30+ sets covering clean and every degraded photo profile', () => {
    expect(manifest.length).toBeGreaterThanOrEqual(30);
    expect(new Set(manifest.map((s) => s.profile))).toEqual(new Set(['clean', 'blur', 'heavy_blur', 'lowlight', 'glare', 'tilt', 'cropped', 'jpeg_low']));
  });
  it('covers content errors, not only clean documents', () => {
    const cases = new Set(manifest.map((s) => s.case));
    for (const c of ['dob_year_mismatch', 'dob_day_month_swapped', 'name_honorific_missing', 'missing_old_passport', 'applicant_under_18']) expect(cases.has(c)).toBe(true);
  });
});

describe('harness correctness', () => {
  it('a perfect extractor scores 100% with no dangerous outcomes', async () => {
    const r = await runExtractionEval(oracleClient(manifest), manifest, { packPath: PACK });
    expect(r.total).toMatchObject({ sets: manifest.length, exact: manifest.length, falseReady: 0, falsePass: 0, falseAlarm: 0 });
    expect(r.total.fields.wrong).toBe(0); expect(r.total.fields.unread).toBe(0);
  });
  it('CATCHES a lazy extractor that hides date-of-birth mismatches (false READY, false pass)', async () => {
    const lazy = tamper((doc, out) => { if (doc === 'old_passport') out.fields.dob.value = '12 Mar 1990'; });
    const r = await runExtractionEval(lazy, manifest, { packPath: PACK });
    expect(r.total.falsePass).toBeGreaterThan(0); expect(r.total.falseReady).toBeGreaterThan(0);
    expect(r.problems.join()).toMatch(/dob_year_mismatch.*FALSE/);
  });
  it('CATCHES a confident misread (last digit of the NID number changed)', async () => {
    const bad = tamper((doc, out) => { if (doc === 'nid') out.fields.nid_number.value = '1234567891'; });
    const r = await runExtractionEval(bad, manifest, { packPath: PACK });
    expect(r.total.fields.wrong).toBeGreaterThan(0); expect(r.problems.join()).toMatch(/misread with confidence/);
  });
  it('a blind extractor that admits it cannot read is safe: false alarms, never false READY', async () => {
    const blind = tamper((_d, out) => { for (const f of Object.values<any>(out.fields)) { f.value = null; f.legible = false; f.confidence = 0.1; } });
    const r = await runExtractionEval(blind, manifest, { packPath: PACK });
    expect(r.total.falseReady).toBe(0); expect(r.total.falsePass).toBe(0); expect(r.total.falseAlarm).toBeGreaterThan(0);
  });
  it('an extractor that invents a missing passport number is counted as a misread', async () => {
    const inv = tamper((doc, out) => { if (doc === 'old_passport') out.fields.passport_number = { value: 'Z999', romanized: null, confidence: 0.95, legible: true }; });
    const r = await runExtractionEval(inv, manifest.filter((s) => s.case === 'passport_number_absent'), { packPath: PACK });
    expect(r.total.fields.wrong).toBeGreaterThan(0);
  });
});

describe('judgeField', () => {
  const f = (value: string | null, confidence = 0.95, legible = true) => ({ value, confidence, legible });
  it('judges names, dates and numbers', () => {
    expect(judgeField('name', f('Abdur Rahim'), { value: 'Abdur Rahim' })).toBe('correct');
    expect(judgeField('name', f('Abdur Rohim'), { value: 'Abdur Rahim' })).toBe('wrong');
    expect(judgeField('name', f('Rahim'), { value: 'Md. Rahim' })).toBe('wrong');
    expect(judgeField('dob', f('12/03/1990'), { value: '12 Mar 1990' })).toBe('correct');
    expect(judgeField('dob', f('১২/০৩/১৯৯০'), { value: '12/03/1990' })).toBe('correct');
    expect(judgeField('nid_number', f('1234 5678 90'), { value: '1234567890' })).toBe('correct');
    expect(judgeField('nid_number', f('1234567891'), { value: '1234567890' })).toBe('wrong');
  });
  it('separates unread from wrong', () => {
    expect(judgeField('dob', f(null, 0.1, false), { value: '12/03/1990' })).toBe('unread');
    expect(judgeField('dob', f('12/03/1990', 0.5), { value: '12/03/1990' })).toBe('unread');
    expect(judgeField('dob', undefined, { value: '12/03/1990' })).toBe('unread');
    expect(judgeField('passport_number', undefined, { value: null })).toBe('skip');
  });
});

describe('usage accounting', () => {
  it('the live client records calls and tokens so budget can be measured', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'x' }], usage: { input_tokens: 1500, output_tokens: 90 } }))) as unknown as typeof fetch;
    const c = anthropicClient({ apiKey: 'k', model: 'm', fetchImpl });
    await c.complete({ system: 's', userText: 'u', image: { base64: JPEG.toString('base64'), mediaType: 'image/jpeg' }, maxTokens: 10 });
    await c.complete({ system: 's', userText: 'u', image: { base64: JPEG.toString('base64'), mediaType: 'image/jpeg' }, maxTokens: 10 });
    expect(c.stats).toEqual({ calls: 2, inputTokens: 3000, outputTokens: 180 });
  });
});
