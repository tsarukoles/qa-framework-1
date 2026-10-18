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
- Check: `git check-ignore .env` prints `.env` and `git ls-files .env` prints nothing. Nothing scans staged content today; Task 08 adds that scan.

## Never bypass a failing check

- What: a Git hook that refuses a commit or a push has found something to fix. Fix the cause and run the commit or push again. Never use `--no-verify`, `HUSKY=0`, or any other way around a failing hook, and never ask for that.
- When: every commit and every push, including "small" ones.
- Check: the reviewer sees no `--no-verify` or `HUSKY=0` in the conversation or in the shell history that was shared; the pre-commit output (`secret-scan: … clean`, lint-staged) appears before each commit.
- ⚠️ A local hook is only a reminder with teeth: it does not run on a machine where Husky was not installed, so a bypass leaves no trace in Git. The reviewed pull request is the check that remains.

## Isolated safety checks stay separate

- What: the node:test checks in `safety/` run through `npm run test:safety` (tsx), never through Playwright. `playwright.config.ts` discovers only `tests/**/*.spec.ts`.
- When: when adding or moving a check.
- Check: `npx playwright test --list` shows browser specs only (three today).

## One check worth automating later

A pre-commit scan of staged content for `.env`-like filenames and token patterns (Task 08). Today the secret rule rests on `.gitignore` and review.
