---
type: concept
tags: [judgement, strategy]
summary: "Honest go / no-go / settle advice after hearing everything."
sources: ["[[2026-10-24-what-makes-a-good-lawyer]]", "[[legal-copilot-spec-v0.5]]"]
updated: 2026-10-24
---
# Case viability assessment

Spec: FR-17. Run by the [[case-evaluator]] at intake and at key stages.

## Weighs
- Strength on facts and evidence ([[theory-of-the-case]]); fillable vs unfillable gaps.
- Realistic recovery vs claim; can the other side actually pay (enforceability)?
- Time, cost, effort, emotional toll.
- Risks: counter-claims, cost orders, defamation exposure, relationships, privacy.
- Limitation and other bars ([[rule-engines]]).

## Outputs
- **Pursue** — fastest strong route ([[strategist]]).
- **Don't pursue** — plain reasons, and what would change the view.
- **Settle / resolve out of court** — [[out-of-court-resolution]].
- **Hybrid** — file for leverage, settle at peak leverage.

The user decides; the advice stays honest even when unwelcome ([[core-principle]], [[adr-007-best-outcome-not-just-litigation]]).

