# Context: verified state, limits, next work

Updated 2026-10-19, after the Week 2 submission (pull request #2 merged with a merge commit, tag `week2-end`). The [map](_map.md) is the index; this page says what is true today.

## Verified in this build

- Five browser tests pass on dev (`npm test`): home banner and cards, categories for a signed-in author, article detail from the first card, home filter by category.
- `npm run typecheck`, `npm run lint` and `npm run format:check` exit 0. `npm run test:safety` runs the isolated checks for the target rules, the recorder, the guard, the Stop reminder, the preflight, the note generator and the vault validator (counts in `evidence/task11-note.md`).
- `npm run vault:check` reports every spec note fresh; `npm run vault:validate` reports 0 broken links.
- The Git hooks refuse a focused or skipped test, a token-shaped string or a protected file name in the staged content, and a push to `main` (proved in a disposable repository, see `evidence/task08-note.md`).

## Not verified in this build

- The Claude Code hooks (`SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, `SessionEnd`) are configured and script-verified, not live-verified: no Claude Code session could be started in this folder from the environment that built it. The first real session creates `vault/_changelog/` and `sessions.log`. See the [hook map](03-framework/hook-lifecycle-map.md).
- Rule loading in a fresh conversation and the permission denial of `.env.permission-check` (Tasks 03 and 10) were not observed, for the same reason.

## Limits

- The note generator supports `test()` and `test.describe()` with literal titles. A focused, skipped or dynamically titled test stops the refresh with a message instead of writing an empty note.
- A note's generated block is refreshed by the pre-commit hook for the specs being committed, by `PostToolUse` for a spec Claude edited, and by `npm run vault:sync` on request. A spec saved in the editor and never committed leaves its note stale until one of those runs; `vault:check` on push reports it.
- The validator checks that link targets exist, not that fragments or external sites do.
- The optional `FileChanged` watcher is not enabled.

## Next

- Run the live hook checks listed above in a VS Code session in this folder, then commit the first `vault/_changelog/` entries with the next task.
- Week 3 setup: the dev database login (kept in `.env`, never in the vault) and the database tasks.
