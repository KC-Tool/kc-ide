import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { KODER_TEAM_FILE_EXT } from '../shared/team-types.js';

export function getKoderTeamsDir(): string {
  return path.join(os.homedir(), '.koder', 'team');
}

export function ensureKoderTeamsDir(): string {
  const dir = getKoderTeamsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function teamFilePath(teamId: string): string {
  return path.join(getKoderTeamsDir(), `${teamId}${KODER_TEAM_FILE_EXT}`);
}
