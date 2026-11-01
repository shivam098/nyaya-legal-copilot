---
type: decision
tags: [decision, roadmap]
summary: "Gate full practitioner co-pilot mode behind Tier-1 readiness (procedure pack + >=15 verified tactics + 20-case benchmark) starting with Consumer."
sources: ["[[legal-copilot-spec-v0.5]]"]
updated: 2026-10-24
---
# ADR-008: Depth-first forum readiness (anti-cold-start)

## Context
Practitioner courtroom tactics ([[tactics-library]]) and local registry/service mechanics ([[registry-and-summons-mechanics]]) cannot be scraped from statutes alone. Spreading across 12 forums on day one would produce generic chatbot output.

## Decision
Enforce [[cold-start-and-forum-readiness]] (FR-18): only label a forum Tier-1 ("Full Practitioner Co-Pilot") when it has a verified procedure pack, ≥15 practitioner-reviewed tactics, registry/service playbooks, and ≥85% on a 20-case lawyer-graded benchmark. Start with [[consumer-commissions]] via [[adr-005-consumer-first-pilot]].