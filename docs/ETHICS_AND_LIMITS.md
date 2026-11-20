# Ethics, privacy and limits

## Promises the code keeps (each is tested)
- No accounts, cookies or browser storage. Chat, document photos, plain-language text and the form coach are never stored. The form coach never sends anything.
- Personal numbers (NID, phone, passport, e-mail) are replaced before any text reaches a model, including text pasted into the plain-language reader and report descriptions.
- Photos are re-encoded in the browser (drops EXIF) and stripped again on the server. Report location is rounded to about 110 m, optional, and ignored outside Bangladesh.
- Public tracking by code shows only status, office, category, dates and supporter count. Never the description, location or photo.
- Aggregate dashboards hide groups smaller than 5. "Unmet demand" stores only a service id, never a question.
- Every claim shows its status: official, reported by operators, or not confirmed. Draft packs and the draft routing table say so on screen.
- The AI only suggests (report category) or summarises (plain language, answers). People confirm, and originals stay one tap away.

## Known risks and what we do about them
| Risk | Mitigation now | Still needed |
|---|---|---|
| Wrong answer or wrong plain rewrite | Citation and number checks, per-point source links, abstention, "not legal advice" notice | Meaning-preservation evaluation with a legal-language editor |
| Rules change | Source, date, expiry warnings, no VERIFIED without a named person | A verifier and a source-change monitor |
| Bias in name matching | Strict matching only warns | Fairness test across naming traditions |
| Faces or number plates in report photos | On-screen warning | Automatic blurring |
| False or abusive reports, "me too" gaming | Rate limits, duplicate detection, supporters labelled as unverified | Moderation workflow, per-person limits |
| Report photos are personal data in public places | Opt-in in production, token-protected, auto-deletion (14 days after closing, 180 days maximum) | Legal and privacy review, host log review |
| Over-trust | Pilot and "pre-check" wording everywhere, honest NO-GO status | User tests |
| Exclusion of people who cannot read well | Voice typing, read-aloud, larger text, photo input | Testing with those users |

## What this is not
Not a government service, an approval, legal advice, or an integration with any government system. Reports are recorded in KagojReady's own agency console and CSV export. Nothing is sent to a city corporation or utility automatically.
