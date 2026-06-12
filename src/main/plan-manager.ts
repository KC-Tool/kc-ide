// Plan 持久化 — 保存到 ~/.koder/plan/*.md

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

export interface PlanSaveRequest {
  sessionId: string;
  title?: string;
  markdown: string;
  cwd?: string;
}

export interface PlanSaveResult {
  filePath: string;
  fileName: string;
  createdAt: number;
}

function getPlanDir(): string {
  const dir = path.join(os.homedir(), '.koder', 'plan');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function slugifyTitle(title: string): string {
  const slug = title
    .trim()
    .slice(0, 48)
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'plan';
}

export class PlanManager {
  save(req: PlanSaveRequest): PlanSaveResult {
    const createdAt = Date.now();
    const title = req.title?.trim() || 'plan';
    const stamp = new Date(createdAt).toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `${stamp}-${slugifyTitle(title)}.md`;
    const filePath = path.join(getPlanDir(), fileName);

    const frontmatter = [
      '---',
      `id: ${randomUUID()}`,
      `sessionId: ${req.sessionId}`,
      `title: ${title.replace(/\n/g, ' ')}`,
      `createdAt: ${new Date(createdAt).toISOString()}`,
      req.cwd ? `cwd: ${req.cwd}` : null,
      '---',
      '',
    ].filter((line): line is string => line != null);

    const body = req.markdown.trim();
    fs.writeFileSync(filePath, [...frontmatter, body, ''].join('\n'), 'utf8');

    return { filePath, fileName, createdAt };
  }
}

export const globalPlanManager = new PlanManager();
