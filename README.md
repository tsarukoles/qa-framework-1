# QA Framework

A framework that tests the supplied course applications.

## Setup

Use Node 24. Run `npm ci`, then `npx playwright install chromium`.

## Commands

- `npm test` runs the browser tests against development.
- `npm run test:prod` explicitly selects production. Week 1 browser tests skip there.
- `npm run test:list` lists three browser tests in one Chromium project.
- `npm run typecheck` checks TypeScript without running tests.
- `npm run test:safety` checks target and helper behavior without a browser or network.

The browser tests use `data-testid` locators and relative paths. Retries are zero so a failure stays visible while learning. Traces are retained on failure.

## Environment rules

`APP_ENV` may be exactly `dev` or `prod`; a missing value selects dev. The course addresses are `https://dev.ai-orchestration-courses.com` and `https://ai-orchestration-courses.com`. Leave `BASE_URL` unset normally. If set, it must exactly match the selected address. `LOCAL_SANDBOX_DIR` is rejected. One process keeps one target; start a new process to switch.

The helpers only cover code that calls them. They do not stop a test that omits `runIfEnv`, an action that omits `envGuard`, a hard-coded URL in a test, or activity outside Playwright. Review those uses before running against production.
