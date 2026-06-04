// Koder Agent 工具定义与执行器
// 提供 6 个内置工具：read_file, write_file, list_dir, shell, grep, glob

import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { AgentConfig } from '../shared/ipc.js';
import { globalToolCache } from './tool-cache.js';

const execAsync = promisify(exec);

// 跟踪当前 agent run 中已写入的文件，避免重复创建快照
const writtenFilePaths = new Set<string>();
export function resetWrittenFileTracking(): void {
  writtenFilePaths.clear();
}

/** 每轮 agent run 开始时根据配置初始化工具缓存 */
export function configureToolCache(config: AgentConfig): void {
  globalToolCache.configure({
    enabled: config.toolCacheEnabled ?? true,
    maxEntries: config.toolCacheMaxEntries ?? 300,
    ttlMs: config.toolCacheTtlMs ?? 300000,
  });
  globalToolCache.resetStats();
}

// ---- 工具定义（OpenAI function calling 格式） ----

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: 'Read the contents of a file at the given path. Returns the file content as a string.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path to read' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description: 'Write content to a file. Creates the file if it does not exist, overwrites if it does. Creates parent directories as needed.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path to write' },
          content: { type: 'string', description: 'The content to write to the file' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_dir',
      description: 'List the contents of a directory. Returns file names, types, and sizes.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'shell',
      description: 'Execute a shell command and return stdout/stderr output. Use for git operations, running scripts, installing packages, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          cwd: { type: 'string', description: 'Working directory for the command (optional)' },
          timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'grep',
      description: 'Search for a pattern in files within a directory. Returns matching lines with file paths and line numbers.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regular expression pattern to search for' },
          path: { type: 'string', description: 'Directory to search in' },
          include: { type: 'string', description: 'File glob pattern to filter (e.g. "*.ts", "*.py")' },
        },
        required: ['pattern', 'path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'glob',
      description: 'Find files matching a glob pattern. Returns a list of matching file paths.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g. "**/*.ts", "src/**/*.tsx")' },
          path: { type: 'string', description: 'Base directory to search from' },
        },
        required: ['pattern', 'path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'insert_code',
      description: 'Surgically insert or replace code in an existing file at a specific location. Uses a unique text anchor (a code fragment like function signature, variable name, or comment) to locate the position. PREFER THIS over write_file when modifying existing code — it avoids rewriting the entire file, reduces token usage by the model, and prevents content truncation errors.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path' },
          anchor: { type: 'string', description: 'A unique text fragment in the file to locate the operation position. Must match exactly one line. Use a function signature, variable declaration, import statement, or comment as anchor.' },
          action: { type: 'string', enum: ['insert_before', 'insert_after', 'replace'], description: 'insert_before: insert new code before the anchor line. insert_after: insert new code after the anchor line. replace: replace the anchor line (and optionally additional lines after it) with new code.' },
          content: { type: 'string', description: 'The code content to insert or the replacement code' },
          replaceLines: { type: 'number', description: 'When action=replace, how many ADDITIONAL lines after the anchor line to replace (0 = only the anchor line itself, 1 = anchor + 1 line below, etc.). Default 0.' },
        },
        required: ['path', 'anchor', 'action', 'content'],
      },
    },
  },
];

// ---- 工具执行器 ----

function resolvePath(p: string, cwd: string): string {
  return path.isAbsolute(p) ? p : path.resolve(cwd, p);
}

async function toolReadFile(args: { path: string }, cwd: string): Promise<string> {
  const fullPath = resolvePath(args.path, cwd);
  if (!fs.existsSync(fullPath)) {
    return `Error: File not found: ${fullPath}`;
  }
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    return `Error: ${fullPath} is a directory, not a file`;
  }
  if (stat.size > 500_000) {
    return `Error: File too large (${stat.size} bytes). Max 500KB.`;
  }
  return fs.readFileSync(fullPath, 'utf8');
}

async function toolWriteFile(args: { path: string; content: string }, cwd: string): Promise<string> {
  const fullPath = resolvePath(args.path, cwd);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, args.content, 'utf8');
  const lineCount = args.content ? args.content.split('\n').length : 0;
  return `File written: ${fullPath} (${lineCount} lines, ${args.content.length} bytes)`;
}

/**
 * 精确保留代码插入/替换工具
 * 在已有文件中通过锚点文本定位，支持插入前、插入后、替换三种操作
 */
