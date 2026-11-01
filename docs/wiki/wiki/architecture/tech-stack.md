---
type: architecture
tags: [architecture, stack]
summary: "Proposed implementation stack and model choices."
sources: ["[[2026-10-23-founder-brainstorm]]"]
updated: 2026-10-24
---
# Tech stack

- Python + FastAPI; LangGraph for agents and the [[strategy-loop]].
- Postgres for [[case-memory]]; pgvector for legal text.
- Object store for evidence (encrypted — [[privacy-dpdp]]).
- Temporal for deadlines and long-running workflows.
- Playwright for portal automation ([[tools-and-integrations]]).
- Models: frontier reasoning model for [[strategist]] / critic / [[courtroom-tactician]]; small models for extraction; Bhashini/Sarvam for Indic speech.

