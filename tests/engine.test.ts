import { beforeAll, describe, expect, it } from 'vitest';
import { loadPack } from '../src/pack/load';
import { buildReport, toLogSafe } from '../src/report/verdict';
import { appliesTo } from '../src/rules/engine';
import { cleanSubmission, f, TODAY } from './helpers';
import type { Pack } from '../src/pack/schema';

let pack: Pack;
beforeAll(() => { pack = loadPack('tests/fixtures/packs/bd-passport-adult-renewal.json'); });
const run = (mut?: (s: ReturnType<typeof cleanSubmission>) => void) => {
  const s = cleanSubmission(); mut?.(s); return buildReport(pack, s, { today: TODAY });
};
const outcome = (r: ReturnType<typeof run>, id: string) => r.results.find((x) => x.ruleId === id)?.outcome;

describe('verdicts', () => {
  it('clean documents are READY', () => expect(run().verdict).toBe('READY'));
  it('date of birth mismatch is NOT_READY', () => {
    const r = run((s) => { s.docs.old_passport!.dob = f('12/03/1991'); });
    expect(r.verdict).toBe('NOT_READY');
    expect(outcome(r, 'RN-010')).toBe('FAIL');
    expect(r.results[0].ruleId).toBe('RN-010');            // blockers sort first
    expect(r.results[0].fixService).toBe('bd-nid-correction');
  });
  it('missing blocker document is NOT_READY', () => {
    const r = run((s) => { delete s.docs.old_passport; });
    expect(r.verdict).toBe('NOT_READY');
    expect(outcome(r, 'RN-001')).toBe('FAIL');
    expect(outcome(r, 'RN-010')).toBe('UNSURE');
  });
  it('low confidence can never produce READY', () => {
    const r = run((s) => { s.docs.nid!.dob = f('12 Mar 1990', 0.5); });
    expect(outcome(r, 'RN-010')).toBe('UNSURE');
    expect(r.verdict).toBe('ALMOST_READY');
  });
  it('a name difference is a warning, not a blocker', () => {
    const r = run((s) => { s.docs.nid!.name = f('Md. Abdur Rahim'); });
    expect(outcome(r, 'RN-011')).toBe('FAIL');
    expect(r.verdict).toBe('ALMOST_READY');
  });
  it('under 18 is flagged', () => {
    const r = run((s) => { s.docs.nid!.dob = f('05/06/2010'); s.docs.old_passport!.dob = f('05/06/2010'); });
    expect(outcome(r, 'RN-030')).toBe('FAIL');
  });
  it('an absent but legible field fails; an unreadable one is unsure', () => {
    expect(outcome(run((s) => { s.docs.old_passport!.passport_number = f(null); }), 'RN-012')).toBe('FAIL');
    expect(outcome(run((s) => { s.docs.old_passport!.passport_number =
      { value: null, confidence: 0.2, legible: false }; }), 'RN-012')).toBe('UNSURE');
  });
});

describe('report metadata', () => {
  it('flags a draft pack and always carries the disclaimer', () => {
    const r = run();
    expect(r.packStatus).toBe('DRAFT_UNVERIFIED');
    expect(r.disclaimer_en).toMatch(/not an official approval/);
  });
  it('marks a pack stale after review_by', () => {
    const stale = { ...pack, review_by: '2026-01-01' };
    expect(buildReport(stale, cleanSubmission(), { today: TODAY }).stale).toBe(true);
  });
});

describe('conditions and severity', () => {
  it('applies rules only when "when" matches', () => {
    const rule: any = { when: { applicant_type: 'minor' } };
    expect(appliesTo(rule, { applicantType: 'minor', docs: {} })).toBe(true);
    expect(appliesTo(rule, { applicantType: 'adult', docs: {} })).toBe(false);
  });
  it('info rules never change the verdict', () => {
    const p = structuredClone(pack);
    p.rules = p.rules.map((r) => (r.id === 'RN-011' ? { ...r, severity: 'info' as const } : r));
    const s = cleanSubmission(); s.docs.nid!.name = f('Abdur Rohim');
    expect(buildReport(p, s, { today: TODAY }).verdict).toBe('READY');
  });
});

describe('privacy', () => {
  it('toLogSafe never exposes evidence or values', () => {
    const r = run((s) => { s.docs.old_passport!.dob = f('12/03/1991'); });
    const safe = JSON.stringify(r.results.map(toLogSafe));
    expect(safe).not.toMatch(/1991|1990|Rahim|1234567890/);
    expect(Object.keys(toLogSafe(r.results[0])).sort()).toEqual(['outcome', 'reason', 'ruleId', 'severity']);
  });
});