async function toolInsertCode(
  args: { path: string; anchor: string; action: 'insert_before' | 'insert_after' | 'replace'; content: string; replaceLines?: number },
  cwd: string,
): Promise<string> {
  const fullPath = resolvePath(args.path, cwd);
  if (!fs.existsSync(fullPath)) {
    return `Error: File not found: ${fullPath}`;
  }
  if (fs.statSync(fullPath).isDirectory()) {
    return `Error: ${fullPath} is a directory`;
  }

  const original = fs.readFileSync(fullPath, 'utf8');
  const lines = original.split('\n');

  // 查找锚点行（第一个匹配的行）
  const anchorIdx = lines.findIndex(line => line.includes(args.anchor));
  if (anchorIdx === -1) {
    return `Error: Anchor text not found in file: "${args.anchor}"`;
  }

  const insertLines = args.content.split('\n');

  switch (args.action) {
    case 'insert_before': {
      lines.splice(anchorIdx, 0, ...insertLines);
      break;
    }
    case 'insert_after': {
      lines.splice(anchorIdx + 1, 0, ...insertLines);
      break;
    }
    case 'replace': {
      const replaceCount = (args.replaceLines ?? 0);
      // replaceCount 表示锚点行之后额外替换的行数（0=仅锚点行）
      const totalReplace = Math.min(replaceCount + 1, lines.length - anchorIdx);
      lines.splice(anchorIdx, totalReplace, ...insertLines);
      break;
    }
    default:
      return `Error: Unknown action: ${args.action}`;
  }

  const newContent = lines.join('\n');
  fs.writeFileSync(fullPath, newContent, 'utf8');

  const insertLineCount = insertLines.length;
  const newLineCount = newContent.split('\n').length;
  const actionLabel: Record<string, string> = {
    insert_before: '前插入',
    insert_after: '后插入',
    replace: '替换',
  };
  return `Code ${actionLabel[args.action] ?? args.action}: ${fullPath} (${insertLineCount} lines changed, file now ${newLineCount} lines, anchor line ${anchorIdx + 1})`;
}

async function toolListDir(args: { path: string }, cwd: string): Promise<string> {
  const fullPath = resolvePath(args.path, cwd);
  if (!fs.existsSync(fullPath)) {
    return `Error: Directory not found: ${fullPath}`;
  }
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  const lines = entries
    .filter((e) => !e.name.startsWith('.'))
    .map((e) => {
      const isDir = e.isDirectory();
      let size = '';
      if (!isDir) {
        try {
          const s = fs.statSync(path.join(fullPath, e.name)).size;
          size = s < 1024 ? `${s}B` : s < 1024 * 1024 ? `${(s / 1024).toFixed(1)}KB` : `${(s / (1024 * 1024)).toFixed(1)}MB`;
        } catch { /* ignore */ }
      }
      return `${isDir ? '[DIR] ' : '      '}${e.name}${size ? `  (${size})` : ''}`;
    })
    .sort();
  return lines.join('\n') || '(empty directory)';
}

async function toolShell(args: { command: string; cwd?: string; timeout?: number }, cwd: string): Promise<string> {
  const workDir = args.cwd ? resolvePath(args.cwd, cwd) : cwd;
  const timeout = args.timeout || 30000;
  try {
    const { stdout, stderr } = await execAsync(args.command, {
      cwd: workDir,
      timeout,
      maxBuffer: 1024 * 1024,
    });
    let result = '';
    if (stdout) result += stdout;
    if (stderr) result += (result ? '\n[stderr]\n' : '') + stderr;
    return result || '(no output)';
  } catch (err: any) {
    const msg = err.stderr || err.stdout || err.message || String(err);
    return `Error (exit code ${err.code ?? '?'}): ${msg}`;
  }
}

async function toolGrep(args: { pattern: string; path: string; include?: string }, cwd: string): Promise<string> {
  const searchDir = resolvePath(args.path, cwd);
  if (!fs.existsSync(searchDir)) {
    return `Error: Directory not found: ${searchDir}`;
  }
  const regex = new RegExp(args.pattern, 'gi');
  const results: string[] = [];
  const maxResults = 100;

  function searchInDir(dir: string): void {
    if (results.length >= maxResults) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= maxResults) return;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        searchInDir(fullPath);
      } else {
        if (args.include) {
          const globRegex = new RegExp('^' + args.include.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
          if (!globRegex.test(entry.name)) continue;
        }
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push(`${fullPath}:${i + 1}: ${lines[i].trim()}`);
              if (results.length >= maxResults) break;
            }
            regex.lastIndex = 0;
          }
        } catch {
          // skip binary files
        }
      }
    }
  }

  searchInDir(searchDir);
  if (results.length === 0) return 'No matches found.';
  return results.join('\n') + (results.length >= maxResults ? `\n\n(showing first ${maxResults} matches)` : '');
}

