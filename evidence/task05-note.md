# Task 05 — automatic change recording: verification note

Recorded 2026-10-18 on branch `week-2`. Only results that were observed are written here; anything not observed is marked as such.

## Demonstration spec

`tests/blog/home.smoke.spec.ts`: an active spec outside `vault/`, with no staged or unstaged changes when it was selected. It is the file to edit (comment only) when the live recording check is run.

## What was built

| File                                                                               | Purpose                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/vault-sync.mjs`                                                           | The recorder. `--from-hook` reads one hook event from stdin and appends one entry to `vault/_changelog/<local date>.md`; `--session-start` appends `- session START <UTC>` to `vault/_changelog/sessions.log`. Logging modes always exit 0. |
| `.claude/settings.json`                                                            | `PostToolUse` (matcher `Edit\|Write`) and `SessionStart` run the two commands. Permissions unchanged.                                                                                                                                       |
| `safety-tests/vault-log.test.mjs`                                                  | node:test checks that run the script by absolute path inside temporary Git repositories, passing JSON through `spawnSync`'s `input`.                                                                                                        |
| `package.json`                                                                     | `test:safety` now runs the Week 1 files plus `safety-tests/vault-log.test.mjs`.                                                                                                                                                             |
| `vault/_map.md`, `vault/_raw/.gitkeep`, `vault/03-framework/hook-lifecycle-map.md` | The vault skeleton and the hook map (configured / script verified / live verified / planned).                                                                                                                                               |

Project root for the recorder: `VAULT_SYNC_ROOT` (isolated tests), else `CLAUDE_PROJECT_DIR` (Claude Code sets it for hook commands), else the working directory. Claude Code runs hook commands with the session's start folder as the working directory, so `node scripts/vault-sync.mjs` resolves only when the session was started in the folder that holds `package.json`.

## Sample events in a temporary repository

Temporary repository under the system temp folder, one commit (`Task 04: review and improve AI-generated tests`, short ID `ef0051d`), branch `week-2`, selected with `VAULT_SYNC_ROOT`. The real project was not touched (its `vault/_changelog/` does not exist).

| #   | Input on stdin                                                                           | Before                        | After                                                                                                         | Exit |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | `{"tool_input":{"file_path":"tests/blog/home.smoke.spec.ts"}}`                           | no `vault/_changelog/` folder | `vault/_changelog/2026-10-18.md` created with exactly one entry (below)                                       | 0    |
| 2   | `{"tool_input":{"file_path":"vault/_map.md"}}`                                           | 1 entry                       | unchanged (same md5)                                                                                          | 0    |
| 3   | `not json`                                                                               | 1 entry                       | unchanged                                                                                                     | 0    |
| 4   | `--session-start`, nothing on stdin                                                      | no `sessions.log`             | `- session START 2026-10-18T19:31:11Z`                                                                        | 0    |
| 5   | `{"tool_input":{"file_path":"C:\\...\\pages\\BlogListPage.ts"}}` (absolute Windows path) | 1 entry                       | 2 entries; the first entry's bytes unchanged; the new entry says `pages/BlogListPage.ts` with forward slashes | 0    |

Entry written by sample 1 (the computer name is shown as `<host>` here):

```text
- **when:** 2026-10-18T19:31:10Z · **who:** Demo Student@<host> · **branch:** week-2
  **what:** tests/blog/home.smoke.spec.ts · **why (last commit):** Task 04: review and improve AI-generated tests · **commit:** ef0051d
```

Exit code 0 proves nothing on its own: the recorder exits 0 even when it writes nothing (samples 2 and 3). The before/after comparison is the proof.

## Repeatable checks

Command: `npm run test:safety`. Final result: **18 tests, 18 passed, 0 failed** (Week 1: 6 checks; recorder: 12 checks).

Recorder cases: PostToolUse shape with a relative path (one entry, local-date file name, UTC time, name@host, branch, path, last-commit subject); FileChanged shape with a top-level absolute path (same relative path, forward slashes); append-only (earlier bytes preserved); `vault` and four paths inside `vault/` add nothing; a path outside the project and `../elsewhere.ts` add nothing; malformed, empty, `{}`, `[]`, `null`, empty and non-string `file_path` exit 0 and add nothing; one and two leading byte-order marks are stripped; `--session-start` appends one START line per call; an unknown mode prints usage and exits 2; outside any Git repository (with an empty global Git config) name, branch, subject and commit are `unknown`; a repository without a commit reports its branch and `unknown` for the subject and commit; the recorded commit equals the temporary repository's actual `git rev-parse --short HEAD`.

History of this check: the first run was 15 of 16. The failing case assumed `git config user.name` returns nothing outside a repository; Git still answers from the global config, so the test now points Git at an empty global config. After the commit-ID extension two cases failed: the FileChanged assertion did not expect the new field, and a repository without a commit reported branch `unknown` because `rev-parse --abbrev-ref HEAD` fails on an unborn branch; the recorder now asks `symbolic-ref --short HEAD` first. Final: 18 of 18.

## Commit-ID extension (step 5)

Every new entry ends with `· **commit:** <short HEAD>` from `git rev-parse --short HEAD` through the existing Git helper, `unknown` when Git cannot provide it, no fixed length assumed. Older entries are never rewritten (append-only). Isolated proof: the recorded ID equals the temporary repository's actual short HEAD (`ef0051d` in the sample above); the two fallbacks are covered.

## Live hook proof (fresh conversation and a real Edit)

**Not verified in this build.** No Claude Code session could be started inside this project folder from the environment that built it (nested sessions are refused there). Therefore:

- `sessions.log` baseline: the file does not exist in the real project (0 lines).
- `vault/_changelog/` does not exist in the real project. No entry was written by hand, so the history holds no pretend edits.
- The hook map marks `PostToolUse` and `SessionStart` as configured and script verified, live not verified.

How to verify live (about five minutes, in VS Code with this folder open): Command Palette → Claude Code: Open in New Tab → expect a new `- session START <UTC>` line in `vault/_changelog/sessions.log`; `/hooks` should list the project's `PostToolUse` and `SessionStart` entries; ask Claude to add a comment with a timestamp to `tests/blog/home.smoke.spec.ts` with its Edit tool → expect exactly one new entry in `vault/_changelog/<today>.md` naming that file, branch `week-2` and the current short HEAD.

## Browser suite

`npm test -- --reporter=list` after the extension: **5 passed (7.1s)**, dev, one Chromium project, zero retries.

## stdin and the two loop protections, in plain words

Claude Code describes the event as JSON and feeds that text into the recorder's standard input, the same channel a terminal pipe uses, so nobody types the file name by hand. A PowerShell pipeline can prepend one or two byte-order marks; the recorder strips every leading one.

1. The hook listens for Claude's `Edit` and `Write` tools only. The recorder writes with Node, so its own write never fires the hook.
2. The recorder ignores `vault` and every path inside `vault/`, so even an event about a vault file (for example from a future watcher) adds nothing.

The optional `FileChanged` watcher is not enabled in this exercise.
