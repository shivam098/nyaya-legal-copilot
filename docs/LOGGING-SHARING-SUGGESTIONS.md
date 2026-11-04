# Interaction log, share links and expert suggestions

These three features share the main SQLite database (`data/nyaya.db`, or `NYAYA_DATA_DIR`).

## Interaction log (Super-Admin only)

Every request to `/api/analyze` and `/api/analyze-stream` writes one row to `interaction_logs`, whether it succeeds or fails.
Code: `src/engine/interaction-log.mjs`.

| Recorded | Notes |
|---|---|
| Who | `auth_state` (`signed-in` / `guest`), user id, email (signed-in only), role, device id, hashed IP, user agent |
| What | Request text after PII redaction (as sent to the model), images/documents flags, follow-up flag |
| How it was routed | Requested vs effective mode, area of law, category label, intake kind (`dispute` / `drafting` / `advisory`), follow-up questions shown |
| Outcome | `ok`, `incomplete`, `error`, `rate_limited`, `quota_exceeded`, `client_aborted`; response text; model, tokens, cost, latency; record-check result; app version (git SHA) |
| Feedback | The user's 👍/👎 (kept in sync with the turn) and the Super-Admin review: status, tags, note |

- **Super-Admin Lab → 📜 Interaction log:** filter, search, open an entry, review it, and export JSONL.
- **API:**
  - `GET /api/admin/logs` lists entries.
  - `GET /api/admin/logs/:id` returns one entry.
  - `PATCH /api/admin/logs/:id` saves a review.
  - `GET /api/admin/logs/export` downloads JSONL.
- **Retention:** `NYAYA_LOG_RETENTION_DAYS` (default 180; `0` keeps rows forever). Pruning runs at startup and then daily.
- **Privacy:** logging never blocks a user's request, because write errors go to stderr only. The home screen tells users that conversations are saved and may be reviewed.

## Share with a lawyer

The owner creates a read-only link from the **🔗 Share** button on an answer.
Code: `src/engine/share-links.mjs`.

- The link is a **snapshot**. It shows turns up to the moment it was created, never later messages.
- It expires after 1, 7 or 30 days, and the owner can turn it off at any time. The owner also sees how many times it was opened.
- Text from uploaded documents is left out unless the owner ticks the box to include it.
- Only a hash of the token is stored. The page is served with `noindex`, `no-store` and `no-referrer`.
- **API:**
  - `POST /api/sessions/:id/shares` creates a link, and `GET` on the same path lists links (owner only).
  - `DELETE /api/shares/:id` turns a link off.
  - `GET /api/shared/:token` is public.
  - The page itself is `/share/:token`.

## Expert improvement suggestions

Code: `src/engine/improvement-suggestions.mjs`.

1. Anyone can submit a suggestion from **Menu → 💡 Suggest an improvement** or **⋯ More → Suggest how Nyaya should handle this**. A suggestion says when the rule applies, what Nyaya should do, and optionally gives an example.
2. **Reviewers** are the Super-Admin and users given the `expert` role. The Super-Admin grants it with **Make expert** in the Lab's users table.
3. Reviewers open **Menu → 🧑‍⚖️ Review suggestions**. They can edit the rule, then approve it, send it back, or decline it.
4. **Approve** writes the rule as a practitioner lesson in the semantic index. The engine retrieves lessons for similar questions and passes them to the model, so behaviour changes without a release.
5. **Retire** removes the lesson again. Submitters see the status of their suggestions, and can edit any that were sent back.

## All users' cases and automatic case names

- **All users' cases:** Super-Admins see an **All users** tab in **My cases**, and it is the default for them. It lists every conversation, signed-in and guest, and is searchable by case name, question text, email or user id.
  - Opening a case is read-only.
  - Each answer has **📝 Audit this answer**. Answers that predate the log get an entry created on first audit.
  - Each answer also has **💡 Turn into a rule**, which opens a pre-filled improvement suggestion.
  - API: `GET /api/admin/cases` and `POST /api/admin/turns/:turnId/audit`.
- **Automatic names:** `src/engine/case-naming.mjs` names each conversation as *area · short subject*, with greetings and filler removed. Examples: `Draft · Rent agreement (Maharashtra)`, `Tenancy · My landlord is not returning my security deposit`.
  - Auto names refresh as Nyaya learns more about the matter.
  - A name the user typed (`sessions.title_source = 'user'`) is never replaced.
  - On startup, old automatic names such as `[Dispute] User Role: …` are upgraded once. They are re-routed with today's rules.
