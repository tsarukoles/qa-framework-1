# Guardrails

These rules apply to every file and every conversation in this project. This file has no `paths` restriction on purpose.

## Production is read-only

- What: never create, change or delete anything on `https://ai-orchestration-courses.com`.
- When: always. A prod run is only an explicit `npm run test:prod`, and only for tests that read.
- Check: a reviewer looks for `runIfEnv(test, ['dev'])` in every spec that writes, and for `envGuard(...)` before the write.

## Tests that change data run on dev only

- What: a spec that creates, changes or deletes data calls `runIfEnv(test, ['dev'])` at the top of its `describe` block. The call skips the whole block when the selected environment is not dev (`env/runIfEnv.ts`).
- What: right before the action that writes, call `envGuard('<what the action does>')`. It throws `Cannot <action> on production.` when the selected environment is prod (`env/envGuard.ts`). The text names the real action, for example `envGuard('post a comment')`.
- When: any test or helper that writes. Read-only specs may still call `runIfEnv` to stay dev-only; all Week 1 and Week 2 specs do.
- Check: `npm run test:safety` proves the two helpers behave as described in a fresh process. A reviewer checks that writing specs call them.
- ⚠️ The helpers protect only code that calls them. A write without `envGuard` would run on prod the day its spec is allowed there, and no check today reports the missing call.

## Human approval before changing an outside system

- What: describe the action and wait for a yes before running anything that changes dev test data, Jira, GitHub or any other shared system. The approval covers the described action only, not unrelated changes.
- When: every such action, every time.
- Check: the conversation shows the description and the approval before the command.

## Secrets

- What: never commit `.env` or a real token; never print a secret value in chat, logs, notes, evidence or commit messages. Scripts read `.env`; Claude does not (`Read(./.env)` is denied in `.claude/settings.json`).
- When: always.
- Check: `git check-ignore .env` prints `.env` and `git ls-files .env` prints nothing. Before every commit, `scripts/hooks/secret-scan.mjs` scans the staged content for protected file names and token shapes (Task 08); before every `Edit` or `Write`, the guard refuses a proposal that carries a token shape (Task 06).

## Never bypass a failing check

- What: a Git hook that refuses a commit or a push has found something to fix. Fix the cause and run the commit or push again. Never use `--no-verify`, `HUSKY=0`, or any other way around a failing hook, and never ask for that.
- When: every commit and every push, including "small" ones.
- Check: the reviewer sees no `--no-verify` or `HUSKY=0` in the conversation or in the shell history that was shared; the pre-commit output (`secret-scan: … clean`, lint-staged) appears before each commit.
- ⚠️ A local hook is only a reminder with teeth: it does not run on a machine where Husky was not installed, so a bypass leaves no trace in Git. The reviewed pull request is the check that remains.

## Isolated safety checks stay separate

- What: the node:test checks in `safety/` run through `npm run test:safety` (tsx), never through Playwright. `playwright.config.ts` discovers only `tests/**/*.spec.ts`.
- When: when adding or moving a check.
- Check: `npx playwright test --list` shows browser specs only (five today).

## Checks that exist now

This file was written in Task 03. Since then: the guard on `PreToolUse` (Task 06), the staged-content secret scan and the `main` push refusal in the Git hooks (Task 08), the critical-file reminder (Task 09), and the note freshness and link checks on commit and push (Task 11). See `vault/03-framework/hook-lifecycle-map.md` and `README.md` for what each one covers and what it cannot do.

## One check worth automating later

A check that every data-changing call in a spec is preceded by `envGuard(`. Today only review catches a missing call.

## Shared files: tiers and cross-impact (Task 09)

A change to a shared file can break tests that were never edited. Each path below carries a tier that says how it may be edited. A tier is a review rule. The guard only prints a reminder for the CRITICAL paths in its own list (see the last section).

