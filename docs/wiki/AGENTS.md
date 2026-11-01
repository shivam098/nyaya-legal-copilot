# Wiki schema (for the LLM maintaining this vault)

This is a Karpathy-style LLM wiki for the **Legal Co-Pilot for India** product. Open the folder as an Obsidian vault.

## Layers
- **raw/** — immutable sources (chat notes, practitioner tips, research, spec snapshots). Never edit; add new files only.
- **wiki/** — LLM-maintained pages. Entry point: wiki/index.md → [[overview]].
- **AGENTS.md** — this schema.

## Page conventions
- One idea per page; filename = kebab-case, unique across the vault (so wikilinks resolve).
- YAML frontmatter: type (overview|concept|architecture|agent|forum|entity|persona|market|decision|plan|index|log), tags, summary (one line), sources (links to raw/), updated (YYYY-MM-DD).
- Link generously with double-bracket wikilinks; every page links to at least one other page and is listed in wiki/index.md.
- Folders: concepts/, architecture/, agents/, forums/, entities/ (statutes, portals), users/ (personas), market/, decisions/ (ADR-style).
- Legal citations: cite section numbers; mark anything unverified; never invent case names.

## Operations
- **Ingest:** add file to raw/ → read it → update or create affected pages → update index.md → append to log.md ("## [YYYY-MM-DD] ingest | title").
- **Query:** answer from the wiki with links; if the answer is durable, file it as a new page and log it.
- **Lint:** check broken links, orphan pages, missing frontmatter, contradictions between pages and the latest spec, stale "updated" dates; log the result.

