# Task 08 — checks before commits and pushes: verification note

Recorded 2026-10-18 on branch `week-2`. Observed results only.

## Starting state

Node v24.11.0, TypeScript 5.9.3, Playwright 1.61.1, no formatter or linter installed, no Git hooks active (`core.hooksPath` unset, only `.sample` files), five dev tests in four files, Claude hooks for five events. Files that need exclusions: `evidence/task01-raw-draft.ts`, `evidence/task04-raw-draft.ts`, `jira-seed/` (8 files), `scripts/jira-seed.mjs`.

## Installed (exact versions, `npm i -D --save-exact`, no force flags)

`typescript@6.0.3`, `typescript-eslint@8.64.0`, `eslint@10.7.0`, `@eslint/js@10.0.1`, `eslint-plugin-playwright@2.10.5`, `eslint-config-prettier@10.1.8`, `prettier@3.9.5`, `husky@9.1.7`, `lint-staged@17.0.8`. Install exit 0, 0 vulnerabilities, no peer warning.

Compatibility checked before installing: `typescript-eslint@8.64.0` accepts `typescript >=4.8.4 <6.1.0` and `eslint ^8.57 || ^9 || ^10`; `eslint-plugin-playwright@2.10.5` needs `eslint >=8.40`; `eslint-config-prettier@10.1.8` needs `eslint >=7`; `lint-staged@17.0.8` needs Node >= 22.22.1. Playwright is unchanged. TypeScript moved from 5.9.3 to 6.0.3 because the course set pins 6.0.3, which is inside the lint tooling's supported range; `npm run typecheck` passes with it unchanged.

## Configuration

| File                             | Content                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.prettierrc.json`               | single quotes, print width 100, `endOfLine: auto` (the clone on Windows checks files out with CRLF; `auto` keeps Prettier from rewriting every line ending).                                                                                                                                                                                                                                                                    |
| `.prettierignore`                | `evidence/*-raw-draft.ts`, `jira-seed/`, `scripts/jira-seed.mjs`, `vault/_changelog/`, `node_modules/`, `test-results/`, `playwright-report/`, `package-lock.json`.                                                                                                                                                                                                                                                             |
| `eslint.config.mjs`              | flat config: `@eslint/js` recommended, `typescript-eslint` recommended, our `.mjs` scripts linted explicitly with Node globals, `eslint-plugin-playwright` flat recommended on `tests/**/*.spec.ts` with `no-focused-test` and `no-skipped-test` as errors, `eslint-config-prettier` last; same ignores as Prettier. `env/runIfEnv.ts` keeps its intentional `test.skip` because the Playwright rules apply to spec files only. |
| `package.json`                   | scripts `format`, `format:check`, `lint`, `typecheck` (kept), `test:safety` (kept), `prepare: husky`; `lint-staged`: `*.{ts,mjs,json,md}` → `prettier --write`, `*.{ts,mjs}` → `eslint --max-warnings=0 --no-warn-ignored`.                                                                                                                                                                                                     |
| `.husky/pre-commit`              | `node scripts/hooks/secret-scan.mjs` then `npx lint-staged --concurrent false`.                                                                                                                                                                                                                                                                                                                                                 |
| `.husky/pre-push`                | `node scripts/hooks/pre-push-check.mjs` (refs from stdin; refuses `refs/heads/main` unless `ALLOW_MAIN_PUSH=1`), then `npm run typecheck`, then `npm run test:list`. No browser runs in a hook.                                                                                                                                                                                                                                 |
| `scripts/hooks/secret-scan.mjs`  | scans Git's staged content (`git diff --cached --name-only -z`, `git show :path`): protected names (`.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `id_rsa`, `id_ed25519`; `.env.example` passes the name check but is content-scanned) and the Task 06 token shapes, assembled from pieces; prints file and line, never a value.                                                                                                 |
| `.claude/rules/01-guardrails.md` | new rule: never bypass a failing hook (`--no-verify`, `HUSKY=0`).                                                                                                                                                                                                                                                                                                                                                               |
| `README.md`                      | formatting and lint commands; the three kinds of checks with an example and a limit each.                                                                                                                                                                                                                                                                                                                                       |

Secret scanning covers every staged file, including the guard, the scanner and their tests; no exemption was added for them.

## Checks on the project

`npm run format` reformatted 25 existing files (Markdown tables, long lines, YAML quotes in rule front matter); the specs, Page Objects and `env/` were already in Prettier style.

