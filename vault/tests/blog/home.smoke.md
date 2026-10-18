# tests/blog/home.smoke.spec.ts

<!-- vault:generated:start -->
- source: tests/blog/home.smoke.spec.ts
- sha256: 439750c8afc884209b7b3bc9110bca5ad296fab0f8b43bc5e77d4cc2ecb46924
- parser: ok
- titles:
  - describe: blog home on development
    - test: shows the development banner
    - test: shows at least one article card
- page objects: BlogListPage from ../../pages/BlogListPage
<!-- vault:generated:end -->

## What this spec checks

Two read-only checks of the blog home page on dev through `BlogListPage`: the environment banner (`env-banner`) is visible and says DEVELOPMENT; the article list has at least one card (`article-item`) and the first card is visible. Both tests sit in a `describe` block guarded by `runIfEnv(test, ['dev'])`, so they skip on prod.

## Why it matters

The banner check is the course requirement TC-UI-001 (Jira `SCRUM-108` under `SCRUM-9`): a run must be recognisable as a dev run. The card check proves the seeded articles are rendered at all; every other blog test starts from this page.

## Limits

No exact card count (the seeded list can change). The banner text is checked with `toContainText`, so extra decoration would pass. Nothing here checks article content.