async function toolGlob(args: { pattern: string; path: string }, cwd: string): Promise<string> {
  const baseDir = resolvePath(args.path, cwd);
  if (!fs.existsSync(baseDir)) {
    return `Error: Directory not found: ${baseDir}`;
  }

  const results: string[] = [];
  const maxResults = 200;
  const parts = args.pattern.split('/');

  function matchGlob(dir: string, patternParts: string[]): void {
    if (results.length >= maxResults) return;
    if (patternParts.length === 0) return;

    const [current, ...rest] = patternParts;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) return;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const isMatch = matchPart(entry.name, current);

      if (current === '**') {
        // ** matches zero or more directories
        matchGlob(dir, rest); // skip **
        if (entry.isDirectory()) {
          matchGlob(path.join(dir, entry.name), patternParts); // recurse with **
        }
      } else if (isMatch) {
        if (rest.length === 0) {
          results.push(path.relative(baseDir, path.join(dir, entry.name)));
        } else if (entry.isDirectory()) {
          matchGlob(path.join(dir, entry.name), rest);
        }
      }
    }
  }

  function matchPart(name: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === '**') return true;
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return regex.test(name);
  }

  matchGlob(baseDir, parts);
  if (results.length === 0) return 'No files found.';
  return results.sort().join('\n') + (results.length >= maxResults ? `\n\n(showing first ${maxResults} files)` : '');
}

// 尝试解析 JSON，如果失败则尝试自动修复常见问题
function tryParseJson(raw: string): any {
  // 先尝试标准解析
  try {
    return JSON.parse(raw);
  } catch {
    // 尝试修复截断的 JSON
    let fixed = raw;

    // 修复 1: 如果 content 字符串被截断（最常见于 write_file 大段 HTML），尝试重建
    const contentMatch = fixed.match(/"content"\s*:\s*"([\s\S]*)/);
    if (contentMatch) {
      const beforeContent = fixed.slice(0, contentMatch.index! + contentMatch[0].length - contentMatch[1].length);
      let contentVal = contentMatch[1];
      // 如果 content 以未闭合的引号结尾，补上闭合引号
      const quoteCount = (contentVal.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        contentVal = contentVal.replace(/"([^"]*)$/, (_, p1) => {
          return JSON.stringify(p1).slice(1, -1).replace(/\\"/g, '"');
        });
      }
      fixed = beforeContent + contentVal + '"}';
      try { return JSON.parse(fixed); } catch { /* 继续尝试其他修复 */ }
    }

    // 修复 2: 尝试补全末尾的引号和括号
    let repaired = raw.replace(/[,\s]+$/, '');
    let openBraces = (repaired.match(/\{/g) || []).length;
    let closeBraces = (repaired.match(/\}/g) || []).length;
    while (closeBraces < openBraces) { repaired += '}'; closeBraces++; }
    let openBrackets = (repaired.match(/\[/g) || []).length;
    let closeBrackets = (repaired.match(/\]/g) || []).length;
    while (closeBrackets < openBrackets) { repaired += ']'; closeBrackets++; }

    try { return JSON.parse(repaired); } catch { /* 继续 */ }

    // 修复 3: 最后手段 - 提取 path 字段
    try {
      const pathMatch = raw.match(/"path"\s*:\s*"([^"]*)"/);
      if (pathMatch) {
        return { path: pathMatch[1] };
      }
    } catch { /* 放弃 */ }

    return null;
  }
}

// ---- 统一执行入口 ----

// 工具名归一化：部分模型会发送 camelCase 或带前缀的工具名
const TOOL_NAME_ALIASES: Record<string, string> = {
  'readFile': 'read_file',
  'readfile': 'read_file',
  'read-file': 'read_file',
  'read': 'read_file',
  'writeFile': 'write_file',
  'writefile': 'write_file',
  'write-file': 'write_file',
  'write': 'write_file',
  'listDir': 'list_dir',
  'listdir': 'list_dir',
  'list-dir': 'list_dir',
  'ls': 'list_dir',
  'list': 'list_dir',
  'shell': 'shell',
  'execute': 'shell',
  'run_command': 'shell',
  'runCommand': 'shell',
  'exec': 'shell',
  'grep': 'grep',
  'search': 'grep',
  'search_files': 'grep',
  'searchFiles': 'grep',
  'find': 'grep',
  'glob': 'glob',
  'find_files': 'glob',
  'findFiles': 'glob',
  'insertCode': 'insert_code',
  'insertcode': 'insert_code',
  'insert-code': 'insert_code',
  'insert': 'insert_code',
  'addCode': 'insert_code',
};

