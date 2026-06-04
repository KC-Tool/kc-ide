// Koder Agent Team — 自定义 .team.md 格式（koder-team v1）

export const KODER_TEAM_FORMAT_MARKER = '<!-- koder-team-format: v1 -->';
export const KODER_TEAM_FILE_EXT = '.team.md';
export const KODER_AGENT_PROMPT_FENCE = 'koder-agent-prompt';

export type TeamSource = 'builtin' | 'user';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  prompt: string;
}

export interface AgentTeam {
  id: string;
  name: string;
  description: string;
  orchestration: string;
  members: TeamMember[];
  source: TeamSource;
  updatedAt?: string;
}

export interface TeamListItem {
  id: string;
  name: string;
  description: string;
  source: TeamSource;
  memberCount: number;
}

export interface TeamSaveResult {
  ok: boolean;
  error?: string;
}

export interface TeamDeleteResult {
  ok: boolean;
  error?: string;
}

export type AtParseResult =
  | { type: 'none'; userMessage: string; raw: string }
  | { type: 'list_teams'; userMessage: string; raw: string }
  | { type: 'list_help'; userMessage: string; raw: string }
  | { type: 'activate_team'; teamId: string; userMessage: string; raw: string }
  | { type: 'create_team'; userMessage: string; raw: string };

const AT_RESERVED = new Set(['teams', 'team', 'help', 'create-team', 'create_team']);

/** 解析以 @ 开头的输入（在 slash 之前处理） */
export function parseAtCommand(input: string, knownTeamIds: string[]): AtParseResult {
  const raw = input.trim();
  if (!raw.startsWith('@')) {
    return { type: 'none', userMessage: raw, raw };
  }

  const lower = raw.toLowerCase();

  if (lower === '@teams' || lower.startsWith('@teams ')) {
    return { type: 'list_teams', userMessage: '', raw };
  }

  if (lower === '@help' || lower.startsWith('@help ')) {
    return { type: 'list_help', userMessage: '', raw };
  }

  if (lower.startsWith('@create-team ') || lower.startsWith('@create_team ')) {
    const rest = raw.slice(raw.indexOf(' ') + 1).trim();
    return { type: 'create_team', userMessage: rest, raw };
  }
  if (lower === '@create-team' || lower === '@create_team') {
    return { type: 'create_team', userMessage: '', raw };
  }

  const direct = raw.match(/^@([a-zA-Z0-9][\w-]*)\s*(.*)$/);
  if (direct) {
    const cmd = direct[1];
    const userMessage = direct[2].trim();
    if (cmd.toLowerCase() === 'team' && userMessage) {
      const teamId = userMessage.split(/\s+/)[0];
      if (knownTeamIds.includes(teamId)) {
        return { type: 'activate_team', teamId, userMessage: userMessage.slice(teamId.length).trim(), raw };
      }
    }
    if (!AT_RESERVED.has(cmd.toLowerCase()) && knownTeamIds.includes(cmd)) {
      return { type: 'activate_team', teamId: cmd, userMessage, raw };
    }
  }

  return { type: 'none', userMessage: raw, raw };
}

function parseFrontmatter(body: string): { meta: Record<string, string>; rest: string } | null {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key) meta[key] = val;
  }
  return { meta, rest: match[2] };
}

function extractSection(rest: string, heading: string): string {
  const re = new RegExp(`^#\\s+${heading}\\s*\\n([\\s\\S]*?)(?=^#\\s+|\\Z)`, 'im');
  const m = rest.match(re);
  return m ? m[1].trim() : '';
}

