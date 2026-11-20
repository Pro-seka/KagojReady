import { PackSchema, type Pack } from './schema';

export interface PromoteInput { by: string; evidenceUrl: string; today: string; days?: number }

/** Turns a draft into a VERIFIED pack only if the schema's "verified" rules hold. Throws with every reason otherwise. */
export function promotePack(pack: Pack, i: PromoteInput): Pack {
  const next = new Date(`${i.today}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + (i.days ?? 90));
  const candidate = { ...pack, status: 'VERIFIED' as const, last_verified: i.today, review_by: next.toISOString().slice(0, 10), verified_by: i.by, evidence_url: i.evidenceUrl };
  const r = PackSchema.safeParse(candidate);
  if (!r.success) throw new Error(r.error.issues.map((x) => x.message).join('\n'));
  return r.data;
}
