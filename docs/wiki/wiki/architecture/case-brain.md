---
type: architecture
tags: [architecture, orchestration]
summary: "Orchestrator that runs the strategy loop and routes to agents."
sources: ["[[2026-10-23-founder-brainstorm]]"]
updated: 2026-10-24
---
# Case brain

- A stateful orchestrator (not a free-form chatbot): code decides state transitions; LLM agents do reasoning inside each state.
- Runs the [[strategy-loop]] for [[dispute-mode]] and the compliance loop for [[advisory-mode]].
- Routes work to specialist agents — [[agents-index]].
- Reads/writes [[case-memory]]; calls [[rule-engines]] for anything numeric or date-based; everything passes the [[verification-layer]].

