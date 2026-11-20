import type { z } from 'zod';
import type { Loaded } from './load';
import { OPERATOR_ROLES, type Deployment, type DeviceTest, type HostLogCheck, type Interview, type LegalReview, type UserTest } from './schema';

export type GateResult = { status: 'PASS' | 'FAIL' | 'PENDING'; detail: string };
export const THRESHOLDS = { interviews: 2, userTests: 10, completion: 0.7, understood: 0.7, slowCheckSeconds: 45, deploymentMaxAgeDays: 30 };

type L<T> = Array<Loaded<T>>;
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : 'n/a');
const ageDays = (iso: string, today: string) => (Date.parse(today) - Date.parse(iso.slice(0, 10))) / 86_400_000;

/** Splits files into valid records and a list of problems. A future date is a problem. */
function sort<T extends { date: string }>(items: L<T>, today: string) {
  const good: T[] = []; const problems: string[] = [];
  for (const i of items) {
    if (!i.ok) problems.push(`${i.file}: ${i.error}`);
    else if (i.data.date.slice(0, 10) > today) problems.push(`${i.file}: date is in the future`);
    else good.push(i.data);
  }
  return { good, problems };
}
const invalid = (problems: string[]): GateResult => ({ status: 'FAIL', detail: `${problems.length} invalid evidence file(s): ${problems.slice(0, 2).join(' | ')}` });

export function interviewsGate(items: L<z.infer<typeof Interview>>, today: string): GateResult {
  const { good, problems } = sort(items, today); if (problems.length) return invalid(problems);
  const ops = good.filter((g) => (OPERATOR_ROLES as readonly string[]).includes(g.role)).length;
  if (good.length < THRESHOLDS.interviews || ops < 1) return { status: 'PENDING', detail: `${good.length} of ${THRESHOLDS.interviews} interviews recorded, ${ops} with an operator (need at least 1)` };
  const unaware = good.filter((g) => g.knows_rules_beforehand !== 'mostly').length;
  return { status: 'PASS', detail: `${good.length} interviews (${ops} operators): ${unaware} say people do not usually know the rules beforehand, ${good.filter((g) => g.would_use_before_trip).length} would use a pre-check` };
}

export function userTestsGate(items: L<z.infer<typeof UserTest>>, today: string): GateResult {
  const { good, problems } = sort(items, today); if (problems.length) return invalid(problems);
  if (good.length < THRESHOLDS.userTests) return { status: 'PENDING', detail: `${good.length} of ${THRESHOLDS.userTests} user tests recorded` };
  const wrongReady = good.filter((g) => g.result.verdict_shown === 'READY' && g.result.verdict_correct_per_facilitator === false).length;
  if (wrongReady) return { status: 'FAIL', detail: `${wrongReady} test(s) were told READY when the facilitator judged it wrong. This is a safety failure` };
  const done = good.filter((g) => g.result.completed_without_help).length, und = good.filter((g) => g.result.understood_verdict).length;
  const ok = done / good.length >= THRESHOLDS.completion && und / good.length >= THRESHOLDS.understood;
  const android = good.filter((g) => g.participant.device === 'android').length;
  return { status: ok ? 'PASS' : 'FAIL', detail: `${good.length} tests: ${pct(done, good.length)} finished unaided, ${pct(und, good.length)} understood the verdict, ${good.filter((g) => g.result.would_use).length} would use it, ${android} on Android (need ${pct(THRESHOLDS.completion * 100, 100)} for both)` };
}

export function nrbGate(items: L<z.infer<typeof UserTest>>, today: string): GateResult {
  const { good } = sort(items, today); const n = good.filter((g) => g.participant.is_nrb).length;
  return n >= 1 ? { status: 'PASS', detail: `${n} NRB participant(s) in recorded tests` } : { status: 'PENDING', detail: 'no NRB participant recorded yet (mark is_nrb in a user test)' };
}

export function deviceGate(items: L<z.infer<typeof DeviceTest>>, today: string): GateResult {
  const { good, problems } = sort(items, today); if (problems.length) return invalid(problems);
  if (!good.length) return { status: 'PENDING', detail: 'no real-device test recorded yet' };
  const failed = good.filter((g) => Object.values(g.steps).some((v) => !v));
  if (failed.length) return { status: 'FAIL', detail: `${failed.length} device test(s) have failing steps: ${Object.entries(failed[0].steps).filter(([, v]) => !v).map(([k]) => k).join(', ')}` };
  const slow = good.filter((g) => (g.network === '3g' || g.network === '4g_slow') && g.check_time_seconds <= THRESHOLDS.slowCheckSeconds);
  if (!slow.length) return { status: 'PENDING', detail: `need one passing test on a slow network (3g or 4g_slow) finishing within ${THRESHOLDS.slowCheckSeconds}s` };
  return { status: 'PASS', detail: `${good.length} device test(s), e.g. ${slow[0].device_model} on ${slow[0].network} in ${slow[0].check_time_seconds}s` };
}

export function deploymentGate(item: Loaded<z.infer<typeof Deployment>> | null, today: string): GateResult {
  if (!item) return { status: 'PENDING', detail: 'no deployment smoke test yet. Run: npm run smoke -- https://your-host' };
  if (!item.ok) return { status: 'FAIL', detail: `${item.file}: ${item.error}` };
  const d = item.data, age = ageDays(d.date, today);
  if (!d.https) return { status: 'FAIL', detail: `${d.url} is not served over HTTPS` };
  if (!d.all_passed) return { status: 'FAIL', detail: `smoke test failed: ${d.checks.filter((c) => !c.ok).map((c) => c.name).join(', ')}` };
  if (age > THRESHOLDS.deploymentMaxAgeDays) return { status: 'PENDING', detail: `smoke test is ${Math.round(age)} days old. Re-run it` };
  return { status: 'PASS', detail: `${d.url}: ${d.checks.length} checks passed ${d.date.slice(0, 10)}; packs served: ${d.packs.map((p) => `${p.id} ${p.status}`).join(', ') || 'none'}` };
}

export function hostLogsGate(item: Loaded<z.infer<typeof HostLogCheck>> | null, today: string): GateResult {
  if (!item) return { status: 'PENDING', detail: 'no host log check recorded yet' };
  if (!item.ok) return { status: 'FAIL', detail: `${item.file}: ${item.error}` };
  if (item.data.date > today) return { status: 'FAIL', detail: 'date is in the future' };
  return item.data.personal_data_found ? { status: 'FAIL', detail: 'personal data was found in host logs' }
    : { status: 'PASS', detail: `${item.data.requests_reviewed} requests reviewed on ${item.data.host}, none contained personal data` };
}

export function legalGate(item: Loaded<z.infer<typeof LegalReview>> | null, today: string): GateResult {
  if (!item) return { status: 'PENDING', detail: 'no legal/privacy review recorded yet' };
  if (!item.ok) return { status: 'FAIL', detail: `${item.file}: ${item.error}` };
  const d = item.data; if (d.date > today) return { status: 'FAIL', detail: 'date is in the future' };
  if (d.outcome === 'rejected') return { status: 'FAIL', detail: `reviewer ${d.reviewer} rejected it` };
  if (d.outcome === 'approved_with_conditions' && !d.conditions_closed) return { status: 'PENDING', detail: `${d.conditions.length} condition(s) still to close` };
  return { status: 'PASS', detail: `${d.outcome.replace(/_/g, ' ')} by ${d.reviewer} (${d.organization}) on ${d.date}` };
}
