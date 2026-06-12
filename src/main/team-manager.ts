import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { AgentTeam, TeamListItem } from '../shared/team-types.js';
import {
  formatAtHelpMessage,
  formatTeamsListMessage,
  parseTeamMarkdown,
  serializeTeamMarkdown,
  slugifyTeamId,
  teamToListItem,
} from '../shared/team-types.js';
import { ensureKoderTeamsDir, getKoderTeamsDir, teamFilePath } from './team-paths.js';
const SOURCE_MARKER = '.koder-team-source';

export class TeamManager {
  private cache: TeamListItem[] | null = null;
  private contentCache = new Map<string, AgentTeam>();

  getBuiltinDir(): string {
    if (app.isPackaged) {
      const fromResources = path.join(process.resourcesPath, 'teams', 'builtin');
      if (fs.existsSync(fromResources)) return fromResources;
    }
    return path.join(app.getAppPath(), 'teams', 'builtin');
  }

  init(): void {
    ensureKoderTeamsDir();
    this.syncBuiltinToUserDir();
    this.reload();
  }

  syncBuiltinToUserDir(): void {
    const builtinDir = this.getBuiltinDir();
    if (!fs.existsSync(builtinDir)) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(builtinDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.team.md')) continue;
      const srcPath = path.join(builtinDir, entry.name);
      const id = entry.name.replace(/\.team\.md$/, '');
      const destPath = teamFilePath(id);
      if (fs.existsSync(destPath)) continue;
      fs.copyFileSync(srcPath, destPath);
      fs.writeFileSync(path.join(getKoderTeamsDir(), `${id}${SOURCE_MARKER}`), 'builtin', 'utf8');
    }
  }

  reload(): void {
    this.cache = null;
    this.contentCache.clear();
  }

  listIds(): string[] {
    return this.list().map(t => t.id);
  }

  list(): TeamListItem[] {
    if (this.cache) return this.cache;
    const dir = ensureKoderTeamsDir();
    const items: TeamListItem[] = [];
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      this.cache = [];
      return [];
    }

    for (const name of entries) {
      if (!name.endsWith('.team.md')) continue;
      const id = name.replace(/\.team\.md$/, '');
      const team = this.get(id);
      if (team) items.push(teamToListItem(team));
    }

