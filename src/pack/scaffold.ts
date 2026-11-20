/** A valid DRAFT pack with placeholders, so adding a service or a country is editing data, not writing code. */
export function scaffoldPack(o: { id: string; nameEn: string; nameBn: string; country: string; order?: number }) {
  return {
    pack_id: o.id, version: '0.1.0', country: o.country.toUpperCase(), status: 'DRAFT_UNVERIFIED' as const, display_order: o.order ?? 100,
    service: { id: o.id.replace(/-/g, '_'), name_en: o.nameEn, name_bn: o.nameBn },
    last_verified: null, review_by: null, verified_by: null, evidence_url: null, sources: [],
    applicant_types: ['adult'],
    documents: [{ id: 'main_document', name_en: 'TODO: first document', name_bn: 'TODO: প্রথম কাগজ', fields: ['name', 'dob'], photo_tip_en: 'Photograph the page flat, with no glare.', photo_tip_bn: 'পাতাটি সমতলে রেখে ছবি তুলুন, আলোর ঝলক এড়িয়ে চলুন।' }],
    rules: [{
      id: 'XX-001', type: 'required_document', severity: 'warning', rule_status: 'unconfirmed', doc: 'main_document',
      message_en: 'TODO: what the user sees when this document is missing', message_bn: 'TODO: কাগজটি না থাকলে ব্যবহারকারী যা দেখবেন',
      fix_en: ['TODO: what to do'], fix_bn: ['TODO: কী করতে হবে'], notes: 'Replace every TODO. Add sources, then more rules. See docs/ADD_A_SERVICE.md.',
    }],
  };
}
