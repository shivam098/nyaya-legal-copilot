---
type: concept
tags: [procedure, tactics, speed]
summary: "Surviving registry defect scrutiny and beating summons/notice evasion via India Post tracking, MCA21 lookup, and deemed/dasti/substituted service."
sources: ["[[legal-copilot-spec-v0.5]]"]
updated: 2026-10-24
---
# Registry & summons service mechanics ("ground logistics")

Spec: FR-7.2 & FR-7.3. Handled by [[procedure-clerk]] and [[filing-agent]].

## 1. Surviving registry scrutiny
- **Filing packet checklist:** pagination, index, synopsis/list of dates, memo of parties, verification clauses, physical sets, court fees, and e-stamping/notarization rules per forum ([[forums-map]]).
- **Defect curing:** reads the registry scrutiny sheet (via [[tools-and-integrations|OCR pipeline]]), explains each objection in plain words, drafts the compliance reply, and tracks the refiling deadline.
- **Day-of courtroom logistics:** cause-list check, court room/VC link lookup, pass-over vs adjournment, and getting appearance recorded on the order sheet.

## 2. Beating summons & notice evasion
A primary cause of 6–12 month delays in Indian courts is the respondent evading service:
- Tracks RPAD / Speed Post, courier, bailiff, and permitted email/WhatsApp service; prepares the **Affidavit of Service**.
- **Anti-evasion moves:** when postal remarks show *"refused"* or *"unclaimed"*, moves to treat it as **deemed service**; when *"door locked / left"*, moves immediately for **dasti service**, email/WhatsApp service, or **substituted service** (Order V Rule 20 CPC).
- Pulls corporate registered office and signatory email from [[mca21]] Master Data so companies cannot claim wrong address.