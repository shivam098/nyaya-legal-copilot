---
type: decision
tags: [decision]
summary: "Model top-lawyer skills; advise against weak cases; suggest settlement."
sources: ["[[2026-10-23-founder-brainstorm]]"]
updated: 2026-10-24
---
# ADR-007: Best outcome, not just litigation
**Context:** founder's lawyer friend on what separates top lawyers ([[2026-10-24-what-makes-a-good-lawyer]]); founder asked that the agent also say when a case isn't worth pursuing and suggest out-of-court settlement after hearing everything.
**Decision:** model the [[practitioner-competency-model]] explicitly; add [[case-evaluator]] for honest go / no-go / settle advice; expand the [[settlement-advisor]] to cover [[out-of-court-resolution]].
**Links:** [[core-principle]], [[case-viability-assessment]].

