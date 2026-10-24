# QA Framework

Playwright + TypeScript tests for the course applications. Work on the weekly branch (`week-<n>`) and review before merging into `main`.

## Targets

- dev: `https://dev.ai-orchestration-courses.com` (default; `npm test` sets `APP_ENV=dev`)
- prod: `https://ai-orchestration-courses.com` (only through `npm run test:prod`)
- `APP_ENV` must be exactly `dev` or `prod`; unset selects dev. The rules live in `env/target.ts`. Tests navigate with relative paths.

## Teaching login (course data, not a secret)

- Author: `author@codemify.test` / `Author123!`, imported from `tests/support/users.ts`, used on dev only.

## Commands

- `npm test`: browser tests on dev, one Chromium project, zero retries
- `npm run test:list`: list the browser tests without running them
- `npm run typecheck`: `tsc --noEmit`
- `npm run test:safety`: isolated node:test checks in `safety/` and `safety-tests/` (no browser, no network)
- `npm run test:prod`: explicit prod run; the Week 1 and Week 2 tests skip there
- `npm run lint`, `npm run format:check`: ESLint and Prettier (`npm run format` rewrites)
- `npm run vault:check`, `npm run vault:sync`, `npm run vault:validate`: spec-note freshness, refresh, vault links

## Three rules that apply everywhere

1. Never change data on prod. Prod is read-only.
2. Ask a human before any action that changes an outside system (dev test data, Jira, GitHub).
3. No secrets in tracked files or in output. Never read `.env`.

## Detailed rules

| File                                  | Applies to                                | When it loads                          |
| ------------------------------------- | ----------------------------------------- | -------------------------------------- |
| `.claude/rules/01-guardrails.md`      | the whole project                         | every conversation                     |
| `.claude/rules/10-playwright-pom.md`  | `tests/**`, `pages/**`                    | when a matching file is read or edited |
| `.claude/rules/20-data-management.md` | `tests/**` (including `tests/support/**`) | when a matching file is read or edited |
| `.claude/rules/30-test-names.md`      | `tests/**`                                | when a matching file is read or edited |
| `.claude/rules/30-db-postgres.md`     | the database and the `postgres` connector | every conversation                     |

## Layout

- `env/`: target resolver and the helpers `runIfEnv` and `envGuard`
- `pages/`: one Page Object class per page; `BasePage` holds the shared code
- `tests/blog/`: browser specs; `tests/support/`: shared teaching data
- `safety/`, `safety-tests/`: isolated checks; `evidence/`: saved drafts and verification notes
- `scripts/`: the recorder and the hook scripts; `vault/`: the map, the hook map, one note per spec, the journal (`/worklog`)
