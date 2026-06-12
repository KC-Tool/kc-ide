// 本地工具结果缓存 — 减少重复 read/grep/glob/list_dir，降低 token 与 IO

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export interface ToolCacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

interface CacheEntry {
  output: string;
  isError: boolean;
  createdAt: number;
  key: string;
}

const CACHEABLE_TOOLS = new Set(['read_file', 'list_dir', 'grep', 'glob']);

export class ToolCache {
  private store = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private maxEntries: number;
  private ttlMs: number;
  private enabled: boolean;

  constructor(opts: { maxEntries?: number; ttlMs?: number; enabled?: boolean } = {}) {
    this.maxEntries = opts.maxEntries ?? 300;
    this.ttlMs = opts.ttlMs ?? 5 * 60 * 1000;
    this.enabled = opts.enabled ?? true;
  }

  configure(opts: { maxEntries?: number; ttlMs?: number; enabled?: boolean }): void {
    if (opts.maxEntries !== undefined) this.maxEntries = opts.maxEntries;
    if (opts.ttlMs !== undefined) this.ttlMs = opts.ttlMs;
    if (opts.enabled !== undefined) this.enabled = opts.enabled;
    if (!this.enabled) this.clear();
  }

  getStats(): ToolCacheStats {
    return { hits: this.hits, misses: this.misses, evictions: this.evictions, size: this.store.size };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  clear(): void {
    this.store.clear();
  }

  /** 文件写入/修改后失效相关缓存 */
  invalidatePath(filePath: string): void {
    const normalized = path.normalize(filePath);
    const dir = path.dirname(normalized);
    for (const key of [...this.store.keys()]) {
      if (key.includes(normalized) || key.includes(dir)) {
        this.store.delete(key);
      }
    }
  }

  /** shell 后仅失效目录/搜索类缓存；read_file 仍靠 mtime 校验，避免续聊重复读盘 */
  invalidateWorkspace(cwd: string): void {
    const prefix = `${path.normalize(cwd)}|`;
    const SEARCH_TOOLS = new Set(['list_dir', 'glob', 'grep']);
    for (const key of [...this.store.keys()]) {
      if (!key.startsWith(prefix)) continue;
      const tool = key.split('|')[1];
      if (tool && SEARCH_TOOLS.has(tool)) {
        this.store.delete(key);
      }
    }
  }

  private makeKey(tool: string, argsJson: string, cwd: string): string {
    let args: Record<string, string> = {};
    try {
      args = JSON.parse(argsJson);
    } catch {
      args = { raw: argsJson };
    }

    const parts = [path.normalize(cwd), tool];
    const targetPath = args.path ? path.resolve(cwd, args.path) : cwd;
    parts.push(targetPath);

    if (args.pattern) parts.push(`p:${args.pattern}`);
    if (args.include) parts.push(`i:${args.include}`);
    if (args.command) parts.push(`c:${args.command}`);

    // 文件类工具绑定 mtime，内容变化自动 miss
    try {
      if (['read_file', 'grep', 'glob'].includes(tool) && fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath);
        if (stat.isFile()) {
          parts.push(`m:${stat.mtimeMs}`);
        } else if (stat.isDirectory()) {
          parts.push(`dm:${stat.mtimeMs}`);
        }
      } else if (tool === 'list_dir' && fs.existsSync(targetPath)) {
        parts.push(`dm:${fs.statSync(targetPath).mtimeMs}`);
      }
    } catch {
      parts.push('m:0');
    }

    return parts.join('|');
  }

  get(tool: string, argsJson: string, cwd: string): { output: string; isError: boolean } | null {
    if (!this.enabled || !CACHEABLE_TOOLS.has(tool)) return null;

    const key = this.makeKey(tool, argsJson, cwd);
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (this.ttlMs > 0 && Date.now() - entry.createdAt > this.ttlMs) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    // LRU：删除后重插
    this.store.delete(key);
    this.store.set(key, entry);
    return { output: entry.output, isError: entry.isError };
  }

  set(tool: string, argsJson: string, cwd: string, output: string, isError: boolean): void {
    if (!this.enabled || !CACHEABLE_TOOLS.has(tool) || isError) return;

    const key = this.makeKey(tool, argsJson, cwd);
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest) {
        this.store.delete(oldest);
        this.evictions++;
      }
    }

    this.store.set(key, { output, isError, createdAt: Date.now(), key });
  }
}

/** 全局单例 */
export const globalToolCache = new ToolCache();

/** 生成稳定的 tools JSON（字段顺序固定，利于 API 前缀缓存） */
export function stableToolsJson(tools: unknown[]): string {
  return JSON.stringify(tools);
}

/** 会话级 Prompt 前缀 hash（同会话同 cwd 提高 provider cache 命中） */
export function buildPromptCacheKey(model: string, systemPrompt: string, cwd: string): string {
  const hash = createHash('sha256')
    .update(`${model}\0${systemPrompt}\0${path.normalize(cwd)}`)
    .digest('hex')
    .slice(0, 24);
  return `koder-${hash}`;
}
