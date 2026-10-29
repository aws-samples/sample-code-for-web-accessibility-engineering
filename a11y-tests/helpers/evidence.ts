/**
 * Evidence helpers for the a11y-audit-remediation spec.
 *
 * Writes every test/run artefact under
 *   .kiro/specs/a11y-audit-remediation/evidence/<phase>/
 * where <phase> comes from the EVIDENCE_PHASE env var (`baseline` | `after`, default `after`).
 *
 * Requirements: 5.2, 8.7, 9.5, 13.4, 15.5
 *
 * Note: the project has no @types/node and must not add dependencies, so Node built-ins are
 * loaded through `process.getBuiltinModule` (Node >= 20.16 / 22.3) and typed with the minimal
 * local interfaces below. The local `process` declaration is module-scoped and does not leak.
 */

// ---------------------------------------------------------------------------
// Minimal Node typings (module-local, only what this file uses)
// ---------------------------------------------------------------------------

interface NodeFs {
  mkdirSync(path: string, options: { recursive: true }): unknown;
  writeFileSync(path: string, data: string, encoding: 'utf8'): void;
  appendFileSync(path: string, data: string, encoding: 'utf8'): void;
  existsSync(path: string): boolean;
}
interface NodePath {
  join(...parts: string[]): string;
  resolve(...parts: string[]): string;
  dirname(path: string): string;
  relative(from: string, to: string): string;
}
interface NodeOs {
  type(): string;
  release(): string;
  arch(): string;
}
interface NodeChildProcess {
  execFileSync(
    file: string,
    args: string[],
    options: { encoding: 'utf8'; stdio: ['ignore', 'pipe', 'ignore']; cwd?: string },
  ): string;
}
declare const process: {
  env: Record<string, string | undefined>;
  version: string;
  platform: string;
  cwd(): string;
  getBuiltinModule(id: 'node:fs'): NodeFs;
  getBuiltinModule(id: 'node:path'): NodePath;
  getBuiltinModule(id: 'node:os'): NodeOs;
  getBuiltinModule(id: 'node:child_process'): NodeChildProcess;
};

const fs = process.getBuiltinModule('node:fs');
const path = process.getBuiltinModule('node:path');
const os = process.getBuiltinModule('node:os');
const childProcess = process.getBuiltinModule('node:child_process');

// ---------------------------------------------------------------------------
// Phase & directory resolution
// ---------------------------------------------------------------------------

export type EvidencePhase = 'baseline' | 'after';

/** Spec evidence root, relative to the workspace root. */
export const EVIDENCE_ROOT_REL = '.kiro/specs/a11y-audit-remediation/evidence';

/** Reads EVIDENCE_PHASE; defaults to `after`. Any other value is rejected so typos don't silently write to `after/`. */
export function getPhase(): EvidencePhase {
  const raw = (process.env.EVIDENCE_PHASE ?? '').trim().toLowerCase();
  if (raw === '' || raw === 'after') return 'after';
  if (raw === 'baseline') return 'baseline';
  throw new Error(`EVIDENCE_PHASE must be "baseline" or "after", got "${process.env.EVIDENCE_PHASE}"`);
}

/** Workspace root: Playwright and npm scripts run from the project root (where playwright.config.ts lives). */
export function workspaceRoot(): string {
  return process.cwd();
}

/** Absolute path of the Evidence_Dir root (shared, phase-independent files live here). */
export function evidenceRoot(): string {
  return path.resolve(workspaceRoot(), EVIDENCE_ROOT_REL);
}