| Tier         | Meaning                                                                                            | Paths                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL     | The owner approves a change before it is made. The guard prints a review reminder for these paths. | `playwright.config.ts`, `tsconfig.json`, `package.json`, `eslint.config.mjs`, `.prettierrc.json`, `env/target.ts`, `env/runIfEnv.ts`, `env/envGuard.ts`, `tests/support/env.ts`, `tests/support/users.ts`, `.claude/settings.json`, `.husky/pre-commit`, `.husky/pre-push`, `scripts/hooks/guard.mjs`, `scripts/hooks/secret-scan.mjs`, `scripts/hooks/pre-push-check.mjs`, `scripts/hooks/stop-worklog.mjs`, `scripts/hooks/session-preflight.mjs`, `scripts/vault-sync.mjs` |
| ADD-ONLY     | Add entries, cases or functions; a change to existing behaviour needs review.                      | `safety/**`, `safety-tests/**` (the isolated checks), `.claude/rules/*.md`, `CLAUDE.md`, `README.md`, `.claude/commands/*.md`                                                                                                                                                                                                                                                                                                                                                 |
| EXTEND-ONLY  | Add members; renaming or deleting an existing member needs review with a cross-impact record.      | `pages/*.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| FULL CONTROL | Normal edits within the project rules, still tested and reviewed.                                  | `tests/blog/*.spec.ts`, `evidence/*.md`, `vault/_raw/**`, `vault/12-progress-report/**`                                                                                                                                                                                                                                                                                                                                                                                       |

Generated notes (Task 11 adds `vault/tests/**`) are regenerated from their sources and never edited by hand; only the human text below their generated block is edited, under FULL CONTROL.

The additional class chosen in Task 09: the isolated checks in `safety/` and `safety-tests/` are ADD-ONLY. Reason: `safety/target.test.ts:15` is what pins that `APP_ENV=staging` is rejected; changing an existing assertion there changes what the whole project guarantees, while adding a case cannot weaken anything.

### What could break for each CRITICAL entry

| Path                                                                                                             | Used by                                                                                                                      | What breaks on a careless change                                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `playwright.config.ts`                                                                                           | every browser run; imports `tests/support/env.ts:1`                                                                          | target, retries or project count change what "5 passed" means                                                        |
| `env/target.ts`                                                                                                  | `env/runIfEnv.ts:1-2`, `env/envGuard.ts:1`, `tests/support/env.ts:1`, `safety/process-probe.ts:4`, `safety/target.test.ts:3` | a widened `AppEnv` or a changed address lets a test run against the wrong site; the safety tests pin the exact rules |
| `env/runIfEnv.ts`                                                                                                | the `describe` block of all four specs under `tests/blog/`, `safety/process-probe.ts:8`                                      | every spec's eligibility; a loosened check runs dev-only tests on prod                                               |
| `env/envGuard.ts`                                                                                                | `safety/process-probe.ts:17` and `:22`; future writing tests                                                                 | the last defence before a data change on prod                                                                        |
| `tests/support/env.ts`                                                                                           | `playwright.config.ts:2`                                                                                                     | the base URL of every test                                                                                           |
| `tests/support/users.ts`                                                                                         | `tests/blog/categories.smoke.spec.ts:5` and `:11`; documented in `CLAUDE.md`                                                 | a changed teaching login fails every signed-in test                                                                  |
| `.claude/settings.json`, `.husky/pre-commit`, `.husky/pre-push`, `scripts/hooks/*.mjs`, `scripts/vault-sync.mjs` | every Claude session, every commit and push                                                                                  | a broken hook silently removes a check or blocks all work                                                            |
| `tsconfig.json`, `package.json`, `eslint.config.mjs`, `.prettierrc.json`                                         | typecheck, lint, format, the Git hooks, `npm ci`                                                                             | a changed include, script or exclusion changes what the checks cover                                                 |

### CROSS-IMPACT record format

`changed symbol -> used-by file:line -> breaking / behavioral / safe -> action`

One record line per caller. "breaking": the caller stops compiling or running. "behavioral": the caller still compiles but behaves differently. "safe": the caller is not affected.

### The three proposed changes, classified

- Renaming the locator field `LoginPage.emailInput` (`pages/LoginPage.ts:6`): EXTEND-ONLY, needs the record below.
- Adding a method `BlogListPage.search(term)`: an addition inside EXTEND-ONLY, safe. No caller changes: the specs keep using `open()`, `articleItems`, `articleLinks`, `articleCategories`, `categorySelect` and `filterByCategory()`.
- Widening `AppEnv` in `env/target.ts:1` to `'dev' | 'prod' | 'staging'`: CRITICAL and breaking. `addresses: Record<AppEnv, string>` (`env/target.ts:11`) stops compiling without a staging address; `resolveTarget` would accept a value that `safety/target.test.ts:15` requires to be rejected; every `runIfEnv(test, ['dev'])` list in `tests/blog/` needs a decision about staging. Action: owner approval, a new address, updated safety tests, reviewed spec lists.

### Completed record: renaming `LoginPage.emailInput` to `LoginPage.email` (not performed)

- `emailInput -> pages/LoginPage.ts:12 (the assignment in the constructor) -> breaking inside the class -> rename in the same edit`
- `emailInput -> pages/LoginPage.ts:24 (used by login()) -> breaking inside the class -> rename in the same edit`
- `emailInput -> tests/blog/categories.smoke.spec.ts:11 (calls login(email, password), never the field) -> safe -> no change`
- `LoginPage.login() -> tests/blog/categories.smoke.spec.ts:11 -> behavioral: none while the method keeps its name and flow -> run the categories spec after the rename`

Verdict: one edit covering lines 6, 12 and 24 of `pages/LoginPage.ts`, then `npm run typecheck` and `npx playwright test tests/blog/categories.smoke.spec.ts`. No spec changes.

### The coded list in the guard

`scripts/hooks/guard.mjs` holds its own explicit list of CRITICAL paths and prints `guard: WARN — shared file; review the affected callers before approving` for them. The table above does not update that list: a path added here is a review rule only until it is also added to the guard's list and its test. The reminder is not owner approval; it asks for the callers to be reviewed before the edit is approved.
