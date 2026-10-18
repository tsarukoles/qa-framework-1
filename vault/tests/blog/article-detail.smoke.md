# tests/blog/article-detail.smoke.spec.ts

<!-- vault:generated:start -->
- source: tests/blog/article-detail.smoke.spec.ts
- sha256: 5b2fe0a288025032baacb1b7ca4c1fe7ef41ee5552c458e8390715b0170c959a
- parser: ok
- titles:
  - describe: blog article detail on development
    - test: opening the first article card shows that article
- page objects: ArticlePage from ../../pages/ArticlePage; BlogListPage from ../../pages/BlogListPage
<!-- vault:generated:end -->

## What this spec checks

The reviewed Task 01 scenario: open the home page with `BlogListPage`, read the first card's link text and `href` (`article-link` inside `article-list`), click it, and prove the destination with `ArticlePage`: the URL equals the link's `href`, `article-detail` is visible, `article-title` equals the card title, and `article-body` is visible and not empty.

## Why it matters

Navigation from a card to its article was not covered by the Week 1 tests. Comparing the destination title with the clicked title proves the right article opened, not just some page. The original draft is kept unchanged in `evidence/task01-raw-draft.ts` for comparison.

## Limits

It always takes the first card, so it covers one article per run. It reads the title at run time instead of hard-coding it, which also means it cannot notice a wrong seed title.
