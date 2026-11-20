import type { Pack } from './schema';

/** Cross-pack integrity: every fix_service must point at a pack that exists in the set. */
export function validatePackSet(packs: Pack[]): string[] {
  const ids = new Set(packs.map((p) => p.pack_id));
  const problems: string[] = [];
  for (const p of packs) for (const r of p.rules)
    if (r.fix_service && !ids.has(r.fix_service)) problems.push(`${p.pack_id}/${r.id}: fix_service "${r.fix_service}" does not exist`);
  return problems;
}