/** Absolute path of `<Evidence_Dir>/<phase>/`, created if missing. */
export function phaseDir(phase: EvidencePhase = getPhase()): string {
  const dir = path.join(evidenceRoot(), phase);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Resolves a file name inside the current phase dir, creating parent dirs. Rejects paths escaping the phase dir. */
export function evidencePath(fileName: string, phase: EvidencePhase = getPhase()): string {
  const base = phaseDir(phase);
  const full = path.resolve(base, fileName);
  const rel = path.relative(base, full);
  if (rel === '' || rel.startsWith('..') || path.resolve(rel) === rel) {
    throw new Error(`evidence file must stay inside ${base}: ${fileName}`);
  }
  fs.mkdirSync(path.dirname(full), { recursive: true });
  return full;
}

// ---------------------------------------------------------------------------
// Generic writers
// ---------------------------------------------------------------------------

/** Writes pretty-printed JSON (2-space indent, trailing newline). Returns the absolute path. */
export function writeJson(fileName: string, data: unknown): string {
  const file = evidencePath(fileName);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return file;
}

/** Overwrites a text file. Returns the absolute path. */
export function writeText(fileName: string, text: string): string {
  const file = evidencePath(fileName);
  fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  return file;
}

/**
 * Truncates (or creates) a log file. Call once at test start so retries / re-runs don't
 * accumulate stale lines. Optional header lines are written first (e.g. date + src state, Req 15.5).
 */
export function resetLog(fileName: string, headerLines: string[] = []): string {
  const file = evidencePath(fileName);
  fs.writeFileSync(file, headerLines.map((l) => `${l}\n`).join(''), 'utf8');
  return file;
}

/** Appends one or more lines (newline-terminated) to a log file, creating it if needed. */
export function appendLog(fileName: string, ...lines: string[]): string {
  const file = evidencePath(fileName);
  fs.appendFileSync(file, lines.map((l) => `${l}\n`).join(''), 'utf8');
  return file;
}

/** Standard log header: phase, run date, src/ state (Req 15.5). */
export function logHeader(srcState: SrcState, title?: string): string[] {
  return [
    ...(title ? [`# ${title}`] : []),
    `# phase: ${getPhase()}`,
    `# run date: ${runDate()}`,
    `# src state: ${describeSrcState(srcState)}`,
  ];
}

// ---------------------------------------------------------------------------
// Screenshots
// ---------------------------------------------------------------------------

/**
 * `focus-screenshots/NN-<name>.png` in the current phase dir (dir auto-created).
 * `step` is 1-based (1..99); `name` is normalised to lowercase kebab-case.
 */
export function screenshotPath(step: number, name: string): string {
  if (!Number.isInteger(step) || step < 1 || step > 99) {
    throw new Error(`screenshot step must be an integer 1..99, got ${step}`);
  }
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug === '') throw new Error(`screenshot name is empty after normalisation: "${name}"`);
  return evidencePath(`focus-screenshots/${String(step).padStart(2, '0')}-${slug}.png`);
}

// ---------------------------------------------------------------------------
// src/ state & .meta.md
// ---------------------------------------------------------------------------

/** Statement required by Req 13.4 when no git hash is available. */
export const BASELINE_EQUIVALENT_STATEMENT = '`src/` 与 `reference/baseline/` 逐文件一致';

export type SrcState =
  | { kind: 'git'; shortHash: string }
  | { kind: 'baseline-equivalent' }
  | { kind: 'description'; text: string };

export function describeSrcState(state: SrcState): string {
  switch (state.kind) {
    case 'git':
      if (!/^[0-9a-f]{7,40}$/i.test(state.shortHash)) {
        throw new Error(`git short hash must be >= 7 hex chars, got "${state.shortHash}"`);
      }
      return `Git 提交 ${state.shortHash}`;
    case 'baseline-equivalent':
      return BASELINE_EQUIVALENT_STATEMENT;
    case 'description':
      if (state.text.trim() === '') throw new Error('src state description must not be empty');
      return state.text.trim();
  }
}

/** Best-effort `git rev-parse --short HEAD`; returns null when not a git repo or git is unavailable. */
export function gitSrcState(): SrcState | null {
  try {
    const out = childProcess
      .execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        cwd: workspaceRoot(),
      })
      .trim();
    return /^[0-9a-f]{7,40}$/i.test(out) ? { kind: 'git', shortHash: out } : null;
  } catch {
    return null;
  }
}

/**
 * src/ state for the current run: EVIDENCE_SRC_STATE env (operator declaration) wins,
 * then git, then — only in the baseline phase — the baseline-equivalence statement.
 * In the `after` phase without git or env, returns null so the caller must decide explicitly.
 */
export function resolveSrcState(): SrcState | null {
  const declared = process.env.EVIDENCE_SRC_STATE?.trim();
  if (declared) {
    return declared === 'baseline-equivalent' ? { kind: 'baseline-equivalent' } : { kind: 'description', text: declared };
  }
  return gitSrcState() ?? (getPhase() === 'baseline' ? { kind: 'baseline-equivalent' } : null);
}

/** Local date as YYYY-MM-DD. */
export function runDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** e.g. "macOS 26.7.2 (Build 25G332), Darwin 25.6.0 arm64"; falls back to os.type/release on non-macOS. */
export function osDescription(): string {
  const kernel = `${os.type()} ${os.release()} ${os.arch()}`;
  if (process.platform !== 'darwin') return kernel;
  try {
    const run = (flag: string) =>
      childProcess.execFileSync('sw_vers', [flag], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return `macOS ${run('-productVersion')} (Build ${run('-buildVersion')}), ${kernel}`;
  } catch {
    return kernel;
  }
}

export type MetaInput = {
  /** Meta file name, e.g. `axe-report.meta.md` (`.meta.md` appended if missing). */
  fileName: string;
  /** Title line (defaults to the file name). */
  title?: string;
  /** Command that produced the artefact. */
  command: string;
  /** Exit code of that command (use `null` + `extra` if not applicable). */
  exitCode: number | null;
  /** Caller-provided src/ state; no hard dependency on git. */
  srcState: SrcState;
  /** Extra rows, e.g. { 'Axe_Scanner 版本': '4.13.0', '标签集': 'wcag2a, …' } (Req 5.2). */
  extra?: Record<string, string>;
  /** Optional free-form markdown appended after the table. */
  notes?: string;
  /** Override run date (defaults to today, local time). */
  date?: Date;
};

const escapeCell = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' / ');

