---
type: concept
tags: [procedure, strategy, judgement]
summary: "Onboarding a user at any stage of a case—from an unsubstantiated pre-filing refund demand to a mid-case OP-evidence stall or post-order execution."
sources: ["[[legal-copilot-spec-v0.5]]"]
updated: 2026-11-02
---
# Any-stage intake & mid-stream onboarding

Spec: FR-1 (1.1–1.3). Handled by [[fact-finder]], [[procedure-clerk]], [[case-evaluator]], and [[courtroom-tactician]].

Users do **not** only enter on Day 1. The agent locates the user on the forum's state machine ([[consumer-commissions]]) and acts immediately on their exact stage:

## 1. Pre-filing / weak-claim entry (Pre-Filing Deficiency Gate)
- **Scenario:** A user says *"I want a refund, file a consumer case right now,"* or a business/service provider says *"A client is demanding an unjustified refund from us, here is our raw WhatsApp chat."*
- **Zero-effort "Messy Evidence Dump":** The user does not need formal legal papers or labelled files. They can drop unlabelled WhatsApp chat exports, screenshots, voice notes, and invoices; [[fact-finder]] auto-sorts them into a dated timeline and links them to legal elements.
- **How the agent acts (Complainant side):** Under [[consumer-protection-act-2019]], merely wanting a refund is not enough—there must be a statutory **defect** (s.2(10)), **deficiency in service** (s.2(11)), **unfair trade practice** (s.2(47)), or breach of return/warranty terms. The [[case-evaluator]] stops premature filing (which would be dismissed at admission under s.36) and either cures the proof gap or recommends [[out-of-court-resolution]].
- **How the agent acts (Respondent / Service-Provider side):** Extracts approvals, delivery records, causes of delay, alleged missing work and refund/cancellation terms. It explains which facts support or weaken the defence and can draft a proportionate reply. Client approval or a no-refund clause alone is not proof that no service failure occurred.

## 2. Mid-case entry (e.g., OP Evidence Stage Stall)
- **Scenario (Founder's active case):** Complaint, Opposite Party Written Version, Rejoinder, and Complainant's Evidence Affidavit are already filed. The case is at the **OP Evidence** stage, and the Opposite Party has not filed its Evidence Affidavit.
- **How the agent acts:**
  1. Reconstructs the case state from existing filings and daily orders ([[case-memory]]).
  2. Drops directly into the `op-evidence` stage.
  3. Triggers `tactic-close-op-evidence-on-default` + [[hearing-date-compression]]: prepares the oral submission and application to **close OP's right to file evidence** (or get a 'Last and Final Opportunity with costs' order) and post the case directly for Final Arguments.

## 3. Late-stage / post-order entry
- Entering right before Final Arguments → [[hearing-coach]] + Written Arguments drafter.
- Entering after a final order that the company ignores → [[decree-execution-and-recovery]] (CPA ss.71–72).

## Web MVP: explain a case by voice
- Idle voice controls stay compact: explanatory copy and the checkbox are hidden from the form. Consent is requested on the first Start action per page load; cancelling never opens the microphone. Relevant listening/status, transcript and error feedback remains visible.
- The current web UI offers live browser speech-to-text for all three entry doors and follow-up questions. Choose English, Hindi or Hinglish (Hindi + English), agree to browser speech processing, then use **Start voice input** / **Stop voice input**. Dictation appends to the editable text; it never replaces typed notes or submits automatically.
- Interim and final Hindi text is transliterated into **English/Roman letters**, not translated into English. Romanization runs locally as recognition events arrive; English words and identifiers stay intact. Hinglish uses Hindi recognition (`hi-IN`) with mixed-language accuracy dependent on the browser/service, not a separate guaranteed Hinglish API. Spellings are phonetic and editable.
- Review names, dates, amounts and facts before submitting. Interim words are visible while transcribing; unconfirmed words still present when capture ends are retained with a review warning. Starting again appends more text. Capture stops when the page is hidden or the user changes case/screen.
- HTTPS/localhost, microphone permission and a working browser speech service are required. Support varies across Chrome/Safari variants, devices and languages; unsupported browsers or speech-service failures show guidance, while typing and keyboard dictation remain available.
- This is not a voice-note recorder/upload service: Nyaya stores no audio file and supplies no audio to the selected LLM. The browser may process audio through an external speech provider; no on-device-only or residency guarantee is made. Only submitted text enters the existing [[case-memory]] flow. See [[privacy-dpdp]] for the broader privacy goals, not a claim that browser speech processing meets them.
- Automated tests simulate recognition events and exercise real local Romanization. Real English/Hindi/Hinglish microphone recognition and accuracy still require testing on the intended device/browser.

## Web entry and mobile layout
- A single **Get started** CTA reveals the three entry doors; they are not shown on the initial welcome screen. Back returns to the welcome screen, while **My cases** keeps saved sessions accessible.
- The top bar includes a **☰ Menu** (Hamburger Menu) alongside **Settings** and **My cases**, giving new users a visual 3-step tour and interactive **Sample Input → Sample Output** tabs for all 3 doors with 1-click sample loading.
- Model selection and usage sit under **Settings**, and completed answers include a multi-model **Review in more depth** selector (`Claude Opus 5.5`, `Gemini 4 Argon`, `Claude Sonnet 5.5`, `Claude Opus 4.6`, `GPT-4.1`). Mobile forms use stacked choices, readable input text, full-width primary buttons and larger touch targets. Optional folder import stays collapsed until needed, and wide advice tables scroll inside the response rather than widening the page.

## Context before legal detail
- Canonical spec FR-1.4 applies to every initial analysis and follow-up, including [[company-law-and-compliance]]: explain what the situation means first, then a small set of immediate actions. Explain a necessary legal term at first use and distinguish later obligations.
- **Lowest-headache step first:** Direct users to practical, zero-fee escalation levers before court or formal legal notices — e.g., written job sheet + brand Customer Relations + National Consumer Helpline (NCH 1915) for warranty/repair denials, RBI Integrated Ombudsman / 1930 for bank/UPI issues, Insurance Ombudsman / Bima Bharosa for insurance rejections, AirSewa / TCCMS for flights/telecom, and SAMADHAN / MSME Samadhaan for unpaid dues. Never suggest an RTI request against a private business.
- Separate facts, allegations and unknowns. Make advice conditional where facts are missing; ask only the questions that change the next step. Use the user's language, including simple Roman-letter Hinglish when requested. A short clarification does not need the full intake template.
- Preserve requested drafts, checklists, scripts and expert depth, with placeholders and relevant verification cautions. Full hearing plans keep their five existing sections, but the text must not certify missing orders or unfinished drafts. Do not invent citations, current-law verification, legal fee math or guaranteed outcomes.
- Simple orientation answers aim for roughly 150-250 words without duplicate action lists or unsolicited full notices; requested detailed artifacts are not capped by this target. Unverified numerical legal thresholds, fees or eligibility rules must not be quoted from memory with a "verify" disclaimer.
- Both analysis APIs use the shared `response-guidance.mjs` policy. Technical progress details remain accessible but collapsed; visible controls use ordinary descriptions instead of database/model-pipeline jargon.
- Provider length limits, filters or absent completion signals produce a persistent incomplete-answer warning and no response-cache entry. Incomplete extracted summaries are rejected rather than saved as complete case records. An interrupted browser stream shows an error.
- Nine synthetic response scenarios carry real-output review rubrics. Automated tests cover shared prompts, endpoint contracts, saved warnings and completion handling; passing them does not establish legal accuracy or guarantee that a model follows every instruction.
