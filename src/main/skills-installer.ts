// 从 SkillHub 下载并安装 Skill 到 ~/.koder/skills/

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import AdmZip from 'adm-zip';
import type { SkillHubInstallResult } from '../shared/skillhub-types.js';
import { downloadSkillZip } from './skillhub-client.js';
import { globalSkillsManager } from './skills-manager.js';

function getUserSkillsDir(): string {
  return path.join(os.homedir(), '.koder', 'skills');
}

export async function installSkillFromSkillHub(slug: string): Promise<SkillHubInstallResult> {
  const skillId = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!skillId) {
    return { ok: false, skillId: slug, error: 'Invalid skill slug' };
  }

  const targetDir = path.join(getUserSkillsDir(), skillId);

  try {
    const zipBuffer = await downloadSkillZip(skillId);
    const zip = new AdmZip(zipBuffer);

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });
    zip.extractAllTo(targetDir, true);

    if (!fs.existsSync(path.join(targetDir, 'SKILL.md'))) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      return { ok: false, skillId, error: 'Package does not contain SKILL.md' };
    }

    globalSkillsManager.reload();
    return { ok: true, skillId };
  } catch (err) {
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
