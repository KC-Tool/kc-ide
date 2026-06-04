// 从 SkillHub 下载并安装 Skill 到 ~/.koder/skills/

import fs from 'node:fs';
import path from 'node:path';
import type { SkillHubInstallResult } from '../shared/skillhub-types.js';
import { downloadSkillZip } from './skillhub-client.js';
import { globalSkillsManager } from './skills-manager.js';
import {
  ensureKoderSkillsDir,
  extractZipToDir,
  safeUnlink,
  skillInstallDir,
  skillZipPath,
  writeSourceMarker,
} from './skills-paths.js';

export async function installSkillFromSkillHub(slug: string): Promise<SkillHubInstallResult> {
  const skillId = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!skillId) {
    return { ok: false, skillId: slug, error: 'Invalid skill slug' };
  }

  ensureKoderSkillsDir();
  const targetDir = skillInstallDir(skillId);
  const zipFile = skillZipPath(skillId);

  try {
    const zipBuffer = await downloadSkillZip(skillId);
    fs.writeFileSync(zipFile, zipBuffer);

    extractZipToDir(zipFile, targetDir);
    safeUnlink(zipFile);

    if (!fs.existsSync(path.join(targetDir, 'SKILL.md'))) {
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
      return { ok: false, skillId, error: 'Package does not contain SKILL.md' };
    }

    writeSourceMarker(targetDir, 'skillhub');
    globalSkillsManager.reload();
    return { ok: true, skillId };
  } catch (err) {
    safeUnlink(zipFile);
    if (fs.existsSync(targetDir)) {
      try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    return {
      ok: false,
      skillId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
