---
paths:
  - 'tests/**'
---

# Test names

Applies to every `test()` and `test.describe()` title under `tests/`.

## The rule

- What: a title names the action and the expected result, so the test list reads as behaviour without opening the code. Pattern: what happens, then what should be true. The `describe` block names the page or area and the environment.
- When: every new or renamed test.
- Check: `npm run test:list` prints the titles; a reader who has not seen the code can say what each test proves.

## Examples

- Good: `opening the first article card shows that article` (action, then result).
- Good: `shows the category list to a signed-in author` (result, with its precondition).
- Bad: `test 1`, `categories work`, `article page` (no action, no result).

## Housekeeping

- Keep titles unique within a file; Playwright reports duplicate titles as errors.
- Do not put test IDs, selectors or the environment into a title; the `describe` block already names the environment.

## One check worth automating later

A lint rule that fails a `test()` whose title has fewer than three words.
