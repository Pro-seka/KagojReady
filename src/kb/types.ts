export type CardStatus = 'official' | 'operator_reported' | 'unconfirmed' | 'product';
export interface Source { label: string; url: string; retrieved: string }
export interface Card {
  id: string; service: string | null; kind: 'overview' | 'rule' | 'guidance' | 'note' | 'ingested';
  title_en: string; title_bn: string; text_en: string; text_bn: string;
  source: Source | null; status: CardStatus; tags: string[];
}
