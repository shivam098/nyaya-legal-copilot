---
type: concept
tags: [handoff, accountability]
summary: "Checking a human lawyer's work: eCourts order-sheet truth checks, draft audits, and 3 sharp questions before every lawyer call."
sources: ["[[legal-copilot-spec-v0.5]]"]
updated: 2026-10-24
---
# Lawyer Audit & Co-Pilot Mode

Spec: FR-13. Handled by [[lawyer-auditor]] and [[handoff-agent]] for [[persona-litigant-with-lawyer]].

When a user hires an advocate or receives legal aid ([[nalsa-dlsa]]), the product acts as their watchdog and briefing co-pilot:
- **Order-sheet truth check:** pulls the actual [[ecourts]] / [[e-daakhil|e-Daakhil / e-Jagriti]] daily order after every hearing and compares it with what the lawyer told the client—catching silent adjournments, missed appearances, or unfiled replies.
- **Draft & vakalatnama review:** audits lawyer-drafted petitions/replies before signature for missing prayers, interest heads, or weak framing ([[theory-of-the-case]]).
- **3 sharp questions:** prepares 3 specific, respectful practitioner-level questions before every call with the advocate.