    items.sort((a, b) => {
      if (a.source !== b.source) return a.source === 'builtin' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    this.cache = items;
    return items;
  }

  readSourceMarker(teamId: string): 'builtin' | 'user' | null {
    const p = path.join(getKoderTeamsDir(), `${teamId}${SOURCE_MARKER}`);
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf8').trim();
    return raw === 'builtin' ? 'builtin' : raw === 'user' ? 'user' : null;
  }

  get(teamId: string): AgentTeam | null {
    if (this.contentCache.has(teamId)) {
      return this.contentCache.get(teamId)!;
    }
    const filePath = teamFilePath(teamId);
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = parseTeamMarkdown(content, teamId);
      if (!parsed) return null;
      const marker = this.readSourceMarker(teamId);
      if (marker) parsed.source = marker;
      this.contentCache.set(teamId, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  save(team: AgentTeam): { ok: boolean; error?: string } {
    if (!team.id || !/^[a-z0-9][a-z0-9-]*$/.test(team.id)) {
      return { ok: false, error: 'Invalid team id' };
    }
    const existing = this.get(team.id);
    if (existing?.source === 'builtin' && team.source === 'user') {
      return { ok: false, error: 'Cannot overwrite builtin team' };
    }

    ensureKoderTeamsDir();
    const toSave: AgentTeam = {
      ...team,
      updatedAt: new Date().toISOString(),
      source: existing?.source === 'builtin' ? 'builtin' : 'user',
    };
    const content = serializeTeamMarkdown(toSave);
    fs.writeFileSync(teamFilePath(team.id), content, 'utf8');
    if (toSave.source === 'user') {
      fs.writeFileSync(path.join(getKoderTeamsDir(), `${team.id}${SOURCE_MARKER}`), 'user', 'utf8');
    }
    this.reload();
    return { ok: true };
  }

  delete(teamId: string): { ok: boolean; error?: string } {
    const team = this.get(teamId);
    if (!team) return { ok: false, error: 'Team not found' };
    if (team.source === 'builtin') {
      return { ok: false, error: 'Builtin teams cannot be deleted' };
    }
    try {
      const fp = teamFilePath(teamId);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      const marker = path.join(getKoderTeamsDir(), `${teamId}${SOURCE_MARKER}`);
      if (fs.existsSync(marker)) fs.unlinkSync(marker);
      this.reload();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  buildCatalogForSystemPrompt(): string {
    const teams = this.list();
    if (teams.length === 0) return '';
    const lines = teams.map(t => `- ${t.id}: ${t.name} — ${t.description || '(no description)'}`);
    return `\n\nAGENT TEAMS (multi-agent):\n- Activate: @team <id>. Lead spawns REAL sub-agents via delegate_agent / delegate_agents_parallel / spawn_agent.\n- Definitions: ~/.koder/team/*.team.md (${teams.length} available).\n${lines.join('\n')}`;
  }

  buildCoordinatorSystemBlock(teamId: string): string | null {
    const team = this.get(teamId);
    if (!team) return null;

    const memberList = team.members
      .map(m => `- **${m.id}** (${m.name}) — ${m.role}`)
      .join('\n');

    return [
      '',
      '=== ACTIVE AGENT TEAM (multi-agent mode) ===',
      `Team: ${team.name} (${team.id})`,
      team.description ? `Description: ${team.description}` : '',
      '',
      'YOU ARE THE LEAD COORDINATOR ONLY.',
      '- Do NOT impersonate, role-play, or speak as team members (no "As planner..." or "Implementer here...").',
      '- Each member is a REAL separate API sub-agent with its own system prompt from ~/.koder/teams/.',
      '- You do NOT have write_file, insert_code, or shell tools in team mode.',
      '- ALL code changes and shell commands MUST go through sub-agents via:',
      '  • delegate_agent(member_id, task) — run one member (separate API session)',
      '  • delegate_agents_parallel(tasks: [{member_id, task}]) — parallel members',
      '  • spawn_agent(name, system_prompt, task) — ad-hoc sub-agent with custom prompt',
      '- Your job: delegate, synthesize sub-agent outputs, and report to the user.',
      '',
      'Team members (member_id):',
      memberList,
      '',
      'Orchestration:',
      team.orchestration.trim(),
      '=== END TEAM ===',
    ]
      .filter(Boolean)
      .join('\n');
  }

  /** @deprecated 旧版单 Agent 扮演模式，已弃用 */
  buildInjection(teamId: string): string | null {
    return this.buildCoordinatorSystemBlock(teamId);
  }

  buildCreateTeamInjection(userRequest: string, teamsDir: string): string {
    return [
      '[Task: Create Koder Agent Team file]',
      '',
      'Write a new team file under:',
      teamsDir,
      '',
      'Filename: `<slug>.team.md` where slug is lowercase alphanumeric + hyphens.',
      '',
      'Required format (do not use generic SKILL.md):',
      '```',
      '<!-- koder-team-format: v1 -->',
      '---',
      'id: <slug>',
      'name: ...',
      'description: ...',
      'source: user',
      'updated: <ISO8601>',
      '---',
      '# Orchestration',
      '...',
      '# Members',
      '## <member-id>',
      'name: ...',
      'role: ...',
      '```koder-agent-prompt',
      '...',
      '```',
      '```',
      '',
      'Use write_file with the full absolute path. After writing, briefly confirm the team id.',
      '',
      userRequest ? `User request: ${userRequest}` : 'User request: create a useful default team for software development.',
    ].join('\n');
  }

  formatListMessage(): string {
    return formatTeamsListMessage(this.list());
  }

  formatHelpMessage(): string {
    return formatAtHelpMessage();
  }

  createEmptyTeam(name: string): AgentTeam {
    const id = slugifyTeamId(name);
    return {
      id,
      name: name || id,
      description: '',
      orchestration:
        'Lead coordinator delegates via delegate_agent / delegate_agents_parallel. Never impersonate members — spawn real sub-agents.',
      members: [
        {
          id: 'lead',
          name: 'Lead',
          role: '协调',
          prompt: 'You coordinate the team and synthesize outputs.',
        },
      ],
      source: 'user',
    };
  }
}

export const globalTeamManager = new TeamManager();
