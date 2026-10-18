# Week 2 baseline

Recorded 2026-10-18 before any Week 2 work. Commands were run from the framework root on `main` (up to date with `origin/main`, merge commit of the Week 1 pull request, tag `week1-end`), then the `week-2` branch was created from that point.

## Environment

- Target: dev (`https://dev.ai-orchestration-courses.com`), selected by the existing resolver in `env/target.ts` (`APP_ENV` unset selects dev; `npm test` sets `APP_ENV=dev` explicitly).
- Node v24.11.0, npm 11.6.1, `@playwright/test` 1.61.1, one Chromium project, retries 0.
- Windows 11, Git Bash shell.
- `.env` exists, is ignored (`git check-ignore .env` prints `.env`) and untracked (`git ls-files .env` prints nothing). Its contents were never read or displayed.

## Starting checks on main

| Command | Result |
|---|---|
| `git pull --ff-only` | Already up to date. |
| `npm run typecheck` | `tsc --noEmit`, exit 0, no errors. |
| `npm run test:safety` | 6 isolated node:test checks, 6 passed, 0 failed (`safety/target.test.ts`, `safety/helpers.test.ts`). |
| `npx playwright test --list` | 3 tests in 2 files, all `[chromium]`: `blog/categories.smoke.spec.ts` (1), `blog/home.smoke.spec.ts` (2). |
| `npm test -- --reporter=list` | 3 passed (6.7s) on dev, one Chromium project, zero retries. |

The isolated safety checks are counted separately from the three browser tests.

## Branch

- `git switch -c week-2` from `main` at `8a20e08`.
- `git push -u origin week-2`: the branch is published on GitHub.
- `env/target.ts`, `env/runIfEnv.ts` and `env/envGuard.ts` are unchanged.

## Jira setup (lesson "Set up your Jira board and API access")

Recorded 2026-10-18 after the real import.

- Seed package: `jira-seed.zip` from the lesson Downloads, data version `2026-09-16` (the `version` field of `jira-seed/jira-seed.json`). Unpacked to `jira-seed/` (8 files) and `scripts/jira-seed.mjs` next to `package.json`; no extra outer folder, no unrelated file overwritten.
- Package check: Node v24.11.0 (20 or newer), all three required paths present.
- Private connection settings live only in the ignored, untracked `.env` (five names, three values). They were never read into this note.

### Offline preview

`node scripts/jira-seed.mjs --dry-run` exit 0. It simulated an empty project: 4 placeholders would be created and deleted, 158 work items (7 epics, 30 tasks, 121 sub-tasks) would be created, keys SCRUM-5..SCRUM-162. No network call, nothing changed.

### Real import

`node scripts/jira-seed.mjs` exit 0. Actual output, private values removed:

```text
== Checking access
   ok: signed in as <redacted>
   ok: Agentic QA (team-managed) — work types Epic/Task/Subtask present

== Reading what the project already contains
   162 existing work item(s); highest key number 162
   158 of 158 seed summaries already exist — those are reused, not duplicated

== Verifying keys
   created 0, reused 158, placeholders 0, API calls 4
   ok: all 158 keys match the course (SCRUM-5..SCRUM-162)

Open https://<your-site>.atlassian.net/browse/SCRUM-9 — it should be "Automate environment & navigation smoke (UI)".
```

This board had been seeded from the same package version earlier, so the script reused every item by summary and created nothing. No key map was written (`vault/sources/jira/key-map.md` does not exist); the course keys are this board's keys.

### The work item I opened

- `SCRUM-9` — **Automate environment & navigation smoke (UI)**, a Task under epic `SCRUM-5`, labels `qa-automation`, `ui`.
- Its three `TC-UI-` subtasks: `SCRUM-108` TC-UI-001 (environment banner shows DEVELOPMENT on dev), `SCRUM-109` TC-UI-003 (anonymous navigation shows login only), `SCRUM-110` TC-UI-004 (authenticated navigation shows dashboard, categories, account, logout).
- Subtask read: `SCRUM-108` TC-UI-001, priority Medium, labels `automated`, `blog`, `env-dev-prod`, `ui`.
- What the selected test should prove: on the dev target the homepage banner is visible and says DEVELOPMENT, so a run can never be mistaken for a run against production.

The existing `tests/blog/home.smoke.spec.ts` test "shows the development banner" already checks this requirement on dev.

### Week 3 database login request

Not sent. This repository is the course owner's cohort-1 reference run, so the mentor who would answer the Slack direct message is its owner. No credentials are involved in this note.
