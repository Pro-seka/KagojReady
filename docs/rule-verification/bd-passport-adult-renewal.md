# Rule verification sheet: bd-passport-adult-renewal v0.1.0

Status now: **DRAFT_UNVERIFIED**. This sheet is for the named person who checks these rules. Nothing here is verified until you sign below.

## How to check
1. Open each source below on the **official domestic** page for this service. Save a dated copy (PDF or screenshot) in a folder the team can reach.
2. For every rule, decide one of: **official** (an official page says it), **operator_reported** (several operators confirm it, with interview notes), or **remove** (you cannot confirm it).
3. Edit `rule_status` (or delete the rule) in `packs/bd-passport-adult-renewal.json`. A VERIFIED pack cannot contain `unconfirmed` rules. A rule marked official needs a source.
4. Run: `npm run promote-pack -- --pack bd-passport-adult-renewal --by "Your Full Name" --evidence <link to the saved pages>`

## Sources
1. Bangladesh High Commission London: e-passport application (mission page, UK applicants): https://bhclondon.org.uk/e-passport-application (retrieved 2026-10-20)
2. Bangladesh Mission Birmingham (mofa.gov.bd): E-Passport (mission page, UK applicants): https://birmingham.mofa.gov.bd/pages/static-pages/695266aa35ce18e1c05aaa75 (retrieved 2026-10-20)
3. Bangladesh Mission Chennai (mofa.gov.bd): General instructions for e-passport (mission page, applicants in India): https://chennai.mofa.gov.bd/pages/static-pages/695266b135ce18e1c05aacfc (retrieved 2026-10-20)

Note: sources written for applicants abroad (mission pages) may differ from domestic practice. Confirm each rule against the domestic process.

## Documents the app reads
- Existing passport: name, dob, passport_number, expiry_date
- National ID card: name, father_name, mother_name, dob, nid_number

## Rules
| Rule | Severity | Status now | What it checks | What the user sees | Source | Your decision | Notes |
|---|---|---|---|---|---|---|---|
| RN-001 | blocker | official | old_passport must be provided | Your existing passport was not found. | [2] | | |
| RN-002 | warning | official | nid must be provided | National ID card not found. If you have no NID, a birth registration certificate may be used instead, but this check does not look at it yet. | [2] | | |
| RN-010 | blocker | official | dob on nid + old_passport must match (exact) | Date of birth is different on your NID and your existing passport. | [2] | | |
| RN-011 | warning | unconfirmed | name on nid + old_passport must match (exact) | Your name is written differently on your NID and your existing passport. It may not be accepted. | [2] | | |
| RN-012 | warning | unconfirmed | old_passport.passport_number must be present | The passport number could not be read. | none | | |
| RN-020 | warning | unconfirmed | nid.nid_number matches ^([0-9]{10}|[0-9]{13}|[0-9]{17})$ | The NID number does not look complete. | none | | |
| RN-030 | warning | official | nid.dob: min_age 18 | You may be under 18, which uses a different application path. | [3] | | |

## Sign-off
- Verified by (full name):
- Role and organisation:
- Date:
- Where the saved official pages are kept (link):
- Anything the app cannot check yet that you noticed:
