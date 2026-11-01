---
type: agent
tags: [agents, handoff]
summary: "Compares eCourts order sheets with the user's lawyer's updates, audits lawyer drafts, and prepares 3 sharp questions before calls."
sources: ["[[legal-copilot-spec-v0.5]]"]
updated: 2026-10-24
---
# Lawyer auditor agent

Runs FR-13.2 ([[lawyer-audit-and-copilot-mode]]) for [[persona-litigant-with-lawyer]], working with [[handoff-agent]].
- Compares actual [[ecourts]] / [[e-daakhil|e-Daakhil / e-Jagriti]] daily orders against what the advocate told the client.
- Reviews drafts before signing and prepares 3 specific practitioner questions before every lawyer interaction.