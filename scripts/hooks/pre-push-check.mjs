#!/usr/bin/env node
/**
 * scripts/hooks/pre-push-check.mjs — the destination check of the pre-push hook (Week 2, Task 08).
 *
 * Git passes the pushed refs on stdin, one per line: <local ref> <local sha> <remote ref> <remote sha>.
 * A push whose remote ref is refs/heads/main is refused, even when the local branch has another
 * name (for example `git push origin week-2:main`). main changes only through a reviewed pull request.
 *
 * ALLOW_MAIN_PUSH=1 skips this refusal for an exceptional, deliberate push. It is documented, not used
 * in the course exercise. Exit 1 refuses, exit 0 lets the remaining pre-push checks run.
 */
import { readFileSync } from 'node:fs';

let input;
try {
  input = readFileSync(0, 'utf8');
} catch {
  input = '';
}

const refused = input
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0)
  .map((line) => line.split(/\s+/))
  .filter((parts) => parts[2] === 'refs/heads/main');

if (refused.length > 0 && process.env.ALLOW_MAIN_PUSH !== '1') {
  console.error('pre-push: BLOCKED — this push targets refs/heads/main.');
  for (const [local] of refused) console.error(`  - ${local} -> refs/heads/main`);
  console.error(
    'Push the weekly branch and open a pull request instead. (ALLOW_MAIN_PUSH=1 is for exceptional use only.)',
  );
  process.exit(1);
}
process.exit(0);