/** Builds the unified `.meta.md` content (Req 13.4 / 15.5 fields + optional extras). */
export function formatMeta(input: MetaInput): string {
  const rows: [string, string][] = [
    ['运行日期', runDate(input.date)],
    ['操作系统', osDescription()],
    ['Node 版本', process.version],
    ['src/ 状态标识', describeSrcState(input.srcState)],
    ['阶段', getPhase()],
    ['命令', `\`${input.command}\``],
    ['退出码', input.exitCode === null ? '不适用' : String(input.exitCode)],
    ...Object.entries(input.extra ?? {}),
  ];
  const fileName = input.fileName.endsWith('.meta.md') ? input.fileName : `${input.fileName}.meta.md`;
  return [
    `# ${input.title ?? fileName}`,
    '| 字段 | 值 |',
    '| --- | --- |',
    ...rows.map(([k, v]) => `| ${escapeCell(k)} | ${escapeCell(v)} |`),
    ...(input.notes ? ['', input.notes.trim()] : []),
    '',
  ].join('\n');
}

/** Writes `<phase>/<name>.meta.md`. Returns the absolute path. */
export function writeMeta(input: MetaInput): string {
  const fileName = input.fileName.endsWith('.meta.md') ? input.fileName : `${input.fileName}.meta.md`;
  const file = evidencePath(fileName);
  fs.writeFileSync(file, formatMeta(input), 'utf8');
  return file;
}

// ---------------------------------------------------------------------------
// Structured log lines (Req 8.7 / 9.5)
// ---------------------------------------------------------------------------

/** Req 8.7 — one dynamic-state assertion. */
export type StateAssertion = {
  step: string;
  keys: string[];
  kind: 'aria-current' | 'aria-expanded' | 'value' | 'focus';
  expected: string;
  actual: string;
  pass: boolean;
};

/** Req 9.5 — one forced-colors check on a computed-style snapshot. */
export type ForcedColorCheck = {
  selector: string;
  borderWidth: string;
  outlineWidth: string;
  color: string;
  backgroundColor: string;
  /** `visible-icon`: svg visible and its color/fill differs from the host background (Req 9.2, 9.4). */
  criterion: 'visible-boundary' | 'visible-text' | 'visible-icon' | 'distinguishable-bar';
  pass: boolean;
};

export const STATE_ASSERTIONS_LOG = 'state-assertions.log';
export const FORCED_COLORS_LOG = 'forced-colors-assertions.log';

const q = (s: string) => JSON.stringify(s);
const verdict = (pass: boolean) => (pass ? 'PASS' : 'FAIL');

/**
 * `[PASS] step="…" keys=[Enter,ArrowDown,Enter] kind=value expected="North" actual="North"`
 * Strings are JSON-quoted so spaces / quotes stay unambiguous; empty key list renders as `keys=[]`.
 */
export function formatStateAssertion(a: StateAssertion): string {
  return `[${verdict(a.pass)}] step=${q(a.step)} keys=[${a.keys.join(',')}] kind=${a.kind} expected=${q(a.expected)} actual=${q(a.actual)}`;
}

/**
 * `[PASS] selector=".icon-btn" criterion=visible-boundary border-width=1px outline-width=0px color="rgb(…)" background-color="rgb(…)"`
 */
export function formatForcedColorCheck(c: ForcedColorCheck): string {
  return (
    `[${verdict(c.pass)}] selector=${q(c.selector)} criterion=${c.criterion} ` +
    `border-width=${c.borderWidth} outline-width=${c.outlineWidth} ` +
    `color=${q(c.color)} background-color=${q(c.backgroundColor)}`
  );
}

export function appendStateAssertion(a: StateAssertion, fileName: string = STATE_ASSERTIONS_LOG): string {
  return appendLog(fileName, formatStateAssertion(a));
}

export function appendForcedColorCheck(c: ForcedColorCheck, fileName: string = FORCED_COLORS_LOG): string {
  return appendLog(fileName, formatForcedColorCheck(c));
}
