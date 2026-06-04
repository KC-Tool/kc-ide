// 会话存储路径：~/.koder/session/<工作区文件夹>/<sessionId>.json

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

const UNASSIGNED_FOLDER = '_unassigned';

export function getKoderSessionsRoot(): string {
  return path.join(os.homedir(), '.koder', 'session');
}

export function ensureSessionsRoot(): string {
  const root = getKoderSessionsRoot();
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  return root;
}

/**
 * 将工作区绝对路径映射为存储目录名，例如：
 * D:\31702\koder → d-31702-koder
 * /home/user/proj → home-user-proj
 */
export function cwdToStorageFolder(cwd?: string): string {
  if (!cwd?.trim()) return UNASSIGNED_FOLDER;

  const normalized = path.normalize(cwd.trim());
  const parsed = path.parse(normalized);
  const parts: string[] = [];

  if (parsed.root) {
    const root = parsed.root.replace(/\\/g, '/');
    const driveMatch = root.match(/^\/([a-zA-Z]):\/?$/);
    if (driveMatch) {
      parts.push(driveMatch[1].toLowerCase());
    } else if (root === '/') {
      parts.push('root');
    }
  }

  if (parsed.dir && parsed.dir !== parsed.root) {
    const rel = path.relative(parsed.root || '/', parsed.dir).replace(/\\/g, '/');
    if (rel && rel !== '.') {
      parts.push(...rel.split('/').filter(Boolean));
    }
  }

  if (parsed.base) {
    parts.push(parsed.base);
  }

  let slug = parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!slug) {
    slug = 'workspace';
  }

  if (slug.length > 64) {
    const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 8);
    slug = `${slug.slice(0, 48)}-${hash}`;
  }

  return slug;
}

export function getSessionDirForCwd(cwd?: string): string {
  const folder = cwdToStorageFolder(cwd);
  const dir = path.join(ensureSessionsRoot(), folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getSessionFilePath(sessionId: string, cwd?: string): string {
  return path.join(getSessionDirForCwd(cwd), `${sessionId}.json`);
}

export function formatCwdLabel(cwd?: string): string {
  if (!cwd) return '';
  const normalized = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
  const base = normalized.split('/').pop();
  return base || cwd;
}

export function formatRepoDisplayName(cwd: string | undefined, storageFolder: string): string {
  if (!cwd) return storageFolder;
  const label = formatCwdLabel(cwd);
  return label || storageFolder;
}

export { UNASSIGNED_FOLDER };
