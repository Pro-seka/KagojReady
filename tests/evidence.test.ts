import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import type { Loaded } from '../src/evidence/load';
import { Deployment, DeviceTest, HostLogCheck, Interview, LegalReview, UserTest } from '../src/evidence/schema';
import { deploymentGate, deviceGate, hostLogsGate, interviewsGate, legalGate, nrbGate, userTestsGate } from '../src/evidence/gates';

const TODAY = '2026-12-01';
const ok = <T,>(data: T, file = 'x.json'): Loaded<T> => ({ file, ok: true, data });
const bad = (error = 'broken', file = 'bad.json'): Loaded<never> => ({ file, ok: false, error });
const parse = <T,>(s: { parse: (x: unknown) => T }, o: unknown) => s.parse(o);

const interview = (o: any = {}) => parse(Interview, { id: 'IN-01', date: '2026-11-20', interviewer: 'Team member', role: 'digital_centre_operator', consent_recorded: true,
  rejection_reasons: ['name spelling differs'], knows_rules_beforehand: 'rarely', would_use_before_trip: true, original_notes_ref: 'drive folder A', ...o });
const test = (i: number, o: any = {}, r: any = {}) => parse(UserTest, { id: `UT-${String(i).padStart(2, '0')}`, date: '2026-11-25', facilitator: 'Team member', build: 'kagojready-m5', consent_recorded: true,
  participant: { age_band: '25-34', device: 'android', literacy_self: 'medium', language_used: 'bn', is_nrb: false }, used_own_documents: false, documents_deleted_after: true,
  result: { verdict_shown: 'NOT_READY', verdict_correct_per_facilitator: true, completed_without_help: true, minutes: 4, understood_verdict: true, understood_fix_steps: true, would_use: true, ...r },
  original_notes_ref: 'drive folder B', ...o });
const device = (o: any = {}, s: any = {}) => parse(DeviceTest, { date: '2026-11-28', tester: 'Team member', build: 'kagojready-m5', device_model: 'Redmi 12', android_version: '13', browser: 'Chrome', network: '4g_slow', check_time_seconds: 22,
  steps: { consent_shown: true, camera_capture_works: true, upload_both_documents: true, verdict_shown: true, bangla_renders_correctly: true, english_toggle_works: true, delete_works: true, no_sideways_scrolling: true, readable_in_daylight: true, ...s }, ...o });
const deployment = (o: any = {}) => parse(Deployment, { tool: 'smoke-remote@1', date: '2026-11-30T10:00:00Z', url: 'https://kagojready.example', https: true, demo: false,
  packs: [{ id: 'bd-passport-adult-renewal', status: 'VERIFIED' }], checks: [{ name: 'health', ok: true }], all_passed: true, ...o });

describe('evidence schemas', () => {
  it('reject placeholder text, names instead of codes, missing consent and empty reasons', () => {
    expect(() => interview({ interviewer: 'REPLACE ME' })).toThrow(/placeholder/);
    expect(() => interview({ id: 'Rahim' })).toThrow(/code/);
    expect(() => interview({ consent_recorded: false })).toThrow();
    expect(() => interview({ rejection_reasons: [] })).toThrow();
    expect(() => interview({ original_notes_ref: 'TODO' })).toThrow(/placeholder/);
  });
  it('reject own documents that were not confirmed deleted', () => {
    expect(() => test(1, { used_own_documents: true, documents_deleted_after: false })).toThrow(/deleted/);
    expect(() => test(1, { used_own_documents: true, documents_deleted_after: true })).not.toThrow();
  });
  it('every template is valid once its placeholders are replaced, and invalid before', () => {
    const map: Record<string, any> = { 'interview.json': Interview, 'user-test.json': UserTest, 'device-test.json': DeviceTest, 'host-log-check.json': HostLogCheck, 'legal-review.json': LegalReview };
    const files = readdirSync('evidence/templates'); expect(files.sort()).toEqual(Object.keys(map).sort());
    for (const f of files) {
      const raw = readFileSync(`evidence/templates/${f}`, 'utf8');
      expect(map[f].safeParse(JSON.parse(raw)).success, `${f} must not pass unedited`).toBe(false);
      const filled = JSON.parse(raw.replaceAll('REPLACE ME', 'real text written by a person'));
      const r = map[f].safeParse(filled); expect(r.success, `${f}: ${r.success ? '' : r.error.message}`).toBe(true);
    }
  });
});

describe('interviews gate', () => {
  it('is pending with none, one, or only non-operators; passes with 2 including an operator', () => {
    expect(interviewsGate([], TODAY).status).toBe('PENDING');
    expect(interviewsGate([ok(interview())], TODAY).status).toBe('PENDING');
    expect(interviewsGate([ok(interview({ role: 'applicant' })), ok(interview({ id: 'IN-02', role: 'nrb' }))], TODAY).status).toBe('PENDING');
    const g = interviewsGate([ok(interview()), ok(interview({ id: 'IN-02', role: 'applicant', knows_rules_beforehand: 'mostly' }))], TODAY);
    expect(g.status).toBe('PASS'); expect(g.detail).toMatch(/1 say people do not usually know/);
  });
  it('fails on invalid files and on future dates', () => {
    expect(interviewsGate([ok(interview()), bad()], TODAY).status).toBe('FAIL');
    expect(interviewsGate([ok(interview({ date: '2027-05-01' }))], TODAY).detail).toMatch(/future/);
  });
});

