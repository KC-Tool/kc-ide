// Koder Agent 工具定义与执行器
// 提供 6 个内置工具：read_file, write_file, list_dir, shell, grep, glob

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { AgentConfig } from '../shared/ipc.js';
import type { TodoItem } from '../shared/todo-types.js';
import { formatTodosForAgent } from '../shared/todo-types.js';
import { globalToolCache } from './tool-cache.js';
import { wrapShellOutputWithTemporalAnchor } from './temporal-anchor.js';
export interface ToolRunContext {
  sessionId?: string;
}

export interface TodoToolOps {
  addTodo(sessionId: string, text: string): TodoItem | null;
  completeTodo(sessionId: string, todoId: string): { ok: boolean; item?: TodoItem; error?: string };
  listTodos(sessionId: string): TodoItem[];
}

let todoToolOps: TodoToolOps | null = null;

export function setTodoToolOps(ops: TodoToolOps): void {
  todoToolOps = ops;
}

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
      description: 'Write content to a file. Creates the file if it does not exist, overwrites if it does. Creates parent directories as needed. IMPORTANT: This tool only writes files and does NOT execute them. Files are never automatically executed after writing.',
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
      description: 'Execute a shell command and return stdout/stderr output. Use for git operations, running scripts, installing packages, etc. SECURITY WARNING: This tool can execute arbitrary commands. Never execute files that were just written by the AI without explicit user confirmation. Always verify the safety of commands before execution.',
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
  {
    type: 'function' as const,
    function: {
      name: 'todo_add',
      description: 'Add one or more todo items to the current session task list. Use when breaking work into trackable steps.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Single todo description' },
          items: {
            type: 'array',
            items: { type: 'string' },
            description: 'Multiple todo descriptions',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'todo_complete',
      description: 'Mark a session todo as done (checked). Call when a task is finished.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Todo id from todo_list or todo_add' },
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Multiple todo ids to complete',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'todo_list',
      description: 'List all todos for the current session with done/pending status.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Search the web for information. Returns search results with titles, URLs, and snippets. Use this when you need current information, documentation, libraries, error solutions, or anything that requires internet access beyond the local codebase.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query to look up on the web' },
          numResults: { type: 'number', description: 'Number of results to return (default 10, max 50)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_fetch',
      description: 'Fetch the content of a web page. Returns the page title and text content (HTML stripped). Use this to read full pages from search results, documentation, or any public URL.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to fetch content from' },
          timeout: { type: 'number', description: 'Timeout in milliseconds (default 15000, max 30000)' },
        },
        required: ['url'],
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

interface AnchorMatch {
  lineIdx: number;
  span: number;
  /** 仅匹配到锚点第一行（多行锚点未完整命中） */
  partial?: boolean;
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function dedupeAnchorLines(anchor: string): string[] {
  const uniqueLines: string[] = [];
  const seen = new Set<string>();
  for (const line of anchor.trim().split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      uniqueLines.push(line.trimEnd());
    }
  }
  return uniqueLines;
}

