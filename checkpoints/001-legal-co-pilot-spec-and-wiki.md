<overview>
The user (@kumarshiv_microsoft, a founder-type) is brainstorming and specifying an AI "legal co-pilot" product for India. It should act like a top senior practitioner for any kind of case and for any side (complainant or accused). It takes a user from their narrated story through to the outcome, aiming to win on the available facts in the least time. It should also handle company-law advisory work and give honest advice not to pursue a weak case, or to settle out of court. My approach has been iterative product definition through conversation. The results are captured in a markdown spec file and a Karpathy-style LLM wiki (an Obsidian vault) in the session files folder. This is a chat session with no repository, and outputs live in the session folder.
</overview>

<history>
1. **First idea.** The user wanted a law agent that helps ordinary Indians with grievances (consumer deficiencies, public intimidation).
   - I proposed the flow: intake → assess → escalation ladder → drafting → follow-up → handoff, with consumer cases as the MVP.
   - The user chose to see the agent architecture next. I gave a first architecture: channels, a state-machine orchestrator, sub-agents, retrieval over legal sources, a rule engine, and a stack.
2. **Every kind of case.** The user wanted every step handled for every kind of case, because people only know their story.
   - I explained what is fully automatable, what needs a lawyer or physical presence, and the triage + playbook + fallback design.
3. **The real gap.** The user explained that their own consumer case, now 6–7 months old, is stuck mid-case. Generic chats can't give the practical next step an experienced lawyer would. The product should cover drafting, arguments, research and practical best practice.
   - I reframed the product as a "case co-pilot": case memory, a map of case stages, lawyer-style moves (for example the Hilli Multipurpose 45-day reply rule), and hearing preparation.
4. **All case types.** The user wanted civil, company and any other case type.
   - I proposed a procedure-first design: one shared case engine plus procedure packs for each forum, with a forum table and a rollout order.
5. **Problem and solution narration.** The user asked me to narrate back the problem and solution, then to add domestic disputes, then to add misuse of protective laws (DV, 498A/BNS 85/86, BNS 69) against innocent people.
   - I added these, including safety and discreet mode, and help for the accused (BNSS 35/Arnesh Kumar, BNSS 482 anticipatory bail, BNSS 528 quashing, BNS 248).
   - I added guardrails for both sides.
6. **Existing products.** The user asked whether this exists in India.
   - I ran web searches and gave a competitor table: NyayBuddy, Nyaya Saathi, NYAYI, LegalKart, Vakilsearch/Zolvit, Tele-Law/NALSA, jhana.ai, eCourts.
   - Gap: no product offers continuous practitioner-grade strategy after filing.
7. **Not just paperwork.** The user said it must act like the best practitioner, case by case, not a paperwork tool.
   - I refined the framing to "senior practitioner in your pocket" with a gap → capability table.
8. **Architecture.** The user asked for the agent architecture.
   - I gave 9 layers, the strategy loop, specialist agents, knowledge layer, rule engines, verification, tools, a learning loop and a stack.
9. **"Win by any means possible."** The user said the only rule is to help the user win by any means.
   - I declined to support fabrication or witness tampering and proposed "lawful-maximum advocacy".
   - The user clarified they meant the best route on the available facts, to win in the least time, not fabrication. I acknowledged this and added the scoring objective (P(win), time, value, cost) and speed levers.
10. **Practitioner tip on hearing dates.** The user relayed a lawyer friend's tip: hearings were a month apart, and a solid reasoned request can get a nearer date. They asked to incorporate it "in the spec file".
    - No spec file existed, so I created `legal-copilot-spec.md` (v0.2) with FR-9 "Practical courtroom tactics" (hearing-date compression, a tactics library schema, sourcing) and a Courtroom tactician agent.
11. **Karpathy-style wiki.** The user asked for a Karpathy-style wiki viewable in Obsidian.
    - I researched the pattern: `raw/` immutable sources, a `wiki/` maintained by the LLM with `index.md` and `log.md`, and an `AGENTS.md` schema; operations are ingest, query and lint.
