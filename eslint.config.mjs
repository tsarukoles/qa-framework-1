// ESLint flat configuration (Week 2, Task 08).
// Prettier owns formatting: eslint-config-prettier comes last and switches off every
// formatting rule, so ESLint only reports code problems.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

// Globals for the plain Node scripts (.mjs). They are not TypeScript, so they are listed here.
const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      // Saved raw drafts stay as they passed; they are reviewed, not linted.
      'evidence/*-raw-draft.ts',
      // The supplied Jira seed package is imported as delivered.
      'jira-seed/**',
      'scripts/jira-seed.mjs',
      'vault/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Our own Node scripts and node:test files are linted explicitly.
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: nodeGlobals },
  },
  {
    // Task 08 step 5: logging is noise in a test, useful in a utility script.
    // This block applies only to the test and Page Object folders, so scripts/ keeps console.
    files: ['tests/**/*.ts', 'pages/**/*.ts'],
    rules: { 'no-console': 'error' },
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['tests/**/*.spec.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // A forgotten focused or skipped test must stop a commit, not pass quietly.
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': 'error',
    },
  },
  prettier,
);
