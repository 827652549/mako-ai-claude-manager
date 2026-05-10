import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/** Root directory of Claude Code configuration */
const CLAUDE_DIR = path.join(os.homedir(), '.claude');

/** Keywords that indicate a sensitive environment variable */
const SENSITIVE_KEY_PATTERNS = [
  'TOKEN', 'KEY', 'SECRET', 'PASSWORD', 'AUTH',
];

/** Value prefixes that indicate a sensitive token */
const SENSITIVE_VALUE_PREFIXES = ['tp-', 'sk-', 'lin_api_'];

/**
 * Sanitize an environment value if it is considered sensitive.
 *
 * @param key - The environment variable name
 * @param value - The environment variable value
 * @returns The original value or `'****'` if sensitive
 */
function sanitizeEnvValue(key: string, value: string): string {
  const upperKey = key.toUpperCase();
  const isKeySensitive = SENSITIVE_KEY_PATTERNS.some(
    (pattern) => upperKey.includes(pattern),
  );
  if (isKeySensitive) {
    return '****';
  }

  const isValueSensitive = SENSITIVE_VALUE_PREFIXES.some(
    (prefix) => value.toLowerCase().startsWith(prefix),
  );
  if (isValueSensitive) {
    return '****';
  }

  return value;
}

/**
 * Safely read and parse a JSON file.
 *
 * @param filePath - Absolute path to the JSON file
 * @returns Parsed object, or `null` if the file does not exist or is invalid
 */
async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

/** Desensitized Claude global settings */
export interface ClaudeSettings {
  model: string;
  permissions: { defaultMode: string };
  enabledPlugins: Record<string, boolean>;
  /** Environment variables with sensitive values masked */
  env: Record<string, string>;
  language?: string;
  voiceEnabled?: boolean;
  skipDangerousModePermissionPrompt?: boolean;
  skipAutoPermissionPrompt?: boolean;
  hasCompletedOnboarding?: boolean;
  [key: string]: unknown;
}

/** Claude local (per-user) settings */
export interface ClaudeLocalSettings {
  permissions: { allow: string[] };
  outputStyle?: string;
  [key: string]: unknown;
}

/** Information about a single agent definition */
export interface AgentInfo {
  /** Agent name derived from filename (without extension) */
  name: string;
  filename: string;
  content: string;
}

/** Information about a single skill */
export interface SkillInfo {
  /** Skill name derived from directory name */
  name: string;
  content: string;
  /** Whether this skill entry is a symbolic link */
  isSymlink: boolean;
  /** Resolved target path for symlinks, or undefined for real directories */
  targetPath?: string;
}

/** Information about a project rule file */
export interface RuleInfo {
  filename: string;
  content: string;
}

/** A node in the directory tree */
export interface DirectoryNode {
  name: string;
  type: 'file' | 'directory';
  children?: DirectoryNode[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read Claude global settings from `~/.claude/settings.json`.
 *
 * Sensitive values in the `env` object are masked according to:
 * - Keys containing TOKEN, KEY, SECRET, PASSWORD, or AUTH (case-insensitive)
 * - Values starting with `tp-`, `sk-`, or `lin_api_`
 *
 * @returns Sanitized settings object, or a default structure if the file is
 *          missing
 */
export async function readClaudeSettings(): Promise<ClaudeSettings> {
  const filePath = path.join(CLAUDE_DIR, 'settings.json');
  const raw = await readJsonFile<Record<string, unknown>>(filePath);

  if (!raw) {
    return {
      model: '',
      permissions: { defaultMode: '' },
      enabledPlugins: {},
      env: {},
    };
  }

  const rawEnv = (raw.env ?? {}) as Record<string, string>;
  const sanitizedEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawEnv)) {
    sanitizedEnv[key] =
      typeof value === 'string'
        ? sanitizeEnvValue(key, value)
        : String(value);
  }

