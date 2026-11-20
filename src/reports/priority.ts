import type { Category, Ticket } from './types';

/**
 * A transparent score so an office can sort a long list. It is a heuristic, not a measure of need:
 * the category's base level, plus 3 for a safety hazard, plus up to 3 for people who said "me too", plus up to 2 for age.
 */
export function priorityScore(t: Pick<Ticket, 'supporters' | 'createdAt' | 'status'>, cat: Category | undefined, now = Date.now()): number {
  if (t.status === 'resolved' || t.status === 'rejected') return 0;
  const ageDays = Math.max(0, (now - Date.parse(t.createdAt)) / 86_400_000);
  const v = (cat?.base_priority ?? 1) + (cat?.safety ? 3 : 0) + Math.min(3, t.supporters * 0.3) + Math.min(2, ageDays * 0.1);
  return Math.round(v * 10) / 10;
}
