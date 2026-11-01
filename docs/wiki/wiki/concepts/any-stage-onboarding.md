---
type: concept
tags: [procedure, strategy, judgement]
summary: "Onboarding a user at any stage of a case—from an unsubstantiated pre-filing refund demand to a mid-case OP-evidence stall or post-order execution."
sources: ["[[legal-copilot-spec-v0.5]]"]
updated: 2026-10-24
---
# Any-stage intake & mid-stream onboarding

Spec: FR-1 (1.1–1.3). Handled by [[fact-finder]], [[procedure-clerk]], [[case-evaluator]], and [[courtroom-tactician]].

Users do **not** only enter on Day 1. The agent locates the user on the forum's state machine ([[consumer-commissions]]) and acts immediately on their exact stage:

## 1. Pre-filing / weak-claim entry (Pre-Filing Deficiency Gate)
- **Scenario:** A user says *"I want a refund, file a consumer case right now,"* or a business/service provider says *"A client is demanding an unjustified refund from us, here is our raw WhatsApp chat."*
- **Zero-effort "Messy Evidence Dump":** The user does not need formal legal papers or labelled files. They can drop unlabelled WhatsApp chat exports, screenshots, voice notes, and invoices; [[fact-finder]] auto-sorts them into a dated timeline and links them to legal elements.
- **How the agent acts (Complainant side):** Under [[consumer-protection-act-2019]], merely wanting a refund is not enough—there must be a statutory **defect** (s.2(10)), **deficiency in service** (s.2(11)), **unfair trade practice** (s.2(47)), or breach of return/warranty terms. The [[case-evaluator]] stops premature filing (which would be dismissed at admission under s.36) and either cures the proof gap or recommends [[out-of-court-resolution]].
- **How the agent acts (Respondent / Service-Provider side):** Extracts client approvals, delivery proofs, client-side delays, and refund/cancellation terms from the raw WhatsApp chat, and drafts a strong pre-litigation reply or Written Version demonstrating no deficiency under CPA s.2(11).

## 2. Mid-case entry (e.g., OP Evidence Stage Stall)
- **Scenario (Founder's active case):** Complaint, Opposite Party Written Version, Rejoinder, and Complainant's Evidence Affidavit are already filed. The case is at the **OP Evidence** stage, and the Opposite Party has not filed its Evidence Affidavit.
- **How the agent acts:**
  1. Reconstructs the case state from existing filings and daily orders ([[case-memory]]).
  2. Drops directly into the `op-evidence` stage.
  3. Triggers `tactic-close-op-evidence-on-default` + [[hearing-date-compression]]: prepares the oral submission and application to **close OP's right to file evidence** (or get a 'Last and Final Opportunity with costs' order) and post the case directly for Final Arguments.

## 3. Late-stage / post-order entry
- Entering right before Final Arguments → [[hearing-coach]] + Written Arguments drafter.
- Entering after a final order that the company ignores → [[decree-execution-and-recovery]] (CPA ss.71–72).
