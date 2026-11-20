import type { Pack, Rule } from '../pack/schema';
import type { ExtractedDoc, ExtractedField, MatchLevel, Outcome, RuleResult, Submission } from '../types';
import { toAsciiDigits } from '../normalize/digits';
import { ageOn, parseDate } from '../normalize/dates';
import { compareNames } from '../normalize/names';

export interface EvalOptions { today: string; minConfidence?: number }
export const DEFAULT_MIN_CONFIDENCE = 0.8;

type Partial3 = { outcome: Outcome; reason: string; evidence?: Record<string, unknown> };
const ORDER: MatchLevel[] = ['exact', 'equivalent', 'close', 'different'];
const NAME_FIELDS = new Set(['name', 'father_name', 'mother_name', 'spouse_name']);
const DATE_FIELDS = new Set(['dob', 'expiry_date', 'issue_date']);

export function appliesTo(rule: Rule, sub: Submission): boolean {
  if (!rule.when) return true;
  const ctx: Record<string, string> = { applicant_type: sub.applicantType };
  return Object.entries(rule.when).every(([k, v]) => ctx[k] === v);
}

const unusable = (f: ExtractedField | undefined, min: number) =>
  !f || !f.legible || f.confidence < min || f.value == null;

/** Why a field cannot be used for a decision, or null if it can. */
function whyUnusable(doc: ExtractedDoc | undefined, field: string, min: number): string | null {
  if (!doc) return 'document_missing';
  const f = doc[field];
  if (!f) return 'not_extracted';
  if (!f.legible) return 'unreadable';
  if (f.confidence < min) return 'low_confidence';
  if (f.value == null || f.value.trim() === '') return 'absent';
  return null;
}

function compareField(field: string, a: ExtractedField, b: ExtractedField):
  { level: MatchLevel; via?: string } | null {
  if (NAME_FIELDS.has(field)) return compareNames(a, b);
  if (DATE_FIELDS.has(field)) {
    const da = parseDate(a.value!), db = parseDate(b.value!);
    if (!da || !db) return null;
    return { level: da === db ? 'exact' : 'different' };
  }
  const norm = (s: string) => toAsciiDigits(s).replace(/\s+/g, '').toLowerCase();
  return { level: norm(a.value!) === norm(b.value!) ? 'exact' : 'different' };
}

function evalRule(rule: Rule, sub: Submission, o: Required<EvalOptions>): Partial3 {
  const min = o.minConfidence;
  switch (rule.type) {
    case 'required_document': {
      const doc = sub.docs[rule.doc];
      if (!doc) return { outcome: 'FAIL', reason: 'document_missing' };
      const anyUsable = Object.values(doc).some((f) => !unusable(f, min));
      return anyUsable ? { outcome: 'PASS', reason: 'present' } : { outcome: 'UNSURE', reason: 'unreadable' };
    }
    case 'field_present': {
      const why = whyUnusable(sub.docs[rule.doc], rule.field, min);
      if (why === 'absent') return { outcome: 'FAIL', reason: 'absent' };
      return why ? { outcome: 'UNSURE', reason: why } : { outcome: 'PASS', reason: 'present' };
    }
    case 'format_check': {
      const why = whyUnusable(sub.docs[rule.doc], rule.field, min);
      if (why) return { outcome: 'UNSURE', reason: why };
      const v = toAsciiDigits(sub.docs[rule.doc]![rule.field]!.value!).replace(/\s+/g, '');
      return new RegExp(rule.pattern).test(v)
        ? { outcome: 'PASS', reason: 'format_ok' }
        : { outcome: 'FAIL', reason: 'format_bad', evidence: { value: v } };
    }
    case 'date_check': {
      const why = whyUnusable(sub.docs[rule.doc], rule.field, min);
      if (why) return { outcome: 'UNSURE', reason: why };
      const iso = parseDate(sub.docs[rule.doc]![rule.field]!.value!);
      if (!iso) return { outcome: 'UNSURE', reason: 'unparseable_date' };
      if (rule.check === 'min_age') {
        const age = ageOn(iso, o.today);
        return age >= rule.years!
          ? { outcome: 'PASS', reason: 'age_ok', evidence: { age } }
          : { outcome: 'FAIL', reason: 'too_young', evidence: { age } };
      }
      return iso >= o.today
        ? { outcome: 'PASS', reason: 'not_expired', evidence: { date: iso } }
        : { outcome: 'FAIL', reason: 'expired', evidence: { date: iso } };
    }
    case 'field_match': {
      const reasons = rule.docs.map((d) => whyUnusable(sub.docs[d], rule.field, min));
      const firstBad = reasons.find((r) => r !== null);
      if (firstBad) return { outcome: 'UNSURE', reason: firstBad === 'absent' ? 'unreadable' : firstBad };
      const fields = rule.docs.map((d) => sub.docs[d]![rule.field]!);
      let worst: MatchLevel = 'exact';
      const pairs: Array<Record<string, unknown>> = [];
      for (let i = 0; i < fields.length; i++) {
        for (let j = i + 1; j < fields.length; j++) {
          const c = compareField(rule.field, fields[i], fields[j]);
          if (!c) return { outcome: 'UNSURE', reason: 'not_comparable' };
          pairs.push({ docs: [rule.docs[i], rule.docs[j]], level: c.level, via: c.via ?? 'direct' });
          if (ORDER.indexOf(c.level) > ORDER.indexOf(worst)) worst = c.level;
        }
      }
      return rule.pass_levels.includes(worst)
        ? { outcome: 'PASS', reason: 'match', evidence: { level: worst, pairs } }
        : { outcome: 'FAIL', reason: 'mismatch', evidence: { level: worst, pairs } };
    }
  }
}

export function evaluateRules(pack: Pack, sub: Submission, opts: EvalOptions): RuleResult[] {
  const o = { today: opts.today, minConfidence: opts.minConfidence ?? DEFAULT_MIN_CONFIDENCE };
  return pack.rules.filter((r) => appliesTo(r, sub)).map((rule) => {
    const r = evalRule(rule, sub, o);
    return {
      ruleId: rule.id, type: rule.type, docs: rule.type === 'field_match' ? rule.docs : [rule.doc], outcome: r.outcome, reason: r.reason,
      severity: rule.severity, ruleStatus: rule.rule_status,
      message_en: rule.message_en, message_bn: rule.message_bn,
      fix_en: rule.fix_en, fix_bn: rule.fix_bn, fixService: rule.fix_service,
      source: rule.source_ref !== undefined ? pack.sources[rule.source_ref] : null,
      evidence: r.evidence ?? {},
    };
  });
}
