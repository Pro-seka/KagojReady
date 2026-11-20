import { z } from 'zod';

const Level = z.enum(['exact', 'equivalent', 'close', 'different']);

const base = {
  id: z.string().regex(/^[A-Z]{2,4}-\d{3}$/, 'rule id like RN-010'),
  severity: z.enum(['blocker', 'warning', 'info']),
  rule_status: z.enum(['official', 'operator_reported', 'unconfirmed']),
  when: z.record(z.string(), z.string()).optional(),
  message_en: z.string().min(1),
  message_bn: z.string().min(1),
  fix_en: z.array(z.string().min(1)).min(1),
  fix_bn: z.array(z.string().min(1)).min(1),
  fix_service: z.string().optional(),
  source_ref: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
};

export const RuleSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('required_document'), doc: z.string() }),
  z.object({ ...base, type: z.literal('field_present'), doc: z.string(), field: z.string() }),
  z.object({
    ...base, type: z.literal('field_match'), field: z.string(),
    docs: z.array(z.string()).min(2), pass_levels: z.array(Level).min(1),
  }),
  z.object({ ...base, type: z.literal('format_check'), doc: z.string(), field: z.string(), pattern: z.string() }),
  z.object({
    ...base, type: z.literal('date_check'), doc: z.string(), field: z.string(),
    check: z.enum(['min_age', 'not_expired']), years: z.number().int().positive().optional(),
  }),
]);
export type Rule = z.infer<typeof RuleSchema>;

const DocSchema = z.object({
  id: z.string(),
  name_en: z.string(),
  name_bn: z.string(),
  fields: z.array(z.string()).min(1),
  photo_tip_en: z.string().optional(),
  photo_tip_bn: z.string().optional(),
});

export const PackSchema = z.object({
  pack_id: z.string(),
  version: z.string(),
  country: z.string().length(2),
  status: z.enum(['DRAFT_UNVERIFIED', 'VERIFIED']),
  display_order: z.number().int().default(100),
  service: z.object({ id: z.string(), name_en: z.string(), name_bn: z.string() }),
  last_verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  review_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  verified_by: z.string().min(2).nullable().default(null),
  evidence_url: z.string().url().nullable().default(null),
  sources: z.array(z.object({ label: z.string(), url: z.string().url(), retrieved: z.string() })),
  applicant_types: z.array(z.string()).min(1),
  documents: z.array(DocSchema).min(1),
  rules: z.array(RuleSchema).min(1),
}).superRefine((p, ctx) => {
  const bad = (message: string) => ctx.addIssue({ code: 'custom', message });
  const docs = new Map(p.documents.map((d) => [d.id, d]));
  if (docs.size !== p.documents.length) bad('duplicate document ids');
  const ids = new Set<string>();
  for (const r of p.rules) {
    if (ids.has(r.id)) bad(`duplicate rule id ${r.id}`);
    ids.add(r.id);
    if (r.rule_status === 'unconfirmed' && r.severity === 'blocker')
      bad(`${r.id}: an unconfirmed rule cannot be a blocker`);
    if (r.rule_status === 'official' && r.source_ref === undefined)
      bad(`${r.id}: an official rule needs a source_ref`);
    if (r.source_ref !== undefined && r.source_ref >= p.sources.length)
      bad(`${r.id}: source_ref out of range`);
    const refs: Array<[string, string | undefined]> =
      r.type === 'field_match' ? r.docs.map((d) => [d, r.field] as [string, string])
      : r.type === 'required_document' ? [[r.doc, undefined]]
      : [[r.doc, r.field]];
    for (const [d, f] of refs) {
      const doc = docs.get(d);
      if (!doc) { bad(`${r.id}: unknown document ${d}`); continue; }
      if (f && !doc.fields.includes(f)) bad(`${r.id}: document ${d} has no field ${f}`);
    }
    if (r.type === 'format_check') {
      try { new RegExp(r.pattern); } catch { bad(`${r.id}: invalid regex`); }
    }
    if (r.type === 'date_check' && r.check === 'min_age' && !r.years) bad(`${r.id}: min_age needs years`);
  }
  if (p.status === 'VERIFIED') {
    if (!p.last_verified || !p.review_by) bad('a VERIFIED pack needs last_verified and review_by');
    if (!p.verified_by) bad('a VERIFIED pack needs verified_by (the named person who checked it)');
    if (!p.evidence_url) bad('a VERIFIED pack needs evidence_url (where the saved official pages are kept)');
    for (const r of p.rules) if (r.rule_status === 'unconfirmed') bad(`${r.id}: a VERIFIED pack cannot contain unconfirmed rules (confirm it, mark it operator_reported, or remove it)`);
  }
});
export type Pack = z.infer<typeof PackSchema>;
