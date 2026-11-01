# Copilot Instructions

Always read `AGENTS.md` and `docs/legal-copilot-spec.md` before making changes.
After any change to specs, wiki pages, forum packs, or rule engines, run `npm run check` to verify:
1. Wiki integrity (`npm run wiki:lint` -> 0 broken links, 0 orphans)
2. Deterministic rule engine tests (`npm test`)
3. Schema validation & practitioner scenario evals (`npm run eval`)