describe('user tests gate', () => {
  const many = (n: number, mk: (i: number) => ReturnType<typeof test>) => Array.from({ length: n }, (_, i) => ok(mk(i + 1)));
  it('needs 10 tests', () => expect(userTestsGate(many(9, (i) => test(i)), TODAY).status).toBe('PENDING'));
  it('passes with 10 good tests', () => expect(userTestsGate(many(10, (i) => test(i)), TODAY).status).toBe('PASS'));
  it('fails when too few finish unaided, or too few understand the verdict', () => {
    expect(userTestsGate(many(10, (i) => test(i, {}, { completed_without_help: i > 5 })), TODAY).status).toBe('FAIL');
    expect(userTestsGate(many(10, (i) => test(i, {}, { understood_verdict: i > 5 })), TODAY).status).toBe('FAIL');
    expect(userTestsGate(many(10, (i) => test(i, {}, { completed_without_help: i > 2 })), TODAY).status).toBe('PASS');   // exactly 70%
  });
  it('fails outright if anyone was told READY when it was wrong', () => {
    const g = userTestsGate(many(10, (i) => test(i, {}, i === 3 ? { verdict_shown: 'READY', verdict_correct_per_facilitator: false } : {})), TODAY);
    expect(g.status).toBe('FAIL'); expect(g.detail).toMatch(/safety/);
  });
  it('NRB gate needs at least one NRB participant', () => {
    expect(nrbGate(many(10, (i) => test(i)), TODAY).status).toBe('PENDING');
    expect(nrbGate([ok(test(1, { participant: { age_band: '35-49', device: 'ios', literacy_self: 'high', language_used: 'en', is_nrb: true } }))], TODAY).status).toBe('PASS');
  });
});

describe('device gate', () => {
  it('is pending with none or only fast networks', () => {
    expect(deviceGate([], TODAY).status).toBe('PENDING');
    expect(deviceGate([ok(device({ network: 'wifi' }))], TODAY).status).toBe('PENDING');
    expect(deviceGate([ok(device({ check_time_seconds: 90 }))], TODAY).status).toBe('PENDING');
  });
  it('fails if any step failed, names the step; passes on a clean slow-network run', () => {
    const f = deviceGate([ok(device({}, { bangla_renders_correctly: false }))], TODAY);
    expect(f.status).toBe('FAIL'); expect(f.detail).toMatch(/bangla_renders_correctly/);
    expect(deviceGate([ok(device())], TODAY).status).toBe('PASS');
  });
});

describe('deployment, host log and legal gates', () => {
  it('deployment: needs a smoke test, HTTPS, all checks, and a recent date', () => {
    expect(deploymentGate(null, TODAY).status).toBe('PENDING');
    expect(deploymentGate(ok(deployment()), TODAY).status).toBe('PASS');
    expect(deploymentGate(ok(deployment({ https: false })), TODAY).status).toBe('FAIL');
    expect(deploymentGate(ok(deployment({ all_passed: false, checks: [{ name: 'csp', ok: false }] })), TODAY).detail).toMatch(/csp/);
    expect(deploymentGate(ok(deployment({ date: '2026-09-01T00:00:00Z' })), TODAY).status).toBe('PENDING');
    expect(() => deployment({ demo: true })).toThrow();
  });
  it('host logs: passes only if reviewed and clean', () => {
    const h = (o: any = {}) => ok(parse(HostLogCheck, { date: '2026-11-29', reviewer: 'Team member', host: 'Render web service', log_window: 'one week', requests_reviewed: 40, personal_data_found: false, original_notes_ref: 'drive C', ...o }));
    expect(hostLogsGate(null, TODAY).status).toBe('PENDING'); expect(hostLogsGate(h(), TODAY).status).toBe('PASS');
    expect(hostLogsGate(h({ personal_data_found: true }), TODAY).status).toBe('FAIL');
    expect(() => parse(HostLogCheck, { ...JSON.parse('{}') })).toThrow(); expect(() => h({ requests_reviewed: 5 })).toThrow();
  });
  it('legal: approved passes; conditions stay pending until closed; rejection fails', () => {
    const l = (o: any = {}) => ok(parse(LegalReview, { date: '2026-11-29', reviewer: 'Counsel A', organization: 'Law firm', scope: ['data protection'], outcome: 'approved', document_ref: 'drive D', ...o }));
    expect(legalGate(null, TODAY).status).toBe('PENDING'); expect(legalGate(l(), TODAY).status).toBe('PASS');
    expect(legalGate(l({ outcome: 'approved_with_conditions', conditions: ['add a privacy page'] }), TODAY).status).toBe('PENDING');
    expect(legalGate(l({ outcome: 'approved_with_conditions', conditions: ['add a privacy page'], conditions_closed: true }), TODAY).status).toBe('PASS');
    expect(legalGate(l({ outcome: 'rejected' }), TODAY).status).toBe('FAIL');
  });
});
