# Task 06 — guard for risky AI edits: verification note

Recorded 2026-10-18 on branch `week-2`. Every result below was observed; anything not observed says so.

## Demonstration spec

`tests/blog/categories.smoke.spec.ts`: an active spec with no staged or unstaged changes (checked before and after this task). It is the file for the live connection check.

## What was built

| File | Purpose |
|---|---|
| `scripts/hooks/guard.mjs` | Reads one hook event from stdin, examines only the supplied input, blocks with exit 2 and `guard: BLOCKED — <reason>` on stderr, otherwise exits 0 silently. Malformed input exits 0 (fail-open). Never opens a file. |
| `safety-tests/guard.test.mjs` | node:test checks with simulated events through `spawnSync`'s `input` option; nothing is applied. |
| `.claude/settings.json` | `PreToolUse` with matcher `Edit\|Write` runs `node scripts/hooks/guard.mjs`. The Task 05 hooks and the permissions are unchanged. |
| `package.json` | `test:safety` also runs `safety-tests/guard.test.mjs`. |
| `vault/03-framework/hook-lifecycle-map.md` | `PreToolUse` row: configured, script verified, live not verified; coverage limits section. |

Detector prefixes are assembled from string pieces in the guard and in the tests, so neither file contains a token-shaped string (a search of both files for the literal prefixes finds nothing). No scanning exemption was added for these files.

## The six initial checks: twelve named results

Command: `npm run test:safety`. First run with the six checks: **42 tests, 42 passed** (Week 1: 6; recorder: 12; guard: 24).

| # | Blocked example (exit 2, reason shown) | Allowed example (exit 0, no refusal) |
|---|---|---|
| 1 | Write to `.env` → `.env is a protected file name…` | Write placeholder content to `.env.example` |
| 2 | Edit adding a Slack-bot-shaped token → `…contains a token-shaped string…` | Edit adding a comment with the word "token" |
| 3 | Edit changing `test(` to `test.only(` → `…adds .only…` | Edit renaming a test title |
| 4 | Edit changing `test(` to `test.skip(` → `…adds .skip…` | Edit touching the existing `runIfEnv(test, ['dev'])` line |
| 5 | Edit deleting one of two `expect(` lines → `…removes an assertion… (expect( calls 2 -> 1)` | Edit changing `'DEVELOPMENT'` to `'DEV'` inside the assertion |
| 6 | Edit deleting `runIfEnv(` → `…removes a runIfEnv( call… (1 -> 0)`; Edit deleting `envGuard(` → `…removes an envGuard( call…` | Edit changing `['dev']` to `['dev', 'prod']` while keeping the call |

Also covered: `.env.local`, `id_rsa`, `id_ed25519`, `server.key`, `bundle.p12`, a Windows path ending in `\.env` and `config/.env.production` → 2; Atlassian-shaped and AWS-key-shaped samples and the private-key header → 2; swapping `runIfEnv(` for `envGuard(` → 2 (the helpers are counted separately); the spec-only rules ignore `env/runIfEnv.ts`.

## Quick sample and edge cases (hand-run, exit codes)

| Sample | Exit | Output |
|---|---|---|
| Write a protected filename (`.env`) | 2 | `guard: BLOCKED — .env is a protected file name. Secrets stay in the ignored .env; a template must be named .env.example.` |
| Remove an assertion (`expect(categories.list)…` → empty) | 2 | `guard: BLOCKED — this edit removes an assertion from categories.smoke.spec.ts (expect( calls 1 -> 0). Keep the check; move it in the same edit if it must change place.` |
| Ordinary edit (`pages/BasePage.ts`, add a comment) | 0 | nothing |
| Unreadable input (`not json`) | 0 | nothing |

Edge cases in the test file: one and two leading byte-order marks before a blocked payload still return 2 (the marks are stripped, otherwise the guard would fail open); `{}`, `[]`, `null`, `''` and a non-object `tool_input` return 0 silently; a separate assertion deletion is blocked while the same move inside one edit (delete here, add there) keeps the count and passes; `.only` that already existed in the old text and stays is not an addition.

Known limits recorded as tests, not as protection: a `Write` carries no old text, so fewer assertions or fewer helpers in a whole-file replacement are not detected (`.only`, `.skip`, `waitForTimeout(`, token shapes and the file name still are); unreadable input lets the edit through (fail-open); edits made in the editor or by a shell command never reach this hook.

## Live connection check (step 4)

**Not verified in this build.** No Claude Code session could be started inside this project folder from the environment that built it, so no real `Edit` attempt reached the guard. What is proven in isolation: the exact harmless proposal of the lesson (adding the comment `// Task 06 guard check: test.only(` above the `describe` of the demonstration spec) returns exit 2 with the `.only` reason, and the demonstration spec is unchanged (`git status` shows nothing for it).

How to verify live (VS Code, this folder open): Claude Code: Open in New Tab → `/hooks` shows `PreToolUse` with `Edit|Write` → `node scripts/hooks/guard.mjs` → send the lesson prompt W2-T06-LIVE → expect the tool result to show the guard's refusal and the spec unchanged.

## Hard-wait rule (step 5)

Seventh check: for `*.spec.ts`, `waitForTimeout(` present in the new text and absent from the old text (a `Write` is checked as a whole). Reason: `guard: BLOCKED — this edit adds waitForTimeout( to <file>. Wait for the condition the test actually needs, for example await expect(locator).toBeVisible(), which retries until it is true.`

| Sample | Exit |
|---|---|
| Edit adding `await page.waitForTimeout(3000);` after `await blog.open();` | 2 |
| Edit adding `await expect(blog.articleItems.first()).toBeVisible();` instead | 0 |
| Write of a spec containing `waitForTimeout(500)` | 2 |
| Edit where the old text already had the hard wait and it stays | 0 |
| The same text in `pages/BasePage.ts` (not a spec) | 0 |

`npm run test:safety` after the extension: **47 tests, 47 passed, 0 failed**. No hard wait was added to any active test.

## Browser suite

`npm test -- --reporter=list`: **5 passed (8.1s)**, dev, one Chromium project, zero retries. The Task 05 hooks, permissions and all earlier safety coverage remain in place.
