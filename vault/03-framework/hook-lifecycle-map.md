---
id: hook-lifecycle-map
type: guide
---

# Hook lifecycle map

Which Claude Code events are connected to which program in this project, and how much of that has been verified. Three words are used precisely:

- **Configured**: the entry exists in `.claude/settings.json`.
- **Script verified**: `npm run test:safety` ran the program with sample events in a temporary project and checked the files it wrote.
- **Live verified**: a real Claude Code session in this project folder triggered the event and the expected record appeared.
- **Planned**: described here, not installed.

## Timeline of edits to this setup

| Date | Change |
|---|---|
| 2026-10-18 | Task 05: recorder `scripts/vault-sync.mjs` created with `--from-hook` and `--session-start`; `PostToolUse` and `SessionStart` connected; isolated tests in `safety-tests/vault-log.test.mjs`. |
| 2026-10-18 | Task 05 step 5: every new change-log entry ends with `· **commit:** <short HEAD>` (`unknown` when Git cannot say); older entries untouched; tests compare the field with the temporary repository's real short HEAD. |
| 2026-10-18 | Task 06: guard `scripts/hooks/guard.mjs` connected to `PreToolUse` for `Edit\|Write`. Six checks (protected file name, token-shaped content, `.only` added, `.skip` added, fewer `expect(`, fewer `runIfEnv(` or `envGuard(`), then step 5 added the seventh (`waitForTimeout(` added). Exit 2 + `guard: BLOCKED — reason` refuses; exit 0 is silent; unreadable input exits 0 (fails open). Isolated tests in `safety-tests/guard.test.mjs`. |

## What the guard covers and what it does not

- It inspects only the text Claude proposes through `Edit` (`old_string` → `new_string`) and `Write` (`content`). A file saved in the editor or rewritten by a terminal command never passes through it.
- A `Write` has no old text, so the guard cannot tell how many assertions or environment helpers a whole-file replacement removed; it only checks the new content for `.only`, `.skip`, `waitForTimeout(`, token shapes and the file name.
- Unreadable input exits 0: the edit continues unchecked. That is a known limit, not protection.
- Moving an assertion by deleting it in one edit and adding it in another is refused at the deletion; one edit that covers both places keeps the count and passes.

## Verification status

- Script verified: `npm run test:safety` = 18 passed (see `evidence/task05-note.md` for the cases and the sample before/after results).
- Live verified: **not in this build**. No Claude Code session could be started in this folder from the environment that built it. `vault/_changelog/` therefore does not exist yet; the first real session creates it. The steps to verify live are in the evidence note.

## The real hook settings

| Event | Matcher | Command | Status |
|---|---|---|---|
| `PostToolUse` | `Edit\|Write` | `node scripts/vault-sync.mjs --from-hook` | Configured. Script verified. Live: not verified in this build. |
| `SessionStart` | none (every start or resume) | `node scripts/vault-sync.mjs --session-start` | Configured. Script verified. Live: not verified in this build. |
| `PreToolUse` | `Edit\|Write` | `node scripts/hooks/guard.mjs` | Configured (Task 06). Script verified: seven checks, each with a blocked and an allowed example. Live: not verified in this build. |
| `Stop` | | | Planned for Task 07. Not installed. |
| `FileChanged` | | | Optional editor watcher. **Not enabled** in this exercise. |

The commands are relative to the project root. Claude Code runs hook commands with the folder the session started in as the working directory and sets `CLAUDE_PROJECT_DIR` to it. The recorder uses that folder as the project root (an isolated test can override it with `VAULT_SYNC_ROOT`). A session started one folder above the project loads none of these hooks and the command would not resolve; start Claude Code in the folder that holds `package.json`.

## What the recorder receives (stdin)

Claude Code describes the event as JSON and passes that text straight into the program's standard input, the same channel a pipe uses in a terminal. For a successful `Edit` or `Write`, the JSON holds `tool_input.file_path`, the path of the file that changed. The optional `FileChanged` event would send a top-level `file_path` instead; the recorder accepts both. A PowerShell pipeline can put one or two byte-order marks in front of the text; the recorder strips every leading one before parsing.

## What one entry looks like

```text
- **when:** 2026-10-18T19:40:11Z · **who:** tsarukoles@LAPTOP · **branch:** week-2
  **what:** tests/blog/home.smoke.spec.ts · **why (last commit):** Task 04: review and improve AI-generated tests
```

The file name is the local date (`vault/_changelog/2026-10-18.md`); the time inside is UTC. The last-commit line is background only: it is the newest commit when the recorder ran, not an explanation of the edit.

## The two loop protections

1. The connection listens for Claude's `Edit` and `Write` tools only. The recorder writes its log through Node, so its own write never fires this hook.
2. The recorder ignores `vault` and every path inside `vault/`. Even if an event about a vault file arrives (for example through a watcher), nothing is appended.

## Future proposal (documentation only, not installed)

Event: SessionEnd.
Matcher: omitted, so it would apply to all session endings.
Behavior: append a closing journal line so a reviewer can see when the session ended.
