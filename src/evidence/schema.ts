import { z } from 'zod';

/** Free text that must have been written by a person, not copied from a template. */
const txt = (min = 2) => z.string().min(min).refine((s) => !/REPLACE|TODO|XXX/i.test(s), 'still contains template placeholder text');
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date as YYYY-MM-DD');
/** Participants are identified by a code, never by name, to keep personal data out of the repository. */
const code = (prefix: string) => z.string().regex(new RegExp(`^${prefix}-\\d{2,3}$`), `use a code like ${prefix}-01, never a name`);

export const OPERATOR_ROLES = ['digital_centre_operator', 'cyber_cafe_operator', 'document_helper'] as const;

export const Interview = z.object({
  id: code('IN'), date: day, interviewer: txt(),
  role: z.enum([...OPERATOR_ROLES, 'applicant', 'nrb', 'official', 'other']),
  consent_recorded: z.literal(true),
  rejection_reasons: z.array(txt(3)).min(1),
  knows_rules_beforehand: z.enum(['mostly', 'sometimes', 'rarely']),
  would_use_before_trip: z.boolean(),
  would_pay: z.enum(['yes', 'maybe', 'no']).optional(),
  price_hint: txt().optional(),
  rules_learned: z.array(z.object({ service: txt(), statement: txt(5), basis: z.enum(['seen_often', 'seen_once', 'heard']) })).default([]),
  original_notes_ref: txt(3),            // where the original notes or recording are kept
  notes: z.string().default(''),
});

export const UserTest = z.object({
  id: code('UT'), date: day, facilitator: txt(), build: txt(3),
  consent_recorded: z.literal(true),
  participant: z.object({
    age_band: z.enum(['18-24', '25-34', '35-49', '50+']), device: z.enum(['android', 'ios', 'other']),
    literacy_self: z.enum(['low', 'medium', 'high']), language_used: z.enum(['bn', 'en']), is_nrb: z.boolean(),
  }),
  used_own_documents: z.boolean(), documents_deleted_after: z.boolean(),
  result: z.object({
    verdict_shown: z.enum(['READY', 'ALMOST_READY', 'NOT_READY']),
    verdict_correct_per_facilitator: z.boolean().nullable(),   // null = could not be judged
    completed_without_help: z.boolean(), minutes: z.number().positive().max(120),
    understood_verdict: z.boolean(), understood_fix_steps: z.boolean().nullable(), would_use: z.boolean(),
  }),
  issues: z.array(txt(3)).default([]),
  original_notes_ref: txt(3),
}).refine((t) => !t.used_own_documents || t.documents_deleted_after, { message: 'own documents were used but not confirmed deleted afterwards' });

export const DeviceTest = z.object({
  date: day, tester: txt(), build: txt(3),
  device_model: txt(3), android_version: txt(1), browser: txt(),
  network: z.enum(['3g', '4g_slow', '4g', 'wifi']),
  check_time_seconds: z.number().positive().max(600),
  steps: z.object({
    consent_shown: z.boolean(), camera_capture_works: z.boolean(), upload_both_documents: z.boolean(), verdict_shown: z.boolean(),
    bangla_renders_correctly: z.boolean(), english_toggle_works: z.boolean(), delete_works: z.boolean(),
    no_sideways_scrolling: z.boolean(), readable_in_daylight: z.boolean(),
  }),
  notes: z.string().default(''),
});

export const Deployment = z.object({
  tool: z.literal('smoke-remote@1'), date: z.string(), url: z.string().url(), https: z.boolean(), demo: z.literal(false),
  packs: z.array(z.object({ id: z.string(), status: z.string() })),
  checks: z.array(z.object({ name: z.string(), ok: z.boolean(), detail: z.string().default('') })),
  all_passed: z.boolean(),
});

export const HostLogCheck = z.object({
  date: day, reviewer: txt(), host: txt(), log_window: txt(), requests_reviewed: z.number().int().min(20),
  personal_data_found: z.boolean(), original_notes_ref: txt(3), notes: z.string().default(''),
});

export const LegalReview = z.object({
  date: day, reviewer: txt(), organization: txt(), scope: z.array(txt(3)).min(1),
  outcome: z.enum(['approved', 'approved_with_conditions', 'rejected']),
  conditions: z.array(txt(3)).default([]), conditions_closed: z.boolean().default(false), document_ref: txt(3),
});
