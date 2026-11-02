---
type: log
---
# Log (append-only)

## [2026-10-24] ingest | Initial build
- Ingested [[2026-10-23-founder-brainstorm]], [[2026-10-24-practitioner-tip-hearing-dates]], [[2026-10-24-what-makes-a-good-lawyer]], [[2026-10-23-existing-products-search]], [[legal-copilot-spec-v0.5]].
- Created 90 wiki pages: overview, concepts, architecture, agents, forums, statutes/portals, personas, market, decisions, roadmap, open questions.
- Added [[advisory-mode]] and [[company-law-and-compliance]] (spec FR-15).
- Added [[practitioner-competency-model]], [[theory-of-the-case]], [[case-viability-assessment]], [[out-of-court-resolution]], [[case-evaluator]] (spec FR-16, FR-17).
- Flag: statutory citations need lawyer verification ([[open-questions]]).

## [2026-10-24] ingest | v0.5 gaps & real-world execution
- Updated spec to [[legal-copilot-spec-v0.5]] and added 9 wiki pages covering:
  - [[day-zero-evidence-and-pre-litigation]] and [[pre-litigation-and-evidence-agent]] (FR-0: 48-hour CCTV/digital preservation, BSA s.63 certificates, ombudsman/chargeback fast tracks).
  - [[registry-and-summons-mechanics]] (FR-7.2/7.3: curing registry scrutiny defects, India Post + MCA21 summons tracking, deemed/dasti/substituted service).
  - [[decree-execution-and-recovery]] and [[execution-and-recovery-agent]] (FR-14: CPA ss.71–72 warrants/recovery certificates, Order XXI attachment).
  - [[lawyer-audit-and-copilot-mode]] and [[lawyer-auditor]] (FR-13.2: eCourts order-sheet truth checks, draft review, 3 sharp questions).
  - [[cold-start-and-forum-readiness]] and [[adr-008-depth-first-forum-readiness]] (FR-18: Tier 1–3 depth-first quality gates).

## [2026-11-02] implementation | Opt-in web voice intake
- Updated [[any-stage-onboarding]] and canonical spec FR-1.2 with browser dictation for all intake doors and follow-ups, explicit processing consent, English/Hindi/Hinglish selection, live English-letter transliteration, editable text and no automatic submission.
- Documented browser/service limitations, no Nyaya audio recording/storage, retained unconfirmed text, and real-device microphone verification still required.

## [2026-11-02] implementation | Progressive mobile entry
- Simplified the welcome page to a Get started CTA that reveals the three doors; retained saved cases and grouped model/usage controls under Settings.
- Updated [[any-stage-onboarding]] and canonical spec FR-19 for mobile touch targets, readable forms, stacked actions and optional folder import.

## [2026-11-02] implementation | Context-first legal guidance
- Added a shared plain-language response policy for every door and follow-up; updated [[any-stage-onboarding]], [[company-law-and-compliance]] and canonical spec FR-1.4/FR-15.1.
- Added low-headache pre-litigation escalation rules (written job sheet + brand escalation + National Consumer Helpline NCH 1915, RBI Ombudsman, Insurance Ombudsman, AirSewa, SAMADHAN/MSME Samadhaan; no private-company RTI requests), Hamburger Menu (`☰ Menu`) with interactive 3-door Sample Input/Output demos, and multi-model escalation (`Claude Opus 5.5`, `Gemini 4 Argon`, `Claude Sonnet 5.5`, `Claude Opus 4.6`, `GPT-4.1`).
- Documented conditional recommendations, term explanations, immediate versus later actions, preserved drafts/depth and current-law verification limits.
- Added synthetic response rubrics, prompt/API regression coverage and persistent incomplete-answer warnings; incomplete answers are not cached and partial document summaries are not saved as complete records.
