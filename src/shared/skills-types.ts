// Skills 类型与 slash 命令解析（主进程 / 渲染进程共享）

export interface SkillListItem {
  id: string;
  name: string;
  description: string;
  source: 'builtin' | 'user';
}

export interface SkillDetail extends SkillListItem {
  content: string;
  path: string;
}

export type SlashCommandType = 'none' | 'list_skills' | 'list_help' | 'invoke_skill';

export interface SlashParseResult {
  type: SlashCommandType;
  skillId?: string;
  userMessage: string;
  /** 原始输入 */
  raw: string;
}

const RESERVED = new Set(['skills', 'skill', 'help']);

/** 解析以 / 开头的输入 */
export function parseSlashCommand(input: string, knownSkillIds: string[]): SlashParseResult {
  const raw = input.trim();
  if (!raw.startsWith('/')) {
    return { type: 'none', userMessage: raw, raw };
  }

  const lower = raw.toLowerCase();

  if (lower === '/skills' || lower.startsWith('/skills ')) {
    return { type: 'list_skills', userMessage: '', raw };
  }

  if (lower === '/help' || lower.startsWith('/help ')) {
    return { type: 'list_help', userMessage: '', raw };
  }

  // /skill vibe-coding 修复这个 bug
  if (lower.startsWith('/skill ')) {
    const rest = raw.slice(7).trim();
    const spaceIdx = rest.indexOf(' ');
    const skillId = (spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)).trim();
    const userMessage = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1).trim();
    if (skillId && knownSkillIds.includes(skillId)) {
      return { type: 'invoke_skill', skillId, userMessage, raw };
    }
  }

  // /vibe-coding 写个 html
  const direct = raw.match(/^\/([a-zA-Z0-9][\w-]*)\s*(.*)$/);
  if (direct) {
    const cmd = direct[1];
    if (!RESERVED.has(cmd.toLowerCase()) && knownSkillIds.includes(cmd)) {
      return {
        type: 'invoke_skill',
        skillId: cmd,
        userMessage: direct[2].trim(),
        raw,
      };
    }
  }

  return { type: 'none', userMessage: raw, raw };
}

export function formatSkillsListMessage(skills: SkillListItem[]): string {
  if (skills.length === 0) {
    return '当前没有可用的 Skills。内置技能目录：`skills/builtin/`';
  }

  const builtin = skills.filter(s => s.source === 'builtin');
  const user = skills.filter(s => s.source === 'user');

  let md = '## 可用 Skills\n\n';
  md += '使用方式：\n';
  md += '- `/skills` — 查看本列表\n';
  md += '- `/<skill-id> 你的需求` — 例如 `/vibe-coding 优化这段代码`\n';
  md += '- `/skill <skill-id> 你的需求` — 同上\n\n';

  if (builtin.length > 0) {
    md += '### 内置技能\n\n';
    for (const s of builtin) {
      md += `- **\`/${s.id}\`** — ${s.description}\n`;
    }
    md += '\n';
  }

  if (user.length > 0) {
    md += '### 用户技能 (~/.koder/skills/)\n\n';
    for (const s of user) {
      md += `- **\`/${s.id}\`** — ${s.description}\n`;
    }
  }

  return md;
}

export function formatHelpMessage(): string {
  return `## Slash 命令

| 命令 | 说明 |
| --- | --- |
| \`/skills\` | 列出所有可用 Skills |
| \`/help\` | 显示本帮助 |
| \`/<skill-id> <消息>\` | 加载指定 Skill 并发送消息，例如 \`/vibe-coding 写一个登录页\` |
| \`/skill <skill-id> <消息>\` | 同上 |

输入 \`/\` 可打开命令补全菜单。`;
}
