#!/usr/bin/env node
/**
 * scripts/vault-sync.mjs — the project recorder and the spec-note generator (Week 2, Tasks 05, 07, 11).
 *
 * Logging modes (always exit 0, failures reported briefly on stderr without the input):
 *   --from-hook       read one hook event (JSON on stdin), append one entry to vault/_changelog/<local date>.md;
 *                     when the changed file is a supported spec, also refresh its note (no staging, fail-open)
 *   --session-start   append "- session START <UTC time>" to vault/_changelog/sessions.log
 *   --session-end     append "- session END <UTC time> · commit <short> · uncommitted <n> file(s)"
 *
 * Note modes (Task 11): one note per spec, tests/<path>.spec.ts -> vault/tests/<path>.md
 *   --write [--files <spec…>] [--stage]   refresh the generated block of every note (or the listed specs);
 *                     exit 1 on an unsafe path, a parse error, unsupported syntax, damaged markers, or a
 *                     deleted source whose managed note still exists. --stage (only with --write --files)
 *                     runs the staging-safety checks first, then stages only the refreshed notes.
 *   --check [--files <spec…>]             read-only; exit 1 when a note is missing, stale, invalid,
 *                     unsupported, or has no source; exit 0 otherwise.
 *
 * Project root: --root <dir>, else VAULT_SYNC_ROOT, else CLAUDE_PROJECT_DIR (set by Claude Code for hook
 * commands), else the working directory. Claude Code runs hook commands with the project folder as the
 * working directory, which is also what makes "node scripts/vault-sync.mjs" resolve.
 *
 * The generated block sits between the markers below. Text outside the markers is preserved byte for byte.
 * The source hash is taken over the spec with line endings normalised to LF, so a Windows checkout and
 * a Linux checkout agree. Node built-ins plus the installed TypeScript parser (loaded only for note modes).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { hostname } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const BOM = String.fromCharCode(0xfeff);
const START = '<!-- vault:generated:start -->';
const END = '<!-- vault:generated:end -->';
const VAULT = 'vault';
const TESTS_DIR = 'tests';
const NOTES_DIR = 'vault/tests';
const IGNORED_TEST_CALLS = new Set([
  'test.beforeEach',
  'test.afterEach',
  'test.beforeAll',
  'test.afterAll',
  'test.use',
  'test.step',
  'test.info',
  'test.setTimeout',
  'test.slow',
]);

// ---------------------------------------------------------------- arguments

function usage(message) {
  console.error(`vault-sync: ${message}`);
  console.error(
    'usage: node scripts/vault-sync.mjs --write [--files <spec…>] [--stage] | --check [--files <spec…>] | --from-hook | --session-start | --session-end  [--root <dir>]',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const modes = new Set(['--from-hook', '--session-start', '--session-end', '--write', '--check']);
  let mode = null;
  let root = null;
  let files = null;
  let stage = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (modes.has(arg)) {
      if (mode) usage(`conflicting modes ${mode} and ${arg}`);
      mode = arg;
    } else if (arg === '--root') {
      root = argv[i + 1];
      if (!root || root.startsWith('--')) usage('--root needs a folder');
      i += 1;
    } else if (arg === '--files') {
      files = [];
    } else if (arg === '--stage') {
      stage = true;
    } else if (arg.startsWith('--')) {
      usage(`unknown flag ${arg}`);
    } else if (files) {
      files.push(arg);
    } else {
      usage(`unexpected argument ${arg}`);
    }
  }
  if (!mode) usage('a mode is required');
  if (files !== null && mode !== '--write' && mode !== '--check')
    usage('--files goes with --write or --check');
  if (files !== null && files.length === 0) usage('--files needs at least one spec path');
  if (stage && !(mode === '--write' && files)) usage('--stage is valid only with --write --files');
  return { mode, root, files, stage };
}

const options = parseArgs(process.argv.slice(2));
const ROOT = resolve(
  options.root || process.env.VAULT_SYNC_ROOT || process.env.CLAUDE_PROJECT_DIR || process.cwd(),
);
const CHANGELOG_DIR = resolve(ROOT, VAULT, '_changelog');

// ---------------------------------------------------------------- helpers

function git(args, fallback) {
  try {
    const result = spawnSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const out = result.status === 0 ? (result.stdout || '').trim() : '';
    return out || fallback;
  } catch {
    return fallback;
  }
}

function gitStatus(args) {
  try {
    return spawnSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).status;
  } catch {
    return 1;
  }
}

function utcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function localDate(now = new Date()) {
  const two = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

function forwardSlashes(p) {
  return p.replace(/\\/g, '/');
}

/** Project-relative forward-slash path, or null when missing, outside the project, or inside vault/. */
function projectPath(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const absolute = isAbsolute(raw) ? resolve(raw) : resolve(ROOT, raw);
  const rel = forwardSlashes(relative(ROOT, absolute));
  if (rel === '' || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) return null;
  if (rel === VAULT || rel.startsWith(`${VAULT}/`)) return null;
  return rel;
}

