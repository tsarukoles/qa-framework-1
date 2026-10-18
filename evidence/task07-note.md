# Task 07 — startup context and useful notes: verification note

Recorded 2026-10-18 on branch `week-2`. Observed results only; what was not observed is marked.

## What was built

| File                                                               | Purpose                                                                                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/hooks/session-preflight.mjs`                              | Prints exactly five lines at `SessionStart`: local date, branch, uncommitted file count (new folders included), newest journal path or `none yet`, `Map: vault/_map.md`. |
| `scripts/hooks/stop-worklog.mjs`                                   | The `Stop` reminder. `--path` prints today's journal path; otherwise it reads the Stop event and applies the five decisions below.                                       |
| `.claude/commands/worklog.md`                                      | The `/worklog` command: get the path from `--path`, gather real work, append a `## HH:MM` block with Did / Worked / didn't / Next, never overwrite, never secrets.       |
| `scripts/vault-sync.mjs` `--session-end`                           | Appends `- session END <UTC> · commit <short> · uncommitted <n> file(s)` to `sessions.log`.                                                                              |
| `.claude/settings.json`                                            | `SessionStart` runs the recorder and the preflight as two entries; `Stop` runs the reminder; `SessionEnd` runs `--session-end`. Earlier hooks and permissions unchanged. |
| `safety-tests/worklog.test.mjs`, `safety-tests/vault-log.test.mjs` | Isolated checks in temporary Git repositories with local test authors.                                                                                                   |

Journal path for this project: `vault/12-progress-report/tsarukoles/<local date>.md` (slug from `git user.name` = `tsarukoles`).

## Isolated results (temporary repositories)

Command: `npm run test:safety` → **63 tests, 63 passed, 0 failed** (Week 1: 6; recorder: 14; guard: 29; worklog and preflight: 14).

| Case                                                                                       | Result                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--path`                                                                                   | prints `vault/12-progress-report/anna-kowal/<local date>.md` for user `Anna Kowal`, reads no stdin                                                                         |
| slug generation                                                                            | ` Zoë Müller!!` → `zo-m-ller`; `QA_Student 2` → `qa-student-2`; `---` and empty → `student`                                                                                |
| clean empty repository                                                                     | exit 0, no output                                                                                                                                                          |
| malformed input (`not json`, empty, `null`, `[]`)                                          | exit 0                                                                                                                                                                     |
| only a `.txt` change and no commit today                                                   | exit 0 (not a qualifying file)                                                                                                                                             |
| activity with no entry: an untracked `tests/new/deep/thing.spec.ts` in a new nested folder | exit 2, stderr names the exact path and `/worklog`                                                                                                                         |
| retry: `stop_hook_active: true` with the same activity                                     | exit 0                                                                                                                                                                     |
| leading byte-order mark before the event                                                   | same decision as without it (exit 2)                                                                                                                                       |
| valid `## 10:15` heading in today's local-date journal                                     | exit 0                                                                                                                                                                     |
| a `### 10:15` line (wrong heading level)                                                   | exit 2                                                                                                                                                                     |
| commit dated 2020-01-02 with a clean tree                                                  | exit 0; a commit made today with a clean tree and no entry                                                                                                                 | exit 2 |
| preflight in a repository without a commit, two files in a new folder                      | exactly five lines: `Date: <local date>`, `Branch: main`, `Uncommitted: 2 file(s)`, `Latest journal: none yet`, `Map: vault/_map.md`                                       |
| preflight with journals under three student folders                                        | `Latest journal: vault/12-progress-report/two/2026-03-09.md` (newest by file name, not folder)                                                                             |
| preflight outside any repository                                                           | `Branch: no-branch`, `Uncommitted: 0 file(s)`, still five lines                                                                                                            |
| `--session-end`                                                                            | END line with UTC time, the repository's real short HEAD and the uncommitted count including two nested untracked files; `commit unknown` in a repository without a commit |

Refusal text (actual):

```text
stop-worklog: BLOCKED — work happened today but vault/12-progress-report/tsarukoles/2026-10-18.md has no "## HH:MM" entry.
Run /worklog (it appends a "## HH:MM" heading with Did / Worked / didn't / Next to vault/12-progress-report/tsarukoles/2026-10-18.md), then finish again.
```

## Hand runs in the real project (before the hooks were connected)

| Command                                                                                     | Result                                                                                                               |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `node scripts/hooks/session-preflight.mjs`                                                  | `Date: 2026-10-18` / `Branch: week-2` / `Uncommitted: 7 file(s)` / `Latest journal: none yet` / `Map: vault/_map.md` |
| `node scripts/hooks/stop-worklog.mjs --path`                                                | `vault/12-progress-report/tsarukoles/2026-10-18.md`                                                                  |
| normal input `{"stop_hook_active":false}` with the Task 07 files uncommitted and no journal | exit 2 with the refusal above                                                                                        |
| `{"stop_hook_active":true}`                                                                 | exit 0                                                                                                               |
| `not json`                                                                                  | exit 0                                                                                                               |

## The journal entry and the journal check

`vault/12-progress-report/tsarukoles/2026-10-18.md` was written following `.claude/commands/worklog.md` (path from `--path`, real local time `## 15:47`, Did / Worked / didn't / Next, no secrets). The assistant that built Week 2 wrote it outside a live Claude Code session; the file says so in its first paragraph. It describes work that actually happened and is committed with this task.

After the entry: `--path` prints the same path; normal input `{"stop_hook_active":false}` → **exit 0**; the preflight now prints `Latest journal: vault/12-progress-report/tsarukoles/2026-10-18.md`.

A passed Stop check means the heading exists. It does not mean the code compiles or the tests pass; `npm run typecheck` (exit 0) and the test runs are separate.

## Live sequence (fresh conversation, Stop feedback, SessionEnd)

**Not verified in this build.** No Claude Code session could be started inside this project folder from the environment that built it. Therefore not observed: the five-line summary arriving as context, the Stop reminder being delivered to Claude, and a real `session END` line (`sessions.log` does not exist in the real project).

How to verify live (VS Code, this folder open): Claude Code: Open in New Tab → `/hooks` lists both `SessionStart` commands, `Stop` and `SessionEnd` → send the lesson prompt W2-T07-START-CHECK and expect the five lines quoted back → send "We are done with this work for now. Give me a short closing response." → because today's entry already exists, no refusal is expected; run `/worklog` to append this session's work → close the tab (the supported way to end the session in the VS Code extension) → `vault/_changelog/sessions.log` should hold the START and END lines of that session.

## Limits

- The reminder checks for a heading, not for the truth or usefulness of the entry.
- An entry written earlier today satisfies it for the rest of the day.
- Unreadable input and a retry both exit 0 without proving that anything was written.
- Edits outside `Edit`/`Write` (editor, terminal) are not recorded by `PostToolUse`; `FileChanged` stays off.
