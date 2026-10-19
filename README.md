# QA Framework

A framework that tests the supplied course applications.

## Setup

Use Node 24. Run `npm ci`, then `npx playwright install chromium`.

## Commands

- `npm test` runs the browser tests against development.
- `npm run test:prod` explicitly selects production. The Week 1 and Week 2 browser tests skip there.
- `npm run test:list` lists the browser tests (five after Week 2) in one Chromium project without running them.
- `npm run typecheck` checks TypeScript without running tests.
- `npm run test:safety` runs the isolated node:test checks without a browser or network: the target rules and helpers, the change recorder, the edit guard, the Stop reminder, the startup summary, the spec-note generator and the vault validator.

The browser tests use `data-testid` locators and relative paths. Retries are zero so a failure stays visible while learning. Traces are retained on failure.

## Environment rules

`APP_ENV` may be exactly `dev` or `prod`; a missing value selects dev. The course addresses are `https://dev.ai-orchestration-courses.com` and `https://ai-orchestration-courses.com`. Leave `BASE_URL` unset normally. If set, it must exactly match the selected address. `LOCAL_SANDBOX_DIR` is rejected. One process keeps one target; start a new process to switch.

The helpers only cover code that calls them. They do not stop a test that omits `runIfEnv`, an action that omits `envGuard`, a hard-coded URL in a test, or activity outside Playwright. Review those uses before running against production.

## Formatting and lint

- `npm run format` rewrites files with Prettier; `npm run format:check` only reports.
- `npm run lint` runs ESLint (flat config in `eslint.config.mjs`). In `tests/**/*.spec.ts` a focused test (`test.only`) or a skipped test (`test.skip`) is an error.
- Excluded from formatting and lint: the saved raw drafts under `evidence/` and the supplied Jira seed package (`jira-seed/`, `scripts/jira-seed.mjs`). Our own `.mjs` scripts are linted explicitly. The generated spec notes under `vault/tests/` are excluded from formatting only.

## Notes and journal

- `vault/_map.md` is the index of the project notes; `vault/_context.md` says what is verified and what comes next.
- `npm run vault:sync` refreshes the generated block of every spec note under `vault/tests/`; `npm run vault:check` reports a missing or stale note; `npm run vault:validate` checks the vault's links and structure.
- `/worklog` in Claude Code appends today's entry to `vault/12-progress-report/<you>/<date>.md`; the Stop reminder asks for it when work happened today.

## Three kinds of checks

| Kind                                          | Example                                                                                                                                                                                                                                                                                                                                                                                 | What it cannot do                                                                                                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Project rules (`CLAUDE.md`, `.claude/rules/`) | "No raw locators in `tests/`; they belong in `pages/`." Claude reads the rule when it works on a matching file.                                                                                                                                                                                                                                                                         | A written rule does not stop anything by itself. A reviewer or a check below has to notice.                                                                              |
| Claude hooks (`.claude/settings.json`)        | Before an `Edit`, `scripts/hooks/guard.mjs` refuses a proposal that adds `test.only`; after a successful edit, `scripts/vault-sync.mjs` records the file in `vault/_changelog/`.                                                                                                                                                                                                        | They see only Claude's `Edit`/`Write` calls. A file saved in the editor or rewritten by a shell command never passes through them.                                       |
| Git hooks (`.husky/`)                         | `pre-commit` scans the staged content for secret file names and token shapes, checks that the staged specs and their notes are safe to refresh, runs Prettier and ESLint on the staged files, then refreshes and stages the notes of the staged specs; `pre-push` refuses a push to `main`, then runs `typecheck`, the test listing, the note freshness check and the vault link check. | They run only where Husky is installed (`npm ci` runs `prepare`). `--no-verify` or `HUSKY=0` skips them, which the project rules forbid. No browser test runs in a hook. |

`ALLOW_MAIN_PUSH=1` lets an exceptional, deliberate push reach `main`; the course never uses it. `main` changes through a reviewed pull request.
