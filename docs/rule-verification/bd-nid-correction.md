# Rule verification sheet: bd-nid-correction v0.1.0

Status now: **DRAFT_UNVERIFIED**. This sheet is for the named person who checks these rules. Nothing here is verified until you sign below.

## How to check
1. Open each source below on the **official domestic** page for this service. Save a dated copy (PDF or screenshot) in a folder the team can reach.
2. For every rule, decide one of: **official** (an official page says it), **operator_reported** (several operators confirm it, with interview notes), or **remove** (you cannot confirm it).
3. Edit `rule_status` (or delete the rule) in `packs/bd-nid-correction.json`. A VERIFIED pack cannot contain `unconfirmed` rules. A rule marked official needs a source.
4. Run: `npm run promote-pack -- --pack bd-nid-correction --by "Your Full Name" --evidence <link to the saved pages>`

## Sources
1. The Business Standard: NID corrections (press report, not an official page): https://www.tbsnews.net/features/panorama/never-ending-nightmare-nid-corrections-bangladesh-1099006 (retrieved 2026-10-20)
2. Dhaka Tribune: NID correction categories (press report on the 2023 EC notification): https://www.dhakatribune.com/bangladesh/385651/nearly-350-000-nids-pending-correction (retrieved 2026-10-20)
3. UNB: Smart NID correction, necessary documents (press report): https://unb.com.bd/news/tag/61715 (retrieved 2026-10-20)

Note: sources written for applicants abroad (mission pages) may differ from domestic practice. Confirm each rule against the domestic process.

## Documents the app reads
- National ID card: name, father_name, mother_name, dob, nid_number
- Birth registration certificate: name, father_name, mother_name, dob

## Rules
| Rule | Severity | Status now | What it checks | What the user sees | Source | Your decision | Notes |
|---|---|---|---|---|---|---|---|
| NC-001 | warning | unconfirmed | birth_cert must be provided | Birth registration certificate not found. | [3] | | |
| NC-002 | warning | unconfirmed | nid must be provided | National ID card not found. | none | | |
| NC-010 | warning | unconfirmed | birth_cert.dob must be present | The date of birth on the birth certificate could not be read. | none | | |
| NC-011 | warning | unconfirmed | birth_cert.name must be present | The name on the birth certificate could not be read. | none | | |
| NC-020 | warning | unconfirmed | nid.nid_number matches ^([0-9]{10}|[0-9]{13}|[0-9]{17})$ | The NID number does not look complete. | none | | |

## Sign-off
- Verified by (full name):
- Role and organisation:
- Date:
- Where the saved official pages are kept (link):
- Anything the app cannot check yet that you noticed:
