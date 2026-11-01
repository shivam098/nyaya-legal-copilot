---
type: concept
tags: [core, know-how]
summary: "What separates a top lawyer — modelled explicitly in the agent."
sources: ["[[2026-10-24-what-makes-a-good-lawyer]]", "[[legal-copilot-spec-v0.5]]"]
updated: 2026-10-24
---
# Practitioner competency model

**Origin:** [[2026-10-24-what-makes-a-good-lawyer]] — a good lawyer understands the client's problem, frames it and converts it into law better, applies law effortlessly and is strong at research, all from practice. Spec: FR-16.

| Competency | Top lawyer | Agent capability |
|---|---|---|
| Understand the problem | Hears what the client really wants and fears | Client-counselling interview; restate and confirm before advising ([[fact-finder]]) |
| Frame facts into law | Strongest legal theory, forum, relief, parties | Competing [[theory-of-the-case|theories of the case]], element ↔ fact ↔ evidence mapping ([[issue-spotter]]) |
| Research | Controlling, latest authority; distinguishes bad precedent | Citator-checked, forum-specific research ([[researcher]]) |
| Apply effortlessly | Crisp law-to-fact connection | Element-by-element application in drafts and briefs ([[drafter]], [[hearing-coach]]) |
| Procedural mastery | Knows stage, bench habits, practical moves | Procedure packs, court patterns, [[tactics-library]] |
| Judgement | Fight, settle or walk away | [[case-viability-assessment]], [[out-of-court-resolution]] |

**Quality bar:** before every major recommendation — "what would the best practitioner in this forum do?" — checked by the red-team critic in the [[verification-layer]]. Evaluation sets come from how experienced lawyers framed and resolved real cases ([[learning-loop]]).

