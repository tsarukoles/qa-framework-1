# QA Framework

- Purpose: test the supplied course applications with Playwright and TypeScript.
- Work in the weekly branch and review changes before merging into main.
- Read no private credentials or `.env` files. Never commit secrets or generated results.
- Week 1 browser tests only read pages. Do not create, change, or delete site data.
- The target rules live in `env/target.ts`; tests navigate with relative paths.
- Use `runIfEnv` for environment eligibility and `envGuard` before data changes.
- `npm test` runs dev; `npm run test:prod` explicitly selects prod.
- `npm run test:safety` runs isolated checks; `npm run typecheck` checks TypeScript.
- `npm run test:list` lists the browser tests without running them.
- See `playwright.config.ts`, `tests/support/`, and `README.md` for the project setup.