  return {
    model: typeof raw.model === 'string' ? raw.model : '',
    permissions:
      typeof raw.permissions === 'object' && raw.permissions !== null
        ? (raw.permissions as { defaultMode: string })
        : { defaultMode: '' },
    enabledPlugins:
      typeof raw.enabledPlugins === 'object' && raw.enabledPlugins !== null
        ? (raw.enabledPlugins as Record<string, boolean>)
        : {},
    env: sanitizedEnv,
    ...(typeof raw.language === 'string'
      ? { language: raw.language }
      : {}),
    ...(typeof raw.voiceEnabled === 'boolean'
      ? { voiceEnabled: raw.voiceEnabled }
      : {}),
    ...(typeof raw.skipDangerousModePermissionPrompt === 'boolean'
      ? {
          skipDangerousModePermissionPrompt:
            raw.skipDangerousModePermissionPrompt,
        }
      : {}),
    ...(typeof raw.skipAutoPermissionPrompt === 'boolean'
      ? { skipAutoPermissionPrompt: raw.skipAutoPermissionPrompt }
      : {}),
    ...(typeof raw.hasCompletedOnboarding === 'boolean'
      ? { hasCompletedOnboarding: raw.hasCompletedOnboarding }
      : {}),
  };
}

/**
 * Read Claude local settings from `~/.claude/settings.local.json`.
 *
 * @returns Local settings object, or a default structure if the file is
 *          missing
 */
export async function readClaudeLocalSettings(): Promise<ClaudeLocalSettings> {
  const filePath = path.join(CLAUDE_DIR, 'settings.local.json');
  const raw = await readJsonFile<Record<string, unknown>>(filePath);

  if (!raw) {
    return { permissions: { allow: [] } };
  }

  const permissions =
    typeof raw.permissions === 'object' && raw.permissions !== null
      ? (raw.permissions as { allow?: unknown })
      : undefined;

  const allow =
    Array.isArray(permissions?.allow)
      ? (permissions!.allow as string[])
      : [];

  return {
    permissions: { allow },
    ...(typeof raw.outputStyle === 'string'
      ? { outputStyle: raw.outputStyle }
      : {}),
  };
}

/**
 * Read the global `~/.claude/CLAUDE.md` memory file.
 *
 * @returns File contents as a string, or empty string if missing
 */
export async function readClaudeMd(): Promise<string> {
  const filePath = path.join(CLAUDE_DIR, 'CLAUDE.md');
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Read all agent definition files from `~/.claude/agents/`.
 *
 * Each `.md` file is treated as an agent definition. The agent name is
 * derived from the filename without the `.md` extension.
 *
 * @returns Array of agent info objects
 */
export async function readAgents(): Promise<AgentInfo[]> {
  const agentsDir = path.join(CLAUDE_DIR, 'agents');
  const results: AgentInfo[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(agentsDir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.md')) {
      continue;
    }

    const filePath = path.join(agentsDir, entry);
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        continue;
      }
      const content = await fs.readFile(filePath, 'utf-8');
      results.push({
        name: entry.replace(/\.md$/, ''),
        filename: entry,
        content,
      });
    } catch {
      // Skip unreadable files
    }
  }

  return results;
}

/**
 * Read all skill definitions from `~/.claude/skills/`.
 *
 * Handles two kinds of entries:
 * 1. **Symbolic links** — resolved to the real path; if the target does not
 *    exist the skill is still returned but with empty content.
 * 2. **Real directories** — reads `SKILL.md` (or any `.md` file) directly.
 *
 * @returns Array of skill info objects
 */