export function normalizeToolName(name: string): string {
  // 直接匹配
  if (['read_file', 'write_file', 'list_dir', 'shell', 'grep', 'glob'].includes(name)) {
    return name;
  }
  // 别名映射
  const alias = TOOL_NAME_ALIASES[name];
  if (alias) return alias;
  // camelCase → snake_case
  const snake = name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  if (['read_file', 'write_file', 'list_dir', 'shell', 'grep', 'glob'].includes(snake)) {
    return snake;
  }
  // 去重：处理 "list_dirlist_dir" 这种流式解析残留
  const half = Math.floor(name.length / 2);
  if (half > 0 && name.length % 2 === 0 && name.slice(0, half) === name.slice(half)) {
    return normalizeToolName(name.slice(0, half));
  }
  return name;
}

export async function executeTool(name: string, argsJson: string, cwd: string): Promise<{ output: string; isError: boolean; fileSnapshot?: { path: string; originalContent: string; isNew: boolean } }> {
  let args: any;
  // 使用自动修复的 JSON 解析
  args = tryParseJson(argsJson);
  if (args === null) {
    return { output: `Error: Invalid JSON arguments: ${argsJson}`, isError: true };
  }

  try {
    const normalizedName = normalizeToolName(name);

    // 本地工具缓存（read/grep/glob/list_dir）
    const cached = globalToolCache.get(normalizedName, argsJson, cwd);
    if (cached) {
      return { output: cached.output, isError: cached.isError };
    }

    let output: string;
    let fileSnapshot: { path: string; originalContent: string; isNew: boolean; newContent?: string } | undefined;

    switch (normalizedName) {
      case 'read_file':
        output = await toolReadFile(args, cwd);
        break;
      case 'write_file': {
        const fullPath = resolvePath(args.path, cwd);

        // 同一轮 agent run 中对同一文件只捕获一次快照
        const alreadyWritten = writtenFilePaths.has(fullPath);
        if (!alreadyWritten) {
          let isNew = true;
          let originalContent = '';
          if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
            try {
              originalContent = fs.readFileSync(fullPath, 'utf8');
              isNew = false;
            } catch { /* 读取失败则视为新文件 */ }
          }
          fileSnapshot = { path: fullPath, originalContent, isNew };
          writtenFilePaths.add(fullPath);
        }

        output = await toolWriteFile(args, cwd);
        if (fileSnapshot) {
          fileSnapshot.newContent = args.content;
        }
        globalToolCache.invalidatePath(fullPath);

        // 若是重复写入，修改返回消息避免误导
        if (alreadyWritten) {
          const lineCount = args.content ? args.content.split('\n').length : 0;
          output = `File updated: ${fullPath} (${lineCount} lines, ${args.content.length} bytes)`;
        }
        break;
      }
      case 'insert_code': {
        // 也捕获快照（如果文件被修改）
        const fullPath = resolvePath(args.path, cwd);
        const alreadyWritten = writtenFilePaths.has(fullPath);
        if (!alreadyWritten) {
          let originalContent = '';
          let isNew = true;
          if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
            try {
              originalContent = fs.readFileSync(fullPath, 'utf8');
              isNew = false;
            } catch { /* 读取失败则视为新文件 */ }
          }
          fileSnapshot = { path: fullPath, originalContent, isNew };
          writtenFilePaths.add(fullPath);
        }
        output = await toolInsertCode(args, cwd);
        if (fileSnapshot) {
          try {
            fileSnapshot.newContent = fs.readFileSync(fullPath, 'utf8');
          } catch { /* ignore */ }
        }
        globalToolCache.invalidatePath(fullPath);
        break;
      }
      case 'list_dir':
        output = await toolListDir(args, cwd);
        break;
      case 'shell': {
        const workDir = args.cwd ? resolvePath(args.cwd, cwd) : cwd;
        output = await toolShell(args, cwd);
        globalToolCache.invalidateWorkspace(workDir);
        break;
      }
      case 'grep':
        output = await toolGrep(args, cwd);
        break;
      case 'glob':
        output = await toolGlob(args, cwd);
        break;
      default:
        return { output: `Error: Unknown tool: ${name}`, isError: true };
    }

    globalToolCache.set(normalizedName, argsJson, cwd, output, output.startsWith('Error:'));
    return { output, isError: output.startsWith('Error:'), fileSnapshot };
  } catch (err) {
    return { output: `Error: ${(err as Error).message}`, isError: true };
  }
}
