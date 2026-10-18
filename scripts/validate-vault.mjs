#!/usr/bin/env node
/**
 * scripts/validate-vault.mjs — link and structure checks for the vault (Week 2, Task 11).
 *
 * Errors (exit 1): a local Markdown link `[label](target)` or a wikilink `[[target]]` whose target does
 *   not exist. Markdown targets resolve from the note's own folder; wikilinks resolve from the vault root.
 *   Labels, an optional `.md`, and `#fragment` suffixes are handled; fragments are not checked.
 * Warnings (exit stays 0): a maintained note that no other vault file links to; a guide under
 *   vault/03-framework/ with no Markdown H1 outside code blocks (the Task 11 step 5 rule).
 * Ignored: images, http(s)/mailto links, fragment-only links, anything inside fenced or inline code.
 * Exempt from the orphan warning: _map.md, _raw/, _changelog/ (logs), sources/ (imports) and
 *   12-progress-report/ (daily journal entries). Imported notes carry no generated-note metadata.
 *
 * Project root: --root <dir>, else VAULT_SYNC_ROOT, else CLAUDE_PROJECT_DIR, else the working directory.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

const argv = process.argv.slice(2);
const rootIndex = argv.indexOf('--root');
const ROOT = resolve(
  (rootIndex >= 0 && argv[rootIndex + 1]) ||
    process.env.VAULT_SYNC_ROOT ||
    process.env.CLAUDE_PROJECT_DIR ||
    process.cwd(),
);
const VAULT = resolve(ROOT, 'vault');
const ORPHAN_EXEMPT = [
  /^_map\.md$/,
  /^_raw\//,
  /^_changelog\//,
  /^sources\//,
  /^12-progress-report\//,
];

const forward = (p) => p.replace(/\\/g, '/');

function walk(dirAbs, out = []) {
  if (!existsSync(dirAbs)) return out;
  for (const name of readdirSync(dirAbs).sort()) {
    const abs = resolve(dirAbs, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (name.endsWith('.md')) out.push(abs);
  }
  return out;
}

function withoutCode(text) {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

/** Resolves a link target to an existing absolute path, trying an added .md; null when missing. */
function resolveTarget(base, target) {
  const clean = decodeURI(target.split('#')[0]);
  if (clean === '') return null;
  const candidate = isAbsolute(clean) ? clean : resolve(base, clean);
  if (existsSync(candidate)) return candidate;
  // Note names contain dots (home.smoke), so the .md fallback is tried whenever the target is absent.
  if (existsSync(`${candidate}.md`)) return `${candidate}.md`;
  return null;
}

const files = walk(VAULT);
const errors = [];
const warnings = [];
const inbound = new Map();
const relVault = (abs) => forward(relative(VAULT, abs));

for (const file of files) {
  const text = withoutCode(readFileSync(file, 'utf8'));
  const here = relVault(file);
  const links = [];
  for (const m of text.matchAll(/(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const [, bang, , target] = m;
    if (bang === '!') continue;
    if (/^(https?:|mailto:|#)/i.test(target)) continue;
    links.push({ kind: 'markdown', target, base: dirname(file) });
  }
  for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = m[1].split('|')[0].trim();
    if (target.startsWith('#') || target === '') continue;
    links.push({ kind: 'wikilink', target, base: VAULT });
  }
  for (const link of links) {
    const found = resolveTarget(link.base, link.target);
    if (!found) {
      errors.push(`${here}: broken ${link.kind} -> ${link.target}`);
      continue;
    }
    const rel = forward(relative(VAULT, found));
    if (!rel.startsWith('../') && !isAbsolute(rel) && found !== file) {
      inbound.set(rel, (inbound.get(rel) ?? 0) + 1);
    }
  }
  if (here.startsWith('03-framework/') && !/^# \S/m.test(text)) {
    warnings.push(`${here}: guide has no H1 heading outside code blocks`);
  }
}

for (const file of files) {
  const here = relVault(file);
  if (ORPHAN_EXEMPT.some((re) => re.test(here))) continue;
  if (!inbound.has(here))
    warnings.push(`${here}: no other vault file links to this maintained note`);
}

for (const e of errors) console.error(`validate-vault: ERROR ${e}`);
for (const w of warnings) console.warn(`validate-vault: WARN ${w}`);
console.log(
  `validate-vault: ${files.length} file(s), ${errors.length} error(s), ${warnings.length} warning(s)`,
);
process.exit(errors.length ? 1 : 0);
