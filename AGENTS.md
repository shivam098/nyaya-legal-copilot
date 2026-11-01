# AGENTS.md — AI Development Guide (`legal-copilot`)

This repository uses a **Spec- & Eval-Driven Architecture** combining an Obsidian LLM Wiki with executable domain packs, deterministic rule engines, and practitioner evaluations.

## 1. Repository Layout
- `docs/legal-copilot-spec.md` — Canonical product specification (v0.5).
- `docs/wiki/` — **Karpathy-style Obsidian Vault** (`raw/`, `wiki/`, `.obsidian/`, `AGENTS.md`). Open `docs/wiki` in Obsidian for the graph view.
- `schemas/` — JSON Schemas for Tactics (`tactic.schema.json`), Procedure Packs (`procedure-pack.schema.json`), and Eval Cases (`eval-case.schema.json`).
- `packs/<forum>/` — Executable forum packs (`procedure.json` state machine + `tactics.json` practitioner tactics library).
- `src/engine/` — Deterministic rule engines (limitation, 45-day reply deadlines, disposal targets, tactic triggers, lawyer order-sheet audit). **Never use an LLM to compute dates, limitation, or fee math.**
- `evals/` — Real-world practitioner benchmark cases (`evals/cases/*.json`) and automated evaluator (`evals/run-evals.mjs`).

## 2. Core Engineering Rules
1. **No LLM Date or Fee Math:** Every statutory window (e.g., CPA 2019 s.38(2)(a) 30+15 day Written Version cap, s.38(7) 90/150-day disposal target) must be computed in `src/engine/`.
2. **Depth-First Readiness (FR-18 / ADR-008):** A forum pack cannot be promoted to Tier-1 until `npm run check` passes schema validation, unit tests, and practitioner eval cases.
3. **Keep Spec, Code, and Wiki in Sync:** When adding a new tactic, rule, or ADR, update `packs/`, `src/engine/`, `docs/legal-copilot-spec.md`, and `docs/wiki/`, then run `npm run check`.

## 3. Verification Commands
- `npm run wiki:lint` — Verify 0 broken `[[wikilinks]]` and 0 orphan pages in `docs/wiki`.
- `npm test` — Run deterministic rule-engine unit tests (`node --test`).
- `npm run eval` — Validate all forum packs against `schemas/` and run practitioner benchmark cases in `evals/cases/`.
- `npm run check` — Run all three checks end-to-end.
