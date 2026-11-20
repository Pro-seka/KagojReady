export type TicketStatus = 'received' | 'in_review' | 'forwarded' | 'resolved' | 'rejected';
export const STATUSES: TicketStatus[] = ['received', 'in_review', 'forwarded', 'resolved', 'rejected'];
export interface Category { id: string; name_en: string; name_bn: string; safety: boolean; base_priority: number }
export interface AreaType { id: string; name_en: string; name_bn: string }
export interface Route { body_en: string; body_bn: string }
export interface Ticket {
  id: string;                       // public tracking code, for example KR-7F3K-9Q2M. Unguessable, so it doubles as the reporter's key.
  category: string; areaType: string; body: Route;
  description: string;              // personal numbers already removed
  lat: number | null; lng: number | null;   // rounded to about 110 m. null when the person did not share a location
  createdAt: string; updatedAt: string; status: TicketStatus; note: string;
  supporters: number;               // people who said "me too". Not de-duplicated per person (there are no accounts).
  photo: string | null;             // file name in the photo folder, or null when none was kept or it was purged
  suggested: { category: string | null; confidence: number | null; by: 'ai' | 'person' };
  lang: 'bn' | 'en';
}
export interface PublicTicket { id: string; category: string; body: Route; status: TicketStatus; note: string; createdAt: string; updatedAt: string; supporters: number }
