---
type: agent
tags: [agents, enforcement]
summary: "Enforces final orders via CPA ss.71-72 warrants/recovery certificates, Order XXI attachment, and appeal pre-deposit rules."
sources: ["[[legal-copilot-spec-v0.5]]"]
updated: 2026-10-24
---
# Execution & recovery agent

Runs FR-14 ([[decree-execution-and-recovery]]) after a favourable order or settlement default.
- Tracks compliance deadlines, sends demand notices, and prepares CPA ss.71–72 execution/penal applications or CPC Order XXI petitions.
- Pulls opponent asset/director identifiers from invoices, banking trails, and [[mca21]].