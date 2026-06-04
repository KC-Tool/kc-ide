// Skills 管理器 — 加载内置与用户 Skills，注入 Agent 上下文

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { app } from 'electron';
import type { SkillDetail, SkillListItem } from '../shared/skills-types.js';

interface ParsedSkillFile {
  id: string;
  name: string;
  description: string;
  content: string;
}

export class SkillsManager {
  private cache: SkillListItem[] | null = null;
  private contentCache = new Map<string, SkillDetail>();

  /** 内置 skills 目录（打包时随应用分发） */
  getBuiltinDir(): string {
    if (app.isPackaged) {
      const fromResources = path.join(process.resourcesPath, 'skills', 'builtin');
      if (fs.existsSync(fromResources)) return fromResources;
    }
    return path.join(app.getAppPath(), 'skills', 'builtin');
  }

  /** 用户自定义 skills */
  getUserDir(): string {
    return path.join(os.homedir(), '.koder', 'skills');
  }

  init(): void {
    const userDir = this.getUserDir();
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    this.reload();
  }

  reload(): void {
    this.cache = null;
    this.contentCache.clear();
  }

  list(): SkillListItem[] {
    if (this.cache) return this.cache;

    const items: SkillListItem[] = [];
    const builtinDir = this.getBuiltinDir();
    const userDir = this.getUserDir();

    if (fs.existsSync(builtinDir)) {
      items.push(...this.scanDir(builtinDir, 'builtin'));
    }
    if (fs.existsSync(userDir)) {
      items.push(...this.scanDir(userDir, 'user'));
    }

    items.sort((a, b) => {
      if (a.source !== b.source) return a.source === 'builtin' ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

    this.cache = items;
    return items;
  }

  listIds(): string[] {
    return this.list().map(s => s.id);
  }

  get(id: string): SkillDetail | null {
    if (this.contentCache.has(id)) {
      return this.contentCache.get(id)!;
    }

    for (const source of ['builtin', 'user'] as const) {
      const base = source === 'builtin' ? this.getBuiltinDir() : this.getUserDir();
      const skillPath = path.join(base, id, 'SKILL.md');
      if (!fs.existsSync(skillPath)) continue;

      try {
        const raw = fs.readFileSync(skillPath, 'utf8');
        const parsed = parseSkillMarkdown(raw, id);
        const detail: SkillDetail = {
          id: parsed.id,
          name: parsed.name,
          description: parsed.description,
          content: parsed.content,
          source,
          path: skillPath,
        };
        this.contentCache.set(id, detail);
        return detail;
      } catch {
        continue;
      }
    }
    return null;
  }

  /** 注入到用户消息前的 Skill 上下文 */
  buildInjection(skillId: string): string | null {
    const skill = this.get(skillId);
    if (!skill) return null;

    return [
      `[Koder Skill Active: ${skill.id}]`,
      `Name: ${skill.name}`,
      `Description: ${skill.description}`,
      '',
      'Follow the skill instructions below for this request:',
      '',
      '--- SKILL START ---',
      skill.content.trim(),
      '--- SKILL END ---',
      '',
      '--- USER REQUEST ---',
    ].join('\n');
  }

  /** 追加到 system prompt 的 Skills 目录摘要 */
  buildCatalogForSystemPrompt(): string {
    const skills = this.list();
    if (skills.length === 0) return '';

    const lines = skills.map(s => `- ${s.id}: ${s.description}`);
    return [
      '',
      'AVAILABLE SKILLS (invoke via slash commands in user messages):',
      'Users can type /skills to list skills, or /<skill-id> <message> to activate a skill.',
      'When a skill is active, its full instructions are injected into the user message — follow them strictly.',
      ...lines,
    ].join('\n');
  }

  private scanDir(baseDir: string, source: 'builtin' | 'user'): SkillListItem[] {
    const result: SkillListItem[] = [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(baseDir, { withFileTypes: true });
    } catch {
      return result;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = path.join(baseDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) continue;

      try {
        const raw = fs.readFileSync(skillPath, 'utf8');
        const parsed = parseSkillMarkdown(raw, entry.name);
        result.push({
          id: parsed.id,
          name: parsed.name,
          description: parsed.description,
          source,
        });
      } catch {
        // skip invalid
      }
    }
    return result;
  }
}

function parseSkillMarkdown(raw: string, fallbackId: string): ParsedSkillFile {
  const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  let meta: Record<string, string> = {};
  let body = raw;

  if (frontmatterMatch) {
    body = frontmatterMatch[2].trim();
    for (const line of frontmatterMatch[1].split('\n')) {
      const m = line.match(/^([\w-]+):\s*(.*)$/);
      if (m) meta[m[1]] = m[2].trim();
    }
  }

  const id = meta.id || meta.name || fallbackId;
  const name = meta.name || id;
  const description = meta.description || body.split('\n').find(l => l.trim() && !l.startsWith('#'))?.trim() || id;

  return { id, name, description, content: body };
}

export const globalSkillsManager = new SkillsManager();
