# Task 09 — shared files reviewed more carefully: verification note

Recorded 2026-10-18 on branch `week-2`. Observed results only.

## Dependency inspection (actual callers)

| Shared file              | Callers (file:line)                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `env/target.ts`          | `env/runIfEnv.ts:1-2`, `env/envGuard.ts:1`, `tests/support/env.ts:1`, `safety/process-probe.ts:4`, `safety/target.test.ts:3`                                                                     |
| `env/runIfEnv.ts`        | `tests/blog/article-detail.smoke.spec.ts:10`, `tests/blog/categories.smoke.spec.ts:8`, `tests/blog/home-filter.smoke.spec.ts:11`, `tests/blog/home.smoke.spec.ts:6`, `safety/process-probe.ts:8` |
| `env/envGuard.ts`        | `safety/process-probe.ts:17` and `:22` (no writing spec yet)                                                                                                                                     |
| `tests/support/env.ts`   | `playwright.config.ts:2`                                                                                                                                                                         |
| `tests/support/users.ts` | `tests/blog/categories.smoke.spec.ts:5` (import) and `:11` (`AUTHOR.email`, `AUTHOR.password`)                                                                                                   |
| `pages/LoginPage.ts`     | `tests/blog/categories.smoke.spec.ts:11` calls `login()`; the fields `emailInput`, `passwordInput`, `submitButton` are used only inside the class (`pages/LoginPage.ts:12-14`, `:24-26`)         |
| `pages/BlogListPage.ts`  | `tests/blog/home.smoke.spec.ts:9-19`, `tests/blog/home-filter.smoke.spec.ts:14-24`, `tests/blog/article-detail.smoke.spec.ts:13-16`                                                              |
| `pages/BasePage.ts`      | extended by the four page classes; `envBanner` used by `tests/blog/home.smoke.spec.ts:11-12`                                                                                                     |

The three real examples: renaming `LoginPage.emailInput` (`pages/LoginPage.ts:6`), adding `BlogListPage.search(term)` (no caller), widening `AppEnv` (`env/target.ts:1`, pinned by `safety/target.test.ts:15`, consumed by `addresses` at `env/target.ts:11`).

## Policy added to `.claude/rules/01-guardrails.md`

- Four tiers with real paths: CRITICAL (configuration, environment checks, shared fixtures, hook settings and hook scripts), ADD-ONLY (isolated checks, rule and guide files), EXTEND-ONLY (`pages/*.ts`), FULL CONTROL (specs, evidence, raw notes, journal). Generated notes (Task 11) are regenerated, never hand-edited.
- "What could break" for every CRITICAL entry, with its callers.
- The CROSS-IMPACT format `changed symbol -> used-by file:line -> breaking / behavioral / safe -> action`.
- The three proposed changes classified: the field rename is EXTEND-ONLY review, the method addition is safe, the type widening is CRITICAL and breaking.
- One completed record for renaming `LoginPage.emailInput` to `email`: two breaking lines inside the class (`:12`, `:24`), the spec caller is safe because it calls `login()`, one behavioural check (run the categories spec). The rename was **not performed**.
- Additional class chosen: the isolated checks in `safety/` and `safety-tests/` are ADD-ONLY, because `safety/target.test.ts:15` is the line that pins the rejection of `APP_ENV=staging`; adding cases cannot weaken that, editing existing assertions can.

## Guard change (`scripts/hooks/guard.mjs`)

- An explicit list of 19 CRITICAL paths, compared after normalising the proposal's path to a project-relative, forward-slash form (absolute Windows paths included; paths outside the project never match).
- After all seven refusal checks pass, a listed `Edit` or `Write` prints one JSON object to stdout and exits 0:

```json
{
  "systemMessage": "guard: WARN — shared file; review the affected callers before approving",
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "guard: WARN — shared file; review the affected callers before approving"
  }
}
```

- No `permissionDecision` is returned: the reminder is not approval and does not allow anything. Ordinary edits stay silent. Refused cases still return 2 and print no JSON.

## Results

`npm run test:safety`: **70 tests, 70 passed** (7 new Task 09 cases: listed relative path, listed absolute platform path, listed `Write`, ordinary edit silent, spec edit silent, refusal priority with token-shaped content into `.claude/settings.json`, outside-project path never listed). `npm run lint` and `npm run format:check`: exit 0.

Hand samples:

| Sample                                                         | Exit | Output                                             |
| -------------------------------------------------------------- | ---- | -------------------------------------------------- |
| ordinary edit to `env/target.ts` (listed)                      | 0    | the JSON above                                     |
| ordinary edit to `pages/BasePage.ts` (not listed)              | 0    | nothing                                            |
| removing an assertion in `tests/blog/home.smoke.spec.ts`       | 2    | `guard: BLOCKED — this edit removes an assertion…` |
| private-key header written to `.claude/settings.json` (listed) | 2    | `guard: BLOCKED — … token-shaped string…`, no JSON |

Policy rows versus the coded list: 19 CRITICAL paths in the rule table, 19 in `guard.mjs`, no row outside the list and no listed path outside the table (compared by a script).

## What this proves and what it does not

- A warning is not owner approval: the guard exits 0 either way; the approval happens in the conversation, as the rule demands.
- The Markdown table alone creates no warning: only the coded list in `guard.mjs` does. Adding a path to the table without the list leaves it silent.
- Isolated tests proved the JSON, the silence and the refusal priority with simulated payloads. A live warning in a real Claude session is **not verified in this build** (no session could be started in this folder); Task 10's settings change is the planned place to observe it.
