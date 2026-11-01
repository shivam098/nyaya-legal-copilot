---
type: overview
tags: [overview, guide]
summary: "5-minute practical guide to navigating, searching, graphing, and growing this Karpathy-style LLM wiki in Obsidian."
sources: ["[[AGENTS]]"]
updated: 2026-10-24
---
# Obsidian Quick-Start Guide (for `legal-copilot`)

Welcome to your **Karpathy-style LLM Wiki**. Unlike normal note-taking where you manually write everything, **you and the AI co-own this vault**:
- **`raw/`** is where you drop raw inputs (voice transcripts, WhatsApp tips from lawyer friends, court orders, competitor links).
- **`wiki/`** is the structured, interlinked brain that you browse in Obsidian and the AI maintains.

---

## 1. Five Keyboard Shortcuts That Do 90% of the Work

| Shortcut | What it does | When to use it |
|---|---|---|
| **`Ctrl + O`** | **Quick Switcher** (jump to any page by name) | Type `overview`, `tactics`, `consumer`, or `adr` and hit Enter. Fastest way to move around. |
| **`Ctrl + G`** | **Global Graph View** | See all 108 pages colour-coded by folder (Concepts, Agents, Forums, Statutes, Decisions, Raw). |
| **`Ctrl + Shift + F`** | **Full-Text Search** across the vault | Search `Section 72`, `Hilli`, `45 days`, or `MCA21`. Use `tag:#tactics` to filter by tag. |
| **`Ctrl + P`** | **Command Palette** (every action in Obsidian) | Type `local graph`, `backlinks`, `split right`, or `theme` to run any command without hunting menus. |
| **`Ctrl + Click`** on any link | **Open link in a new split tab** | Keep `[[overview]]` open on the left while opening `[[tactics-library]]` or `[[consumer-commissions]]` on the right. |

---

## 2. Best Way to Explore Your `legal-copilot` Vault Right Now

1. **Start at the Hub:** Open **[[overview]]** (the 1-page synthesis) or **[[index]]** (the full directory).
2. **Open the Local Graph (Secret Power Feature):**
   - While reading any page (for example, **[[day-zero-evidence-and-pre-litigation]]** or **[[courtroom-tactician]]**), press **`Ctrl + P`** → type **`Open local graph`** → press Enter.
   - Drag that Local Graph pane to the right sidebar. Now, as you click from page to page, you immediately see every connected agent, statute, forum, and decision!
3. **Turn on Backlinks:**
   - Press **`Ctrl + P`** → **`Backlinks: Toggle backlinks in document`** (or check the bottom/right pane).
   - Every page shows **who links to it**—for instance, opening **[[consumer-protection-act-2019]]** shows every tactic, agent, and forum that relies on CPA 2019.

---

## 3. How the Colour-Coded Graph (`Ctrl + G`) Works

Your vault already has `.obsidian/graph.json` pre-configured:
- **Blue** — `wiki/concepts/` (strategy loop, tactics library, hearing-date compression, viability, registry mechanics)
- **Purple** — `wiki/architecture/` (9-layer stack, Case Brain, rule engines)
- **Green** — `wiki/agents/` (the 17 specialist agents)
- **Orange** — `wiki/forums/` (Consumer, NI 138, RERA, Civil, Criminal, Family, NCLT)
- **Teal** — `wiki/entities/` (Acts & portals: BNS/BNSS/BSA, CPA 2019, e-Daakhil, eCourts, MCA21)
- **Yellow** — `wiki/users/` (Personas)
- **Red** — `wiki/decisions/` (ADR-001 through ADR-008)
- **Grey** — `raw/` (Original brainstorm transcripts & spec)

---

## 4. Daily Workflow: How You + AI Use This Vault Together

Following Andrej Karpathy's LLM Wiki pattern (defined in **[[AGENTS]]**):

1. **Ingest (Drop & Tell the AI):**
   - Had a call with your lawyer friend? Got a new daily order in your consumer case?
   - Just tell Copilot (or drop a note in `raw/conversations/`): *"Ingest this tip into the wiki and consumer pack: ..."*
   - The AI adds the raw note, updates the relevant `wiki/` pages, adds the executable rule/tactic to `packs/consumer/`, and appends to **[[log]]**.
2. **Query (Ask Across the Graph):**
   - Ask Copilot: *"Based on our wiki, how do we handle an opposite party who refuses postal service of notice?"* → It traverses **[[registry-and-summons-mechanics]]** and **[[tactics-library]]**.
3. **Lint (`npm run check`):**
   - Automatically verifies there are **0 broken double-bracket links** and **0 orphan pages** whenever files change.

---

## 5. Official Resources (When You Want More)
- **Official Obsidian Help:** [https://help.obsidian.md](https://help.obsidian.md)
- **Karpathy LLM Wiki Gist (the pattern this vault uses):** [https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
