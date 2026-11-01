---
type: architecture
tags: [architecture]
summary: "The nine-layer architecture at a glance."
sources: ["[[legal-copilot-spec-v0.5]]"]
updated: 2026-10-24
---
# Architecture overview

1. **Channels** — WhatsApp, app/web, voice in Indian languages, discreet mode ([[tools-and-integrations]]).
2. **User-safety gate** — danger → emergency route; [[hard-lines]] only.
3. **[[case-brain]]** — orchestrator + [[strategy-loop]] + specialist agents ([[agents-index]]).
4. **[[case-memory]]** — structured case / company record.
5. **[[knowledge-layer]]** — statutes, case law, procedure packs, playbooks, [[tactics-library]], court patterns, company-law corpus.
6. **[[rule-engines]]** — deterministic deadlines, jurisdiction, fees, compliance calendar, penalties.
7. **[[verification-layer]]** — citation check, procedure check, red-team critic, confidence/abstain.
8. **[[tools-and-integrations]]** — eCourts, e-Daakhil, MCA21, portals, OCR, reminders.
9. **Human layer + [[learning-loop]]** — lawyer/CS review, outcomes → playbooks.

Principle: LLM for reasoning, code for rules, structured memory for state. Stack: [[tech-stack]]. Decision: [[adr-004-procedure-first-architecture]].

