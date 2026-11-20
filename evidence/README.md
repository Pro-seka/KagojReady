# Evidence

The readiness gates read these files. A gate passes only when valid evidence exists. Nothing here is verified by the software. **These files are only worth anything if they are true**, so keep the originals (notes, recordings, screenshots, signed forms) and point to them in `original_notes_ref` / `document_ref`.

| Folder or file | Gate it feeds | Needed |
|---|---|---|
| `interviews/*.json` | Interviews | 2 or more, at least 1 with an operator |
| `user-tests/*.json` | User tests and NRB tester | 10 or more; 70% finish unaided and 70% understand the verdict; at least 1 with `is_nrb: true`; no READY verdict the facilitator judged wrong |
| `device-tests/*.json` | Real phone | 1 or more, all steps true, one on a slow network within 45 seconds |
| `deployment.json` | Deployment | Written by `npm run smoke -- https://your-host`. Not by hand. Under 30 days old |
| `host-log-check.json` | Host logs | 20+ requests reviewed, no personal data found |
| `legal-review.json` | Legal review | Approved, or approved with all conditions closed |

## Rules for everyone
- **Never write a person's name, phone number, NID number or address** in these files. Use the codes (`IN-01`, `UT-01`).
- Get consent before interviewing or testing. Set `consent_recorded` to true only if you did.
- If a participant used their own documents, confirm they were deleted afterwards.
- Copy a file from `templates/`, replace every `REPLACE ME`, and save it in the right folder. Files that still contain placeholder text are rejected.
- Run `npm run readiness` to see which gates your files satisfy.
