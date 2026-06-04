// Skills 统一目录：~/.koder/skills/

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import AdmZip from 'adm-zip';

const SOURCE_MARKER = '.koder-source';

export function getKoderSkillsDir(): string {
  return path.join(os.homedir(), '.koder', 'skills');
}

export function getSkillsCacheDir(): string {
  return path.join(getKoderSkillsDir(), '.cache');
}

export function ensureKoderSkillsDir(): string {
  const dir = getKoderSkillsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const cache = getSkillsCacheDir();
  if (!fs.existsSync(cache)) {
    fs.mkdirSync(cache, { recursive: true });
  }
  return dir;
}

export function skillInstallDir(skillId: string): string {
  return path.join(getKoderSkillsDir(), skillId);
}

export function skillZipPath(skillId: string): string {
  return path.join(getSkillsCacheDir(), `${skillId}.zip`);
}

export type SkillSourceMarker = 'builtin' | 'skillhub' | 'user';

export function writeSourceMarker(skillDir: string, source: SkillSourceMarker): void {
  fs.writeFileSync(path.join(skillDir, SOURCE_MARKER), source, 'utf8');
}

export function readSourceMarker(skillDir: string): SkillSourceMarker | null {
  const p = path.join(skillDir, SOURCE_MARKER);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8').trim();
  if (raw === 'builtin' || raw === 'skillhub' || raw === 'user') return raw;
  return null;
}

/** 递归复制目录（仅文件与子目录） */
export function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === SOURCE_MARKER || entry.name === '.cache') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** 解压 zip 到目标目录（逐文件创建），完成后由调用方删除 zip */
export function extractZipToDir(zipPath: string, targetDir: string): void {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const rel = entry.entryName.replace(/\\/g, '/');
    if (!rel || rel.includes('..')) continue;

    const outPath = path.join(targetDir, rel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, entry.getData());
  }
}

export function safeUnlink(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}
