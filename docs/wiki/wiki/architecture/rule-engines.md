---
type: architecture
tags: [architecture, deterministic]
summary: "Deterministic code for every date, fee and penalty — never the LLM."
sources: ["[[2026-10-23-founder-brainstorm]]"]
updated: 2026-10-24
---
# Rule engines

Deterministic, versioned, tested code. The LLM never computes these:
- Limitation periods.
- Jurisdiction (pecuniary, territorial, subject).
- Court fees.
- Deadline calendar with court holidays.
- Statutory disposal targets and case-age checks (used by [[hearing-date-compression]]).
- **Compliance calendar** and **late-fee / penalty calculator** for [[advisory-mode]].

All values verified by a lawyer or CS/CA reviewer before release.