| Command                       | Result                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`        | exit 0: "All matched files use Prettier code style!"                                                                                                                                                                                                                                                                                                                                                             |
| `npm run lint`                | first run: 4 errors. Three `no-irregular-whitespace` hits were a real finding: the byte-order-mark regexes in `guard.mjs`, `stop-worklog.mjs` and `vault-sync.mjs` (and two test files) contained a literal U+FEFF character instead of the `﻿` escape; replaced with the escape (behaviour unchanged, the BOM tests still pass). One `no-useless-assignment` in `pre-push-check.mjs` fixed. Second run: exit 0. |
| `npm run typecheck`           | exit 0 with TypeScript 6.0.3                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm run test:safety`         | 63 tests, 63 passed                                                                                                                                                                                                                                                                                                                                                                                              |
| `npm test -- --reporter=list` | 5 passed (8.2s), dev, one Chromium project, zero retries                                                                                                                                                                                                                                                                                                                                                         |

Husky activated by `npm run prepare`: `core.hooksPath = .husky/_`.

## Step 4: refusals proved in a disposable repository

A separate repository under the system temp folder with the same `package.json`, lock file, configuration, hooks, scripts, `env/`, `pages/`, `tests/`, `safety/` and `safety-tests/`; its own `npm ci` (which activated Husky); no `.env`, no Jira data, no connection to the course remote. A local bare remote was created from its first commit. Each example was created in the files, staged and committed; the token is a made-up sample assembled from pieces.

| Example                                                                                                                                                                          | Result                 | Refusal (actual)                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| Setup commit of 38 files                                                                                                                                                         | passed                 | `secret-scan: 38 staged file(s) clean`, lint-staged ran Prettier and ESLint                      |
| (a) `test.only(` in `tests/blog/home.smoke.spec.ts`                                                                                                                              | commit refused, exit 1 | `8:8 error Unexpected focused test playwright/no-focused-test`; lint-staged reverted its changes |
| (b) `test.skip(` in the same spec                                                                                                                                                | commit refused, exit 1 | `15:8 error Unexpected use of the .skip() annotation playwright/no-skipped-test`                 |
| (c) made-up Slack-bot-shaped token added to `tests/support/users.ts` and staged                                                                                                  | commit refused, exit 1 | `secret-scan: BLOCKED — … tests/support/users.ts:8: looks like a Slack bot token`                |
| (d) the same token staged, then the working copy restored to the clean version without staging (`git status` showed `MM`, the working copy had no token, the staged copy had it) | commit refused, exit 1 | same finding: the scan reads the staged content, not the editor's file                           |
| (e) a harmless comment in `tests/blog/categories.smoke.spec.ts`                                                                                                                  | commit passed          | `secret-scan: 1 staged file(s) clean`, Prettier and ESLint completed                             |
| (f) `git push local main`                                                                                                                                                        | refused, exit 1        | `pre-push: BLOCKED — this push targets refs/heads/main.`; remote `main` unchanged                |
| (g) `git switch -c feature; git push local feature:main`                                                                                                                         | refused, exit 1        | same refusal; remote `main` unchanged                                                            |
| (h) `git push local feature`                                                                                                                                                     | passed, exit 0         | `tsc --noEmit` ran, `Total: 5 tests in 4 files` listed, `[new branch] feature -> feature`        |

After each refusal the example was removed (`git reset` + `git checkout`), leaving a clean status.

## Step 5: one narrow lint exception

`no-console` is an error for `tests/**/*.ts` and `pages/**/*.ts`, and explicitly off for `scripts/**/*.mjs`. The boundary is the `files` list of each configuration block, so the error cannot spill into the scripts.

| Temporary example                                                 | Result                                               |
| ----------------------------------------------------------------- | ---------------------------------------------------- |
| `console.log(...)` appended to `tests/blog/home.smoke.spec.ts`    | `23:1 error Unexpected console statement no-console` |
| `console.log(...)` appended to `scripts/hooks/pre-push-check.mjs` | exit 0, allowed                                      |

Both examples were removed; `npm run lint` and `npm run format:check` exit 0 afterwards.

## Limits

- Git hooks run only where Husky is installed; `--no-verify` or `HUSKY=0` skips them and leaves no trace. The project rule forbids both; the reviewed pull request is the check that remains.
- The scan detects its listed shapes only; a secret in another shape passes it.
- `.mjs` scripts are linted but not type-checked; the isolated safety tests cover their behaviour.
