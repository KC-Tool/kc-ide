// Skills 管理器 — 统一从 ~/.koder/skills/ 加载；启动时将内置技能复制到该目录

import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { SkillDetail, SkillListItem } from '../shared/skills-types.js';
import {
  copyDirRecursive,
  ensureKoderSkillsDir,
  getKoderSkillsDir,
  readSourceMarker,
  skillInstallDir,
  writeSourceMarker,
} from './skills-paths.js';

interface ParsedSkillFile {
  id: string;
  name: string;
  description: string;
  content: string;
}

export class SkillsManager {
  private cache: SkillListItem[] | null = null;
  private contentCache = new Map<string, SkillDetail>();

  /** 应用包内内置 skills（仅用于首次同步复制） */
  getBuiltinDir(): string {
    if (app.isPackaged) {
      const fromResources = path.join(process.resourcesPath, 'skills', 'builtin');
      if (fs.existsSync(fromResources)) return fromResources;
    }
    return path.join(app.getAppPath(), 'skills', 'builtin');
  }

  /** 所有技能统一存放目录 */
  getUserDir(): string {
    return getKoderSkillsDir();
  }

  init(): void {
    ensureKoderSkillsDir();
    this.syncBuiltinToUserDir();
    this.reload();
  }

  /** 将内置 skills 复制到 ~/.koder/skills/（已存在且含 SKILL.md 则跳过，避免覆盖用户修改） */
  syncBuiltinToUserDir(): void {
    const builtinDir = this.getBuiltinDir();
    const userDir = this.getUserDir();
    if (!fs.existsSync(builtinDir)) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(builtinDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      const srcSkillMd = path.join(builtinDir, id, 'SKILL.md');
      if (!fs.existsSync(srcSkillMd)) continue;

      const destDir = skillInstallDir(id);
      const destSkillMd = path.join(destDir, 'SKILL.md');
      if (fs.existsSync(destSkillMd)) continue;

      copyDirRecursive(path.join(builtinDir, id), destDir);
      writeSourceMarker(destDir, 'builtin');
    }
  }

  reload(): void {
    this.cache = null;
    this.contentCache.clear();
  }

  list(): SkillListItem[] {
    if (this.cache) return this.cache;

    const userDir = this.getUserDir();
    const items = fs.existsSync(userDir) ? this.scanDir(userDir) : [];

    items.sort((a, b) => a.id.localeCompare(b.id));
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

    const skillPath = path.join(this.getUserDir(), id, 'SKILL.md');
    if (!fs.existsSync(skillPath)) return null;

    try {
      const raw = fs.readFileSync(skillPath, 'utf8');
      const parsed = parseSkillMarkdown(raw, id);
      const marker = readSourceMarker(path.join(this.getUserDir(), id));
      const source: SkillListItem['source'] =
        marker === 'builtin' ? 'builtin'
        : marker === 'skillhub' ? 'skillhub'
        : 'user';
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
      return null;
    }
  }

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

  deleteSkill(id: string): { ok: boolean; error?: string } {
    const skillDir = path.join(this.getUserDir(), id);
    const marker = readSourceMarker(skillDir);
    if (marker === 'builtin') {
      return { ok: false, error: 'builtin_protected' };
    }
    if (!fs.existsSync(skillDir)) {
      return { ok: false, error: 'not_found' };
    }
    try {
      fs.rmSync(skillDir, { recursive: true, force: true });
      this.reload();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

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

  private scanDir(baseDir: string): SkillListItem[] {
    const result: SkillListItem[] = [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(baseDir, { withFileTypes: true });
    } catch {
      return result;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '.cache') continue;

      const skillDir = path.join(baseDir, entry.name);
      const skillPath = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(skillPath)) continue;

      try {
        const raw = fs.readFileSync(skillPath, 'utf8');
        const parsed = parseSkillMarkdown(raw, entry.name);
        const marker = readSourceMarker(skillDir);
        const source: SkillListItem['source'] =
          marker === 'builtin' ? 'builtin'
          : marker === 'skillhub' ? 'skillhub'
          : 'user';
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
