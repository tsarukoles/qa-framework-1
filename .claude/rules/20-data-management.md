---
paths:
  - 'tests/**'
  - 'tests/support/**'
---

# Test data

Applies to browser specs and the shared data in `tests/support/`.

## Use known seed data first

- What: prefer the records the course seeds on dev (the six home-page articles, the author account) over records a test creates.
- Check: a new spec names the seed record it relies on in a comment, or creates its own record under the rules below.

## Share data, do not copy it

- What: shared logins and fixtures are imported from `tests/support/` (today `AUTHOR` in `tests/support/users.ts`). Never paste the email or password into a spec.
- Check: searching `tests/blog/` for `@codemify.test` finds nothing; only `tests/support/users.ts` contains it.

## Created records are recognisable and unique

- What: a record a test creates carries the prefix `qa-test-` plus a value unique to the run and the test, for example `qa-test-<testId>-<timestamp>`, so parallel runs never collide.
- Check: a reviewer finds the prefix in the creation call.

## Clean up your own records, even on failure

- What: delete what the test created in `test.afterEach` or in a fixture's `finally` block, so a failing test still cleans up.
- What: never delete another test's or another person's records. Delete only what carries your own unique value.
- Check: every creating spec has a matching cleanup block.
- ⚠️ Nothing today verifies that a created record was cleaned up; a leftover record on dev silently changes counts for everyone. A reviewer reads the cleanup block.

## Approved setup paths

- What: later course work prepares data through the approved setup scripts and APIs (Week 3 adds the database and API tasks). Do not script against the UI to prepare data.
- Check: setup code lives in `tests/support/` or `scripts/`, not inside a spec.

## Read-only database verification

- What: a database check reads (`select`) and never writes. The Week 3 login is dev-only and lives in `.env`.
- Check: database code in tests contains no `insert`, `update` or `delete` statement.

## One check worth automating later

Fail a run when `qa-test-` records remain on dev after the suite finishes.