12. **Company law (mid-task).** The user asked to add company law, formation hiccups and technicalities to the spec.
    - I updated the spec to v0.3: advisory and compliance mode, FR-15 company law, a Corporate counsel agent, a compliance calendar and penalty calculator, MCA21 tools, metrics and open questions.
    - I then wrote `build-wiki.mjs`, a Node generator for the vault.
13. **What makes a good lawyer (latest).** The user relayed what separates a good lawyer: understands the client's problem, frames it into law better, applies law effortlessly, researches well. They asked to give the agent these capabilities and to suggest not pursuing a case, or settling out of court, after hearing everything.
    - Spec updated to v0.4: the core principle now says "winning = best outcome", plus FR-16 senior-practitioner competencies, FR-17 case viability and out-of-court resolution, Case evaluator and Settlement & ADR advisor agents, and new metrics.
    - I edited `build-wiki.mjs` to add the matching pages, a raw source, ADR-007 and the log entry.
    - **The script has NOT been run yet.**
</history>

<work_done>
Files created or updated, all in `C:\Users\kumarshiv\.copilot\session-state\538f9648-3893-4bf4-91b3-f36e7ea9efe9\files\`:

- **`legal-copilot-spec.md`** (spec, now v0.4). Sections:
  - 1 Vision (two modes)
  - 2 Problem (including company-law hiccups)
  - 3 Users (including founders and SMEs)
  - 4 Core principle (lawful, fastest; hard lines; advisory variant; "winning = best outcome")
  - 5 Scope and rollout
  - 6 FR-1 to FR-17. Key ones: FR-9 tactics and hearing-date compression; FR-15 company law (15.1–15.7); FR-16 competency table; FR-17 viability, settlement and ADR.
  - 7 Architecture diagram plus agent notes (Courtroom tactician, Case evaluator, Settlement & ADR advisor, Corporate counsel, rule engines)
  - 8 Privacy
  - 9 Metrics
  - 10 Open questions
- **`build-wiki.mjs`**: Node ESM script that generates the vault at `files\legal-copilot-wiki\`. It deletes and recreates the folder on each run. It writes:
  - about 90 pages with frontmatter
  - raw sources: founder brainstorm, hearing-date tip, what-makes-a-good-lawyer, product search, and a copy of the spec as `raw/specs/legal-copilot-spec-v0.3.md`
  - an auto-generated `wiki/index.md` and `wiki/log.md`
  - the `AGENTS.md` schema
  - `.obsidian/graph.json` (folder colour groups) and `app.json`
  
  It also lints for broken links and orphans and prints `files= broken= orphans=`.

Status:
- [x] Spec updated with company law (FR-15), competencies (FR-16), and viability/ADR (FR-17)
- [x] Wiki generator written and updated with the new concepts
- [ ] Run `node build-wiki.mjs`, then fix any broken links or orphans it reports
- [ ] Delete `build-wiki.mjs` afterwards, or keep it as a regeneration tool (decide; the cleanup guideline suggests removing temp files)
- [ ] Report the vault path to the user, with instructions to open the `legal-copilot-wiki` folder as an Obsidian vault
</work_done>

<technical_details>
- **Environment:** Windows with no Python (the `python` alias opens the Store; `py` is missing). Node v24.21.0 is available, so use Node for scripts.
- **Script path handling:** ROOT is derived from `import.meta.url` with a regex to strip the leading slash before the drive letter. The script reads `../legal-copilot-spec.md` relative to the wiki root, i.e. the files folder.
- **Spec version vs file name:** the spec is now v0.4, but the wiki still references the raw spec page as `[[legal-copilot-spec-v0.3]]`, and the copy is written to `raw/specs/legal-copilot-spec-v0.3.md`. Consider renaming all occurrences to v0.4 (global replace in the script) before running.
- **Log template escape:** I replaced `${pages.length}` with `\${pages.length}`. That makes it print literally instead of interpolating, which is a bug. Revert to `${pages.length}` so the count shows.
- **Link conventions:** wiki pages use unique kebab-case filenames so `[[wikilinks]]` resolve vault-wide. Aliased links like `[[solution-vision|...]]` are handled by the lint regex. The `AGENTS`, `index` and `log` names are added to the known-names set.
- **Key product decisions (ADRs 001–007):**
  - 001: serve any side
  - 002: lawful-maximum advocacy, with hard lines only (no fabrication, false testimony, intimidation or bribery, false complaints, false RoC declarations)
  - 003: speed objective
  - 004: procedure-first architecture (LLM reasons, code handles rules, structured case memory)
  - 005: consumer-first pilot on the founder's own case
  - 006: advisory mode for company law
  - 007: best outcome, not just litigation (competency model, case evaluator, ADR)
- **Legal citations used:**
  - CPA 2019 s.38(7) (3 or 5 month target) and ss.71–72
  - NI Act s.143(3) (6 months)
  - DV Act s.12(5) (60 days)
  - CPC Order XVII Rule 1 (3 adjournments), Order XXXVII, Order XII Rule 6
  - Hilli Multipurpose (2020): reply in 30+15 days
  - BNS 69, 85/86, 227–229, 232, 248; BNSS 35, 482, 528; Arnesh Kumar
  - Companies Act s.164(2), 248, 252, 241–242, 441, 454
  - INC-32/SPICe+, INC-20A, ADT-1, AOC-4, MGT-7/7A, DIR-3 KYC, DPT-3, MSME-1, STK-2
  - Mediation Act 2023; Commercial Courts Act s.12A
  
  All of these are flagged for lawyer/CS verification. I deliberately avoided stating a PAS-3 deadline because I was unsure of it.
- **Competitor research caveat:** the search results came from AI-written summaries and are unverified.
- **User memory preferences:** present measurements as findings and ask before asserting interpretations; responses ≤100 words in routine cases.
</technical_details>

<important_files>
- `C:\Users\kumarshiv\.copilot\session-state\538f9648-3893-4bf4-91b3-f36e7ea9efe9\files\legal-copilot-spec.md`
  - The canonical product spec (v0.4), and the source copied into the wiki's raw folder.
  - Created at v0.2, then updated with FR-15 (company law), FR-16 (competencies) and FR-17 (viability/ADR), plus architecture, metrics and open questions.
- `C:\Users\kumarshiv\.copilot\session-state\538f9648-3893-4bf4-91b3-f36e7ea9efe9\files\build-wiki.mjs`
  - The generator for the Obsidian vault.
  - Contains all page content via the helpers `P()`, `agent()`, `forum()`, `ent()`, `persona()`, `adr()` and the `raw` array.
  - Its write section builds the index, log, AGENTS.md and .obsidian config; lint runs at the end.
  - Fix the `\${pages.length}` escape before running.
- `...\files\legal-copilot-wiki\` (to be generated)
  - The vault, with `wiki/index.md` as the entry point and `wiki/overview.md` as the synthesis.
</important_files>

<next_steps>
Immediate:
1. In `build-wiki.mjs`, revert `\${pages.length}` to `${pages.length}` in the log template. Optionally rename `legal-copilot-spec-v0.3` to `legal-copilot-spec-v0.4` throughout.
2. Run `node "C:\Users\kumarshiv\.copilot\session-state\538f9648-3893-4bf4-91b3-f36e7ea9efe9\files\build-wiki.mjs"` from the files folder. Check that the output shows `broken=0`, and fix any orphans or broken links (likely candidates: links to pages that don't exist).
3. Verify the folder structure (raw/, wiki/ subfolders, AGENTS.md, .obsidian/).
4. Optionally remove the temp script, or tell the user it regenerates the vault.
5. Reply briefly (≤100 words). Confirm:
   - the spec now has FR-16 (top-lawyer competencies: client understanding, theory of the case, research, application, judgement) and FR-17 (go / no-go / settle, out-of-court routes)
   - the vault path, and how to open it in Obsidian (Open folder as vault; graph view is colour-coded by folder)
   - legal citations need lawyer verification

Possible future asks: pilot on the user's own consumer case, a design doc, an MVP scaffold, hands-on competitor testing.
</next_steps>