function appendLine(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, text, 'utf8');
}

function readHookInput() {
  let raw;
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    return null;
  }
  while (raw.startsWith(BOM)) raw = raw.slice(1);
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- logging modes

function changelogEntry(rel) {
  const who = `${git(['config', 'user.name'], 'unknown')}@${hostname() || 'unknown'}`;
  const branch = git(
    ['symbolic-ref', '--short', 'HEAD'],
    git(['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown'),
  );
  const why = git(['log', '-1', '--format=%s'], 'unknown');
  // The short ID of HEAD when the recorder ran: the saved version the edit started from.
  const commit = git(['rev-parse', '--short', 'HEAD'], 'unknown');
  appendLine(
    resolve(CHANGELOG_DIR, `${localDate()}.md`),
    `- **when:** ${utcNow()} · **who:** ${who} · **branch:** ${branch}\n` +
      `  **what:** ${rel} · **why (last commit):** ${why} · **commit:** ${commit}\n`,
  );
}

function modeFromHook() {
  const payload = readHookInput();
  if (!payload) return 0;
  // PostToolUse (Edit|Write) carries tool_input.file_path; FileChanged carries a top-level file_path.
  const rel = projectPath(payload.tool_input?.file_path ?? payload.file_path);
  if (!rel) return 0;
  changelogEntry(rel);
  // Task 11: a changed supported spec gets its note refreshed in place. Errors are reported, never fatal.
  if (isSpecPath(rel) && existsSync(resolve(ROOT, rel))) {
    try {
      const outcome = writeNote(rel);
      if (outcome.problems.length) {
        console.error(`vault-sync: note for ${rel} not refreshed: ${outcome.problems.join('; ')}`);
      }
    } catch (err) {
      console.error(`vault-sync: note for ${rel} not refreshed (${err?.message ?? 'error'})`);
    }
  }
  return 0;
}

function modeSessionStart() {
  appendLine(resolve(CHANGELOG_DIR, 'sessions.log'), `- session START ${utcNow()}\n`);
  return 0;
}

function modeSessionEnd() {
  const commit = git(['rev-parse', '--short', 'HEAD'], 'unknown');
  const status = git(['status', '--porcelain', '--untracked-files=all'], '');
  const uncommitted =
    status === '' ? 0 : status.split(/\r?\n/).filter((line) => line.length > 0).length;
  appendLine(
    resolve(CHANGELOG_DIR, 'sessions.log'),
    `- session END ${utcNow()} · commit ${commit} · uncommitted ${uncommitted} file(s)\n`,
  );
  return 0;
}

// ---------------------------------------------------------------- note modes

function isSpecPath(rel) {
  return (
    rel.startsWith(`${TESTS_DIR}/`) &&
    rel.endsWith('.spec.ts') &&
    !rel.split('/').includes('..') &&
    !rel.includes('//')
  );
}

/** Validates a user-supplied spec path. Returns the project-relative path or throws. */
function specPathFromArg(arg) {
  const absolute = isAbsolute(arg) ? resolve(arg) : resolve(ROOT, arg);
  const rel = forwardSlashes(relative(ROOT, absolute));
  if (rel === '' || rel.startsWith('../') || isAbsolute(rel) || !isSpecPath(rel)) {
    throw new Error(
      `unsafe or outside tests/: ${arg} (expected tests/<path>.spec.ts inside the project)`,
    );
  }
  return rel;
}

function notePathFor(specRel) {
  return `${NOTES_DIR}/${specRel.slice(TESTS_DIR.length + 1).replace(/\.spec\.ts$/, '.md')}`;
}

function specPathForNote(noteRel) {
  return `${TESTS_DIR}/${noteRel.slice(NOTES_DIR.length + 1).replace(/\.md$/, '.spec.ts')}`;
}

function walk(dirAbs, matches, out = []) {
  if (!existsSync(dirAbs)) return out;
  for (const name of readdirSync(dirAbs).sort()) {
    const abs = resolve(dirAbs, name);
    if (statSync(abs).isDirectory()) walk(abs, matches, out);
    else if (matches(name)) out.push(forwardSlashes(relative(ROOT, abs)));
  }
  return out;
}

function allSpecs() {
  return walk(resolve(ROOT, TESTS_DIR), (name) => name.endsWith('.spec.ts'));
}

function allManagedNotes() {
  return walk(resolve(ROOT, NOTES_DIR), (name) => name.endsWith('.md')).filter((rel) =>
    readFileSync(resolve(ROOT, rel), 'utf8').includes(START),
  );
}

/** Parses one spec with the installed TypeScript parser. Never executes the spec. */
function analyseSpec(specRel) {
  const ts = require('typescript');
  const text = readFileSync(resolve(ROOT, specRel), 'utf8').replace(/\r\n/g, '\n');
  const sha256 = createHash('sha256').update(text).digest('hex');
  const source = ts.createSourceFile(specRel, text, ts.ScriptTarget.Latest, true);
  const problems = [];
  for (const diagnostic of source.parseDiagnostics ?? []) {
    const { line } = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    problems.push(
      `parse error at line ${line + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`,
    );
  }
  const pageObjects = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const from = statement.moduleSpecifier.text;
    if (!/(^|\/)pages\//.test(from)) continue;
    const bindings = statement.importClause?.namedBindings;
    const names =
      bindings && ts.isNamedImports(bindings) ? bindings.elements.map((e) => e.name.text) : [];
    pageObjects.push({ names, from });
  }
  const titles = [];
  const calleeName = (expression) => {
    if (ts.isIdentifier(expression)) return expression.text;
    if (ts.isPropertyAccessExpression(expression)) {
      const left = calleeName(expression.expression);
      return left ? `${left}.${expression.name.text}` : null;
    }
    return null;
  };
  const visit = (node, depth) => {
    let nextDepth = depth;
    if (ts.isCallExpression(node)) {
      const callee = calleeName(node.expression);
      if (callee === 'test' || callee === 'test.describe') {
        const kind = callee === 'test' ? 'test' : 'describe';
        const first = node.arguments[0];
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
          titles.push({ kind, title: first.text, depth, line: line + 1 });
          if (kind === 'describe') nextDepth = depth + 1;
        } else {
          problems.push(`dynamic title at line ${line + 1}: ${callee}(...) needs a literal string`);
        }
      } else if (callee && callee.startsWith('test.') && !IGNORED_TEST_CALLS.has(callee)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        problems.push(`unsupported wrapper at line ${line + 1}: ${callee}(`);
      }
    }
    ts.forEachChild(node, (child) => visit(child, nextDepth));
  };
  visit(source, 0);
  return { sha256, problems, titles, pageObjects };
}