export async function readSkills(): Promise<SkillInfo[]> {
  const skillsDir = path.join(CLAUDE_DIR, 'skills');
  const results: SkillInfo[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(skillsDir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    const entryPath = path.join(skillsDir, entry);

    let isSymlink = false;
    let targetPath: string | undefined;
    let realPath: string;

    try {
      const lstat = await fs.lstat(entryPath);
      isSymlink = lstat.isSymbolicLink();

      if (isSymlink) {
        targetPath = await fs.readlink(entryPath);
        try {
          realPath = await fs.realpath(entryPath);
        } catch {
          // Symlink target does not exist
          results.push({
            name: entry,
            content: '',
            isSymlink: true,
            targetPath,
          });
          continue;
        }
      } else if (lstat.isDirectory()) {
        realPath = entryPath;
      } else {
        continue; // Skip non-directory entries
      }
    } catch {
      continue;
    }

    // Read SKILL.md or any .md file from the resolved directory
    const content = await readSkillContent(realPath);
    results.push({
      name: entry,
      content,
      isSymlink,
      ...(targetPath !== undefined ? { targetPath } : {}),
    });
  }

  return results;
}

/**
 * Read project-level rules from the `.claude/rules/` directory relative to
 * the current working directory.
 *
 * @returns Array of rule info objects
 */
export async function readProjectRules(): Promise<RuleInfo[]> {
  const rulesDir = path.join(process.cwd(), '.claude', 'rules');
  const results: RuleInfo[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(rulesDir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.md')) {
      continue;
    }

    const filePath = path.join(rulesDir, entry);
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        continue;
      }
      const content = await fs.readFile(filePath, 'utf-8');
      results.push({ filename: entry, content });
    } catch {
      // Skip unreadable files
    }
  }

  return results;
}

/**
 * Generate a directory tree representation of `~/.claude/`.
 *
 * The scan depth is limited to `maxDepth` levels (default 3). Special
 * directories that may contain large amounts of data (sessions, cache,
 * history, etc.) are included as leaf nodes without recursion.
 *
 * @param maxDepth - Maximum recursion depth (default: 3)
 * @returns Root-level directory nodes
 */
export async function getDirectoryTree(
  maxDepth: number = 3,
): Promise<DirectoryNode[]> {
  return scanDirectory(CLAUDE_DIR, maxDepth, 0);
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Read the content of a skill from a resolved directory path.
 * Prefers `SKILL.md`; falls back to the first `.md` file found.
 *
 * @param dirPath - Resolved absolute path to the skill directory
 * @returns Markdown content, or empty string if nothing found
 */
async function readSkillContent(dirPath: string): Promise<string> {
  const skillMd = path.join(dirPath, 'SKILL.md');
  try {
    return await fs.readFile(skillMd, 'utf-8');
  } catch {
    // SKILL.md not found; try any .md file
  }

  try {
    const entries = await fs.readdir(dirPath);
    for (const entry of entries) {
      if (entry.endsWith('.md') && entry !== 'SKILL.md') {
        const filePath = path.join(dirPath, entry);
        return await fs.readFile(filePath, 'utf-8');
      }
    }
  } catch {
    // Directory not readable
  }

  return '';
}

/**
 * Recursively scan a directory and build a tree of nodes.
 *
 * @param dirPath - Absolute directory path to scan
 * @param maxDepth - Maximum allowed depth
 * @param currentDepth - Current recursion depth
 * @returns Array of directory nodes at this level
 */
async function scanDirectory(
  dirPath: string,
  maxDepth: number,
  currentDepth: number,
): Promise<DirectoryNode[]> {
  if (currentDepth >= maxDepth) {
    return [];
  }

  const nodes: DirectoryNode[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(dirPath);
  } catch {
    return nodes;
  }

  for (const entry of entries) {
    // Skip hidden files / directories (e.g. .DS_Store, .idea)
    if (entry.startsWith('.')) {
      continue;
    }

    const entryPath = path.join(dirPath, entry);

    try {
      const stat = await fs.lstat(entryPath);

      if (stat.isDirectory()) {
        const children =
          currentDepth + 1 < maxDepth
            ? await scanDirectory(entryPath, maxDepth, currentDepth + 1)
            : undefined;

        nodes.push({
          name: entry,
          type: 'directory',
          ...(children !== undefined ? { children } : {}),
        });
      } else if (stat.isFile()) {
        nodes.push({ name: entry, type: 'file' });
      }
      // Skip symlinks to non-existent targets (lstat won't throw, but we
      // simply don't represent broken symlinks in the tree)
    } catch {
      // Skip entries that cannot be stat'd
    }
  }

  return nodes;
}