/** 在文件内容中定位锚点（支持多行子串、连续行、单行、首行回退） */
function findAnchorInFile(original: string, anchor: string): AnchorMatch | null {
  const normOriginal = normalizeNewlines(original);
  const anchorLines = dedupeAnchorLines(anchor);
  if (anchorLines.length === 0) return null;

  const normAnchor = anchorLines.join('\n');
  const fileLines = normOriginal.split('\n');

  // 1. 多行/单行子串精确匹配（最可靠）
  const pos = normOriginal.indexOf(normAnchor);
  if (pos !== -1) {
    const lineIdx = normOriginal.slice(0, pos).split('\n').length - 1;
    return { lineIdx, span: anchorLines.length };
  }

  // 2. 连续行逐行包含匹配
  if (anchorLines.length > 1) {
    for (let i = 0; i <= fileLines.length - anchorLines.length; i++) {
      let matched = true;
      for (let j = 0; j < anchorLines.length; j++) {
        if (!fileLines[i + j].includes(anchorLines[j].trim())) {
          matched = false;
          break;
        }
      }
      if (matched) return { lineIdx: i, span: anchorLines.length };
    }
  }

  // 3. 单行整段包含
  const singleIdx = fileLines.findIndex((line) => line.includes(normAnchor));
  if (singleIdx !== -1) {
    return { lineIdx: singleIdx, span: 1 };
  }

  // 4. 回退：仅匹配锚点第一行
  const firstLine = anchorLines[0].trim();
  const firstIdx = fileLines.findIndex((line) => line.includes(firstLine));
  if (firstIdx !== -1) {
    return { lineIdx: firstIdx, span: 1, partial: anchorLines.length > 1 };
  }

  return null;
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

  const anchorMatch = findAnchorInFile(original, args.anchor);
  if (!anchorMatch) {
    const preview = dedupeAnchorLines(args.anchor).join('\n').slice(0, 120);
    return `Error: Anchor text not found in file: "${preview}${preview.length >= 120 ? '…' : ''}". Use a shorter unique anchor (e.g. a function signature), or use write_file for large rewrites.`;
  }

  const { lineIdx: anchorIdx, span: anchorSpan, partial } = anchorMatch;
  const insertLines = args.content.split('\n');

  switch (args.action) {
    case 'insert_before': {
      lines.splice(anchorIdx, 0, ...insertLines);
      break;
    }
    case 'insert_after': {
      lines.splice(anchorIdx + anchorSpan, 0, ...insertLines);
      break;
    }
    case 'replace': {
      const extraReplace = args.replaceLines ?? 0;
      const totalReplace = Math.min(anchorSpan + extraReplace, lines.length - anchorIdx);
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
  const partialNote = partial ? ', partial anchor (first line only)' : '';
  return `Code ${actionLabel[args.action] ?? args.action}: ${fullPath} (${insertLineCount} lines changed, file now ${newLineCount} lines, anchor line ${anchorIdx + 1}${partialNote})`;
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

  // 安全检查：只允许执行powershell和cmd脚本，禁止执行其他编程文件
  const command = args.command.trim();
  
  // 首先检查是否包含编程文件扩展名 - 如果包含，直接阻止
  const programmingFileExtensions = ['.js', '.py', '.sh', '.rb', '.pl', '.php', '.java', '.go', '.rs', '.ts', '.tsx', '.jsx', '.c', '.cpp', '.h', '.hpp'];
  const hasProgrammingFile = programmingFileExtensions.some(ext => command.includes(ext));
  
  if (hasProgrammingFile) {
    // 检查是否是允许的特殊情况（如git命令中的文件名）
    const isGitCommand = /^git\s/.test(command);
    const isListCommand = /^(ls|dir|find|grep)\s/.test(command);
    const isReadCommand = /^(cat|less|more|head|tail)\s/.test(command);
    
    if (!isGitCommand && !isListCommand && !isReadCommand) {
      return `Error: SECURITY - Command contains programming file extension. Programming files can only be modified using write_file or insert_code tools, not executed. Only PowerShell and CMD scripts can be executed via shell tool. Command: ${command}`;
    }
  }
  
  // 禁止的解释器命令
  const forbiddenInterpreters = ['node', 'python', 'python3', 'bash', 'sh', 'perl', 'ruby', 'php', 'java', 'go', 'rust'];
  const commandWords = command.split(/\s+/);
  const firstWord = commandWords[0]?.toLowerCase();
  
  if (forbiddenInterpreters.includes(firstWord)) {
    return `Error: SECURITY - Cannot use ${firstWord} interpreter. Programming files can only be modified, not executed. Only PowerShell and CMD scripts can be executed via shell tool. Command: ${command}`;
  }
  
  // 禁止直接执行脚本文件
  if (/^\.\//.test(command) || /^\.\.\//.test(command)) {
    return `Error: SECURITY - Cannot execute scripts directly using ./ or ../ . Programming files can only be modified using write_file or insert_code tools, not executed. Only PowerShell and CMD scripts can be executed via shell tool. Command: ${command}`;
  }
  
  // 禁止添加执行权限
  if (/chmod\s+\+x/.test(command)) {
    return `Error: SECURITY - Cannot add execute permissions with chmod +x. Programming files can only be modified, not executed. Command: ${command}`;
  }

  // 允许的执行模式（白名单）
  const allowedPatterns = [
    /^powershell\s+/i,
    /^pwsh\s+/i,
    /^cmd\s+/i,
    /^npm\s+(run|start|test|build|dev|install)/i,
    /^yarn\s+(run|start|test|build|dev|install)/i,
    /^pnpm\s+(run|start|test|build|dev|install)/i,
    /^git\s+/i,
    /^(ls|dir|cd|pwd|echo|cat|mkdir|rm|cp|mv|grep|find|which|where|cls|clear)\s+/i,
  ];
  
  const isAllowed = allowedPatterns.some(pattern => pattern.test(command));
  
  if (!isAllowed && command.length > 0) {
    // 如果不在白名单中，阻止执行
    return `Error: SECURITY - Command not in allowed list. Only PowerShell, CMD, npm/yarn/pnpm scripts, git, and basic system commands are allowed. Programming files cannot be executed. Command: ${command}`;
  }

  try {
    const { stdout, stderr } = await execAsync(args.command, {
      cwd: workDir,
      timeout,
      maxBuffer: 1024 * 1024,
    });
    let result = '';
    if (stdout) result += stdout;
    if (stderr) result += (result ? '\n[stderr]\n' : '') + stderr;
    const out = result || '(no output)';
    return wrapShellOutputWithTemporalAnchor(out);
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

// ---- Web 搜索与抓取工具 ----

/** 使用 DuckDuckGo HTML 版无广告搜索 */
async function toolWebSearch(args: { query: string; numResults?: number }, cwd: string): Promise<string> {
  const num = Math.min(50, Math.max(1, args.numResults ?? 10));
  const queryEncoded = encodeURIComponent(args.query);
  const url = `https://html.duckduckgo.com/html/?q=${queryEncoded}`;

  try {
    const response = await fetchWithTimeout(url, 10000);
    // 解析 DuckDuckGo HTML 结果
    const results: Array<{ title: string; url: string; snippet: string }> = [];
    // 匹配结果条目：<a class="result__a" href="...">Title</a>后面跟 <a class="result__snippet" href="...">snippet</a>
    const itemRegex = /<a class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 0;
    while ((match = itemRegex.exec(response)) !== null && count < num) {
      const rawUrl = match[1];
      const title = stripHtml(match[2]);
      const snippet = stripHtml(match[3]);
      // 跳过豆包等站内结果
      if (rawUrl.includes('doubao.com') || rawUrl.includes('bytecdn.cn')) continue;
      // DuckDuckGo HTML 结果相对 URL
      const resultUrl = rawUrl.startsWith('http') ? rawUrl : `https://html.duckduckgo.com${rawUrl}`;
      results.push({ title, url: resultUrl, snippet });
      count++;
    }
    if (results.length === 0) {
      // 备用：简单正则
      const altRegex = /<a[^>]*class="[^"]*result[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = altRegex.exec(response)) !== null && results.length < num) {
        const rawUrl = match[1];
        if (!rawUrl.startsWith('http') || rawUrl.includes('duckduckgo') || rawUrl.includes('doubao.com')) continue;
        const title = stripHtml(match[2]).trim();
        if (title && !title.includes('<') && title.length > 5) {
          results.push({ title, url: rawUrl.startsWith('http') ? rawUrl : `https://html.duckduckgo.com${rawUrl}`, snippet: '' });
        }
      }
    }
    if (results.length === 0) return `No search results found for: "${args.query}"`;

    return results
      .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet ? `Snippet: ${r.snippet}` : ''}`)
      .join('\n\n');
  } catch (err: any) {
    return `Search failed: ${err.message}`;
  }
}

/** 抓取网页正文（自动提取 title + text） */
async function toolWebFetch(args: { url: string; timeout?: number }, cwd: string): Promise<string> {
  const timeoutMs = Math.min(30000, Math.max(1000, args.timeout ?? 15000));
  try {
    const html = await fetchWithTimeout(args.url, timeoutMs);
    const title = extractHtmlTitle(html) || '';
    const text = extractTextFromHtml(html);
    return `${title ? `Title: ${title}\n\n` : ''}${text.slice(0, 8000)}${text.length > 8000 ? '\n\n[...content truncated]' : ''}`;
  } catch (err: any) {
    return `Fetch failed: ${err.message}`;
  }
}

function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    const req = protocol.get(parsedUrl.toString(), { timeout: timeoutMs }, (res) => {
      // 处理重定向
      if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0) && res.headers.location) {
        fetchWithTimeout(res.headers.location, timeoutMs).then(resolve).catch(reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const encoding = getHtmlEncoding(buffer, res.headers['content-type'] as string) || 'utf8';
        try {
          resolve(buffer.toString(encoding as BufferEncoding));
        } catch {
          resolve(buffer.toString('utf8'));
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    });
    req.on('error', reject);
  });
}

function getHtmlEncoding(buffer: Buffer, contentType?: string): string | null {
  if (!contentType) {
    // 从 HTML 字节顺序标记检测
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return 'utf8';
    if (buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf16le';
    if (buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf16be';
    return null;
  }
  const match = contentType.match(/charset=["']?([^;"']+)/i);
  return match ? match[1].trim() : null;
}

function extractHtmlTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripHtml(m[1]).trim() : '';
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
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
  'todoAdd': 'todo_add',
  'todo_add': 'todo_add',
  'todoComplete': 'todo_complete',
  'todo_complete': 'todo_complete',
  'todoList': 'todo_list',
  'todo_list': 'todo_list',
  'delegateAgent': 'delegate_agent',
  'delegate_agent': 'delegate_agent',
  'delegateAgentsParallel': 'delegate_agents_parallel',
  'delegate_agents_parallel': 'delegate_agents_parallel',
  'spawnAgent': 'spawn_agent',
  'spawn_agent': 'spawn_agent',
  'webSearch': 'web_search',
  'web_search': 'web_search',
  'searchWeb': 'web_search',
  'webFetch': 'web_fetch',
  'web_fetch': 'web_fetch',
  'fetchUrl': 'web_fetch',
  'fetch_url': 'web_fetch',
};

const FILE_TOOLS = ['read_file', 'write_file', 'list_dir', 'shell', 'grep', 'glob', 'insert_code'] as const;
const TODO_TOOLS_LIST = ['todo_add', 'todo_complete', 'todo_list'] as const;
const DELEGATE_TOOLS = ['delegate_agent', 'delegate_agents_parallel', 'spawn_agent'] as const;
const WEB_TOOLS = ['web_search', 'web_fetch'] as const;
const ALL_KNOWN_TOOLS = [...FILE_TOOLS, ...TODO_TOOLS_LIST, ...DELEGATE_TOOLS, ...WEB_TOOLS] as const;

type DelegateRunner = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ output: string; isError: boolean }>;

let delegateRunner: DelegateRunner | null = null;

export function setDelegateRunner(fn: DelegateRunner | null): void {
  delegateRunner = fn;
}

function runTodoTool(
  name: string,
  args: Record<string, unknown>,
  ctx?: ToolRunContext,
): { output: string; isError: boolean } {
  if (!ctx?.sessionId || !todoToolOps) {
    return { output: 'Error: Todos require an active chat session.', isError: true };
  }
  const sid = ctx.sessionId;

  if (name === 'todo_add') {
    const texts: string[] = [];
    if (typeof args.text === 'string' && args.text.trim()) texts.push(args.text.trim());
    if (Array.isArray(args.items)) {
      for (const it of args.items) {
        if (typeof it === 'string' && it.trim()) texts.push(it.trim());
      }
    }
    if (texts.length === 0) {
      return { output: 'Error: Provide text or items[]', isError: true };
    }
    const created: string[] = [];
    for (const text of texts) {
      const item = todoToolOps.addTodo(sid, text);
      if (item) created.push(`${item.id}: ${item.text}`);
    }
    return { output: `Added ${created.length} todo(s):\n${created.join('\n')}`, isError: false };
  }

  if (name === 'todo_complete') {
    const ids: string[] = [];
    if (typeof args.id === 'string') ids.push(args.id);
    if (Array.isArray(args.ids)) {
      for (const id of args.ids) {
        if (typeof id === 'string') ids.push(id);
      }
    }
    if (ids.length === 0) {
      return { output: 'Error: Provide id or ids[]', isError: true };
    }
    const lines: string[] = [];
    for (const id of ids) {
      const r = todoToolOps.completeTodo(sid, id);
      lines.push(r.ok ? `✓ ${id}` : `✗ ${id}: ${r.error}`);
    }
    return { output: lines.join('\n'), isError: false };
  }

  if (name === 'todo_list') {
    const list = todoToolOps.listTodos(sid);
    return { output: formatTodosForAgent(list), isError: false };
  }

  return { output: `Error: Unknown todo tool ${name}`, isError: true };
}

export function normalizeToolName(name: string): string {
  const all = ALL_KNOWN_TOOLS;
  if (all.includes(name as typeof all[number])) {
    return name;
  }
  // 别名映射
  const alias = TOOL_NAME_ALIASES[name];
  if (alias) return alias;
  // camelCase → snake_case
  const snake = name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  if (all.includes(snake as typeof all[number])) {
    return snake;
  }
  // 去重：处理 "list_dirlist_dir" 这种流式解析残留
  const half = Math.floor(name.length / 2);
  if (half > 0 && name.length % 2 === 0 && name.slice(0, half) === name.slice(half)) {
    return normalizeToolName(name.slice(0, half));
  }
  return name;
}

export async function executeTool(
  name: string,
  argsJson: string,
  cwd: string,
  ctx?: ToolRunContext,
): Promise<{ output: string; isError: boolean; fileSnapshot?: { path: string; originalContent: string; isNew: boolean }; todosChanged?: boolean }> {
  let args: any;
  // 使用自动修复的 JSON 解析
  args = tryParseJson(argsJson);
  if (args === null) {
    return { output: `Error: Invalid JSON arguments: ${argsJson}`, isError: true };
  }

  try {
    const normalizedName = normalizeToolName(name);

    if (TODO_TOOLS_LIST.includes(normalizedName as typeof TODO_TOOLS_LIST[number])) {
      const todoResult = runTodoTool(normalizedName, args, ctx);
      return { ...todoResult, todosChanged: !todoResult.isError };
    }

    if (DELEGATE_TOOLS.includes(normalizedName as typeof DELEGATE_TOOLS[number])) {
      if (!delegateRunner) {
        return { output: 'Error: Delegate tools not available', isError: true };
      }
      return await delegateRunner(normalizedName, args);
    }

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
      case 'web_search':
        output = await toolWebSearch(args, cwd);
        break;
      case 'web_fetch':
        output = await toolWebFetch(args, cwd);
        break;
      default:
        return { output: `Error: Unknown tool: ${name}`, isError: true };
    }

    // Web 工具永不缓存（结果随时效性影响）
    if (WEB_TOOLS.includes(normalizedName as typeof WEB_TOOLS[number])) {
      return { output, isError: output.startsWith('Error:') };
    }

    globalToolCache.set(normalizedName, argsJson, cwd, output, output.startsWith('Error:'));
    return { output, isError: output.startsWith('Error:'), fileSnapshot };
  } catch (err) {
    return { output: `Error: ${(err as Error).message}`, isError: true };
  }
}