function generatedBlock(specRel, analysis) {
  const lines = [START, `- source: ${specRel}`, `- sha256: ${analysis.sha256}`, '- parser: ok'];
  if (analysis.titles.length) {
    lines.push('- titles:');
    for (const t of analysis.titles)
      lines.push(`${'  '.repeat(t.depth + 1)}- ${t.kind}: ${t.title}`);
  } else {
    lines.push('- titles: none found');
  }
  if (analysis.pageObjects.length) {
    lines.push(
      `- page objects: ${analysis.pageObjects
        .map((po) => `${po.names.join(', ') || '(default)'} from ${po.from}`)
        .join('; ')}`,
    );
  } else {
    lines.push('- page objects: none');
  }
  lines.push(END);
  return lines.join('\n');
}

function newNote(specRel, block) {
  return [
    `# ${specRel}`,
    '',
    block,
    '',
    '## What this spec checks',
    '',
    '_(not written yet)_',
    '',
    '## Why it matters',
    '',
    '_(not written yet)_',
    '',
    '## Limits',
    '',
    '_(not written yet)_',
    '',
  ].join('\n');
}

/** Splits an existing note around its single generated block. Throws on damaged or repeated markers. */
function splitNote(noteText, noteRel) {
  const starts = noteText.split(START).length - 1;
  const ends = noteText.split(END).length - 1;
  if (starts !== 1 || ends !== 1) {
    throw new Error(
      `damaged markers in ${noteRel}: expected one start and one end marker, found ${starts} and ${ends}`,
    );
  }
  const startIdx = noteText.indexOf(START);
  const endIdx = noteText.indexOf(END);
  if (endIdx < startIdx)
    throw new Error(`damaged markers in ${noteRel}: end marker before start marker`);
  return {
    before: noteText.slice(0, startIdx),
    block: noteText.slice(startIdx, endIdx + END.length),
    after: noteText.slice(endIdx + END.length),
  };
}

