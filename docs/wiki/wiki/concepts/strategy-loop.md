---
type: concept
tags: [architecture, core]
summary: "The re-plan-on-every-event loop that makes it a practitioner, not a drafting tool."
sources: ["[[2026-10-23-founder-brainstorm]]"]
updated: 2026-10-24
---
# Strategy loop

Runs on every event: new order, opposing filing, hearing, approaching deadline (or, in [[advisory-mode]], a rejection, resubmission request or due date).

1. **Ingest** — read the order/filing (incl. scanned, handwritten, Hindi) → [[fact-finder]].
2. **Update state** — stage, deadlines, facts in [[case-memory]]; dates from [[rule-engines]].
3. **Re-assess** — strength, risks, leverage, what changed; re-check viability ([[case-evaluator]]) and the [[theory-of-the-case]].
4. **Generate options** — from playbooks and the [[tactics-library]] ([[strategist]], [[courtroom-tactician]]).
5. **Red-team** — [[opposition-analyst]] attacks each option.
6. **Recommend** — best move + reasons + citations + confidence + fallback, checked by the [[verification-layer]], scored by the [[scoring-objective]].
7. **User decides → act** — [[drafter]], [[filing-agent]], reminders.
8. **Track outcome** → [[learning-loop]].

Example: "They missed the 45-day deadline for their reply — apply today to close their right to file it." (see [[consumer-commissions]])

