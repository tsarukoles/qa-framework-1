# Task 10 — what AI can do without asking: verification note

Recorded 2026-10-18 on branch `week-2`. Observed results only; interface observations that need a live Claude Code session are marked as not observed.

## Starting facts

- `.claude/settings.json` before: deny `Read(./.env)`, `Read(./.env.*)`; ask `Bash(git push *)`; no allow rules. No `.claude/settings.local.json` (it is git-ignored). No other competing rule file in the repository.
- `.claude/settings.json` is a CRITICAL path in the Task 09 policy and in the guard's coded list.
- Shell tool used by the assistant: `Bash`. Reviewed development test command: `npm test` (runs `cross-env APP_ENV=dev playwright test`). `npm run typecheck` runs `tsc --noEmit`.

## Final rules and the reason for each

| Rule                        | Kind  | Reason                                                                                                     |
| --------------------------- | ----- | ---------------------------------------------------------------------------------------------------------- |
| `Bash(npm test)`            | allow | the exact reviewed dev run; narrower than any Playwright argument                                          |
| `Bash(npm run typecheck)`   | allow | the exact script, inspected: `tsc --noEmit` only                                                           |
| `Bash(npm run test:safety)` | allow | the additional command (step 5); run many times during Tasks 05 to 09; it only runs local node:test checks |
| `Read(./.env)`              | deny  | the root `.env` holds the Jira token                                                                       |
| `Read(./.env.*)`            | deny  | variants such as `.env.permission-check`                                                                   |
| `Edit(.env*)`               | deny  | keeps the existing protection for matching file edits                                                      |
| `Bash(git push *)`          | ask   | every push still asks                                                                                      |

No `Bash(node *)` or `Bash(npx *)` allowance was added. Deny beats ask, ask beats allow.

## The CRITICAL-file warning for this change

The settings edit was made with the assistant's Edit tool outside a live Claude Code session in this folder, so the project's `PreToolUse` hook did not run and the live warning was **not observed**. The same payload passed to the guard by hand prints the Task 09 reminder:

```json
{
  "systemMessage": "guard: WARN — shared file; review the affected callers before approving",
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "guard: WARN — shared file; review the affected callers before approving"
  }
}
```

## Harmless fixture

`.env.permission-check` was created at the project root with the single line `COURSE_DEMO=not-a-secret` (25 bytes). Observed: `git check-ignore` lists it (the `.env.*` ignore rule), the real `.env` was not touched, and the guard refuses a `Write` to that name as a protected file name (exit 2). The fixture was deleted afterwards.

The Read-tool attempt against the permanent `Read(./.env.*)` rule needs a live session and was **not observed** here. Loaded-rule and mode observations in the Permissions interface: not observed for the same reason.

## The allowed commands, run for real

| Command                       | Result                                                      |
| ----------------------------- | ----------------------------------------------------------- |
| `npm test -- --reporter=list` | 5 passed (14.6s) on dev, one Chromium project, zero retries |
| `npm run typecheck`           | exit 0                                                      |
| `npm run test:safety`         | ℹ tests 70 ℹ pass 70 exit 0                                 |

Permission to run a command is separate from its result; the results above come from the runs, not from the rules.

## Permission rules versus the guard, with one example each

- A permission rule answers "may this tool perform this action?": `Read(./.env.*)` makes the Read tool refuse `.env.permission-check` before anything is read.
- The guard answers "does this proposed edit match a known problem?": an Edit that adds `test.only(` to a spec is refused with a reason, whatever the permission rules say.
- A limit neither covers: a secret pasted into an ordinary source file in a shape the guard does not know passes both; the staged-content scan (Task 08) and review remain.

## How to verify the two live observations (VS Code, this folder open)

1. Claude Code: Open in New Tab → `/permissions` (Customize → Permissions) → the three allow rules, three deny rules and one ask rule appear with source "project settings"; the mode indicator shows the normal approval mode.
2. Create `.env.permission-check` with `COURSE_DEMO=not-a-secret`, send the lesson prompt W2-T10-VERIFY → the Read attempt is denied by `Read(./.env.*)`; `npm test` runs without a prompt; delete the fixture.