/** Computes the refreshed note. Returns { noteRel, problems, exists, changed, text }. */
function renderNote(specRel) {
  const noteRel = notePathFor(specRel);
  const noteAbs = resolve(ROOT, noteRel);
  const analysis = analyseSpec(specRel);
  const result = {
    noteRel,
    problems: analysis.problems,
    exists: existsSync(noteAbs),
    changed: false,
  };
  if (analysis.problems.length) return result;
  let block = generatedBlock(specRel, analysis);
  if (!result.exists) {
    result.text = newNote(specRel, block);
    result.changed = true;
    return result;
  }
  const current = readFileSync(noteAbs, 'utf8');
  if (current.includes('\r\n')) block = block.replace(/\n/g, '\r\n');
  const parts = splitNote(current, noteRel);
  result.text = parts.before + block + parts.after;
  result.changed = result.text !== current;
  return result;
}

function writeNote(specRel) {
  const rendered = renderNote(specRel);
  if (rendered.problems.length || !rendered.changed) return rendered;
  mkdirSync(dirname(resolve(ROOT, rendered.noteRel)), { recursive: true });
  writeFileSync(resolve(ROOT, rendered.noteRel), rendered.text, 'utf8');
  return rendered;
}

/** Staging-safety checks for one spec before any note is written. Returns a list of refusals. */
function stagingProblems(specRel) {
  const noteRel = notePathFor(specRel);
  const refusals = [];
  const staged = git(['diff', '--cached', '--name-only', '--', specRel], '') !== '';
  const partlyUnstaged = git(['diff', '--name-only', '--', specRel], '') !== '';
  if (staged && partlyUnstaged) {
    refusals.push(`${specRel} is partially staged: stage or revert the rest of it first`);
  }
  if (existsSync(resolve(ROOT, noteRel))) {
    const tracked = gitStatus(['ls-files', '--error-unmatch', '--', noteRel]) === 0;
    const stagedNote = git(['diff', '--cached', '--name-only', '--', noteRel], '') !== '';
    if (!tracked && !stagedNote) {
      refusals.push(
        `${noteRel} exists but is untracked: review it and stage it (or remove it) first`,
      );
    } else if (git(['diff', '--name-only', '--', noteRel], '') !== '') {
      refusals.push(`${noteRel} has unstaged edits: stage or revert them before the refresh`);
    }
  }
  return refusals;
}

