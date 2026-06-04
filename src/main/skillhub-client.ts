// SkillHub.cn API 客户端（主进程）

import type {
  SkillHubInstallResult,
  SkillHubRemoteSkill,
  SkillHubSearchParams,
  SkillHubSearchResult,
} from '../shared/skillhub-types.js';
import { SKILLHUB_API_BASE } from '../shared/skillhub-types.js';

interface ApiListResponse {
  code: number;
  message?: string;
  data?: {
    skills?: RawSkill[];
    total?: number;
  };
}

interface RawSkill {
  slug: string;
  name: string;
  description?: string;
  description_zh?: string;
  downloads?: number;
  installs?: number;
  stars?: number;
  source?: string;
  version?: string;
  iconUrl?: string | null;
  category?: string;
}

function mapSkill(raw: RawSkill): SkillHubRemoteSkill {
  return {
    slug: raw.slug,
    name: raw.name,
    description: raw.description_zh?.trim() || raw.description?.trim() || raw.name,
    downloads: raw.downloads ?? 0,
    installs: raw.installs,
    stars: raw.stars,
    source: raw.source,
    version: raw.version,
    iconUrl: raw.iconUrl,
    category: raw.category,
  };
}

export async function searchSkillHub(params: SkillHubSearchParams): Promise<SkillHubSearchResult> {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('pageSize', String(params.pageSize));
  if (params.keyword?.trim()) qs.set('keyword', params.keyword.trim());
  if (params.category) qs.set('category', params.category);
  if (params.sortBy) qs.set('sortBy', params.sortBy);
  if (params.order) qs.set('order', params.order);

  const res = await fetch(`${SKILLHUB_API_BASE}/api/skills?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`SkillHub API error: ${res.status}`);
  }

  const json = (await res.json()) as ApiListResponse;
  if (json.code !== 0) {
    throw new Error(json.message ?? 'SkillHub API returned error');
  }

  const skills = (json.data?.skills ?? []).map(mapSkill);
  return { skills, total: json.data?.total ?? skills.length };
}

export async function downloadSkillZip(slug: string): Promise<Buffer> {
  const url = `${SKILLHUB_API_BASE}/api/v1/download?slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error('Invalid skill package (not a zip file)');
  }
  return buf;
}

export type { SkillHubInstallResult };