function parseMembersSection(section: string): TeamMember[] {
  const members: TeamMember[] = [];
  const blocks = section.split(/^##\s+/m).filter(Boolean);
  for (const block of blocks) {
    const lines = block.split('\n');
    const id = lines[0].trim();
    if (!id) continue;
    let name = id;
    let role = '';
    let prompt = '';
    const promptRe = new RegExp(
      '```' + KODER_AGENT_PROMPT_FENCE + '\\s*\\n([\\s\\S]*?)```',
      'i',
    );
    const promptMatch = block.match(promptRe);
    if (promptMatch) prompt = promptMatch[1].trim();

    for (const line of lines.slice(1)) {
      const nm = line.match(/^name:\s*(.+)$/i);
      const rm = line.match(/^role:\s*(.+)$/i);
      if (nm) name = nm[1].trim();
      if (rm) role = rm[1].trim();
    }
    members.push({ id, name, role, prompt });
  }
  return members;
}

export function parseTeamMarkdown(content: string, fallbackId?: string): AgentTeam | null {
  if (!content.includes('koder-team-format: v1')) return null;

  const withoutMarker = content.replace(/<!--\s*koder-team-format:\s*v1\s*-->\s*/i, '').trim();
  const fm = parseFrontmatter(withoutMarker);
  if (!fm) return null;

  const id = fm.meta.id || fallbackId || '';
  if (!id) return null;

  const orchestration = extractSection(fm.rest, 'Orchestration');
  const members = parseMembersSection(extractSection(fm.rest, 'Members'));

  const sourceRaw = fm.meta.source?.toLowerCase();
  const source: TeamSource = sourceRaw === 'builtin' ? 'builtin' : 'user';

  return {
    id,
    name: fm.meta.name || id,
    description: fm.meta.description || '',
    orchestration,
    members,
    source,
    updatedAt: fm.meta.updated,
  };
}

export function serializeTeamMarkdown(team: AgentTeam): string {
  const lines: string[] = [
    KODER_TEAM_FORMAT_MARKER,
    '---',
    `id: ${team.id}`,
    `name: ${team.name}`,
    `description: ${team.description}`,
    `source: ${team.source}`,
    `updated: ${team.updatedAt || new Date().toISOString()}`,
    '---',
    '',
    '# Orchestration',
    '',
    team.orchestration.trim() || 'Lead agent coordinates sub-agents by role when the task benefits from multiple perspectives.',
    '',
    '# Members',
    '',
  ];

  for (const m of team.members) {
    lines.push(`## ${m.id}`, '', `name: ${m.name}`, `role: ${m.role}`, '', '```' + KODER_AGENT_PROMPT_FENCE, m.prompt.trim(), '```', '');
  }

  return lines.join('\n');
}

export function teamToListItem(team: AgentTeam): TeamListItem {
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    source: team.source,
    memberCount: team.members.length,
  };
}

export function formatTeamsListMessage(teams: TeamListItem[]): string {
  if (teams.length === 0) {
    return '暂无 Agent Team。在 **设置 → Agent Team** 中创建，或使用 `@create-team` 让模型生成。';
  }
  const rows = teams.map(
    t => `- **${t.id}** — ${t.name} (${t.memberCount} 成员, ${t.source})${t.description ? `: ${t.description}` : ''}`,
  );
  return `## Agent Teams\n\n${rows.join('\n')}\n\n激活：\`@team <id>\` 或 \`@<id>\``;
}

export function formatAtHelpMessage(): string {
  return `## @ 命令（Agent Team）

| 命令 | 说明 |
| --- | --- |
| \`@teams\` | 列出所有 Team |
| \`@team <id>\` | 为当前会话激活 Team |
| \`@<id>\` | 同上（简写） |
| \`@create-team <描述>\` | 让模型按 Koder 格式创建 \`~/.koder/team/<id>.team.md\` |
| \`@help\` | 显示本帮助 |

Team 文件格式标识：\`${KODER_TEAM_FORMAT_MARKER}\``;
}

/** @ 命令补全菜单项（与 SlashCommandMenu 共用） */
export interface AtMenuItem {
  id: string;
  label: string;
  description: string;
  insertText: string;
  kind: 'command' | 'team';
}

export function buildAtMenuItems(
  teams: TeamListItem[],
  filter: string,
  labels?: {
    teamsDesc: string;
    helpDesc: string;
    createTeamDesc: string;
    teamUsePrefix: string;
  },
): AtMenuItem[] {
  const q = filter.toLowerCase().replace(/^@/, '');
  const teamsDesc = labels?.teamsDesc ?? 'List teams';
  const helpDesc = labels?.helpDesc ?? 'Team commands help';
  const createTeamDesc = labels?.createTeamDesc ?? 'Create team file';
  const teamUsePrefix = labels?.teamUsePrefix ?? 'Activate:';

  const base: AtMenuItem[] = [
    { id: 'teams', label: '@teams', description: teamsDesc, insertText: '@teams ', kind: 'command' },
    { id: 'help', label: '@help', description: helpDesc, insertText: '@help ', kind: 'command' },
    {
      id: 'create-team',
      label: '@create-team',
      description: createTeamDesc,
      insertText: '@create-team ',
      kind: 'command',
    },
    {
      id: 'team-cmd',
      label: '@team',
      description: `${teamUsePrefix} <id>`,
      insertText: '@team ',
      kind: 'command',
    },
  ];

  for (const t of teams) {
    base.push({
      id: t.id,
      label: `@${t.id}`,
      description: t.description || t.name,
      insertText: `@${t.id} `,
      kind: 'team',
    });
    base.push({
      id: `team-${t.id}`,
      label: `@team ${t.id}`,
      description: `${teamUsePrefix} ${t.name}`,
      insertText: `@team ${t.id} `,
      kind: 'team',
    });
  }

  if (!q) return base.slice(0, 14);

  return base
    .filter(
      item =>
        item.label.toLowerCase().includes(q)
        || item.id.toLowerCase().includes(q)
        || item.description.toLowerCase().includes(q),
    )
    .slice(0, 14);
}

export function slugifyTeamId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'team';
}