function modeWrite() {
  let specs;
  try {
    specs = options.files ? options.files.map(specPathFromArg) : allSpecs();
  } catch (err) {
    console.error(`vault-sync: ${err.message}`);
    return 1;
  }
  let failed = false;
  if (options.stage) {
    const refusals = specs.filter((s) => existsSync(resolve(ROOT, s))).flatMap(stagingProblems);
    if (refusals.length) {
      console.error('vault-sync: staging-safety check refused before any write:');
      for (const r of refusals) console.error(`  - ${r}`);
      return 1;
    }
  }
  const toStage = [];
  for (const specRel of specs) {
    const noteRel = notePathFor(specRel);
    if (!existsSync(resolve(ROOT, specRel))) {
      if (
        existsSync(resolve(ROOT, noteRel)) &&
        readFileSync(resolve(ROOT, noteRel), 'utf8').includes(START)
      ) {
        console.error(
          `vault-sync: DELETED SOURCE ${specRel}: its managed note ${noteRel} still exists. Review it, then remove it or archive it outside ${NOTES_DIR}/ and stage that change. Nothing was erased.`,
        );
        failed = true;
      } else {
        console.log(`vault-sync: ok, deleted ${specRel} has no managed note`);
      }
      continue;
    }
    let outcome;
    try {
      outcome = writeNote(specRel);
    } catch (err) {
      console.error(`vault-sync: ${err.message}`);
      failed = true;
      continue;
    }
    if (outcome.problems.length) {
      console.error(`vault-sync: ${specRel} not written: ${outcome.problems.join('; ')}`);
      failed = true;
      continue;
    }
    const verb = outcome.changed ? (outcome.exists ? 'updated' : 'created') : 'unchanged';
    console.log(`vault-sync: ${verb} ${outcome.noteRel}`);
    toStage.push(outcome.noteRel);
  }
  if (options.stage && toStage.length) {
    const status = gitStatus(['add', '--', ...toStage]);
    if (status !== 0) {
      console.error('vault-sync: could not stage the refreshed notes');
      return 1;
    }
    console.log(`vault-sync: staged ${toStage.length} note(s)`);
  }
  return failed ? 1 : 0;
}

function modeCheck() {
  let specs;
  try {
    specs = options.files ? options.files.map(specPathFromArg) : allSpecs();
  } catch (err) {
    console.error(`vault-sync: ${err.message}`);
    return 1;
  }
  const findings = [];
  let fresh = 0;
  for (const specRel of specs) {
    const noteRel = notePathFor(specRel);
    if (!existsSync(resolve(ROOT, specRel))) {
      if (existsSync(resolve(ROOT, noteRel)))
        findings.push(`NO SOURCE ${noteRel} (${specRel} is gone)`);
      continue;
    }
    if (!existsSync(resolve(ROOT, noteRel))) {
      findings.push(`MISSING ${noteRel} (for ${specRel})`);
      continue;
    }
    let rendered;
    try {
      rendered = renderNote(specRel);
    } catch (err) {
      findings.push(`INVALID ${err.message}`);
      continue;
    }
    if (rendered.problems.length)
      findings.push(`UNSUPPORTED ${specRel}: ${rendered.problems.join('; ')}`);
    else if (rendered.changed) findings.push(`STALE ${noteRel} (source ${specRel} changed)`);
    else fresh += 1;
  }
  if (!options.files) {
    for (const noteRel of allManagedNotes()) {
      if (!existsSync(resolve(ROOT, specPathForNote(noteRel))))
        findings.push(`NO SOURCE ${noteRel}`);
    }
  }
  for (const f of findings) console.error(`vault-sync: ${f}`);
  console.log(`vault-sync: ${fresh} note(s) fresh, ${findings.length} problem(s)`);
  return findings.length ? 1 : 0;
}

// ---------------------------------------------------------------- main

const handlers = {
  '--from-hook': modeFromHook,
  '--session-start': modeSessionStart,
  '--session-end': modeSessionEnd,
  '--write': modeWrite,
  '--check': modeCheck,
};
const loggingMode = ['--from-hook', '--session-start', '--session-end'].includes(options.mode);
try {
  process.exit(handlers[options.mode]());
} catch (err) {
  if (loggingMode) {
    console.error(
      `vault-sync: ${options.mode} could not write its record (${err?.code ?? 'error'})`,
    );
    process.exit(0);
  }
  console.error(`vault-sync: ${err?.message ?? err}`);
  process.exit(1);
}
