// SkillHub (skillhub.cn) 远程 API 类型

export const SKILLHUB_API_BASE = 'https://api.skillhub.cn';
export const SKILLHUB_WEB_BASE = 'https://www.skillhub.cn';

export interface SkillHubRemoteSkill {
  slug: string;
  name: string;
  description: string;
  downloads: number;
  installs?: number;
  stars?: number;
  source?: string;
  version?: string;
  iconUrl?: string | null;
  category?: string;
}

export interface SkillHubSearchParams {
  page: number;
  pageSize: number;
  keyword?: string;
  category?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface SkillHubSearchResult {
  skills: SkillHubRemoteSkill[];
  total: number;
}

export interface SkillHubInstallResult {
  ok: boolean;
  skillId: string;
  error?: string;
}

/** 从链接或 slug 解析 SkillHub 技能 ID */
export function parseSkillHubSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/skillhub\.cn\/skills\/([a-z0-9][a-z0-9-]*)/i);
  if (urlMatch) return urlMatch[1].toLowerCase();

  const slugOnly = trimmed.replace(/^\/+/, '').split('/').pop() ?? '';
  if (/^[a-z0-9][a-z0-9-]*$/i.test(slugOnly)) return slugOnly.toLowerCase();

  return null;
}

export function skillHubSkillUrl(slug: string): string {
  return `${SKILLHUB_WEB_BASE}/skills/${slug}`;
}
