// Team 委派工具 — 主 Agent 通过工具 spawn 真实子 Agent

import type { AgentConfig, AgentEvent } from '../shared/ipc.js';
import type { AgentEngine } from './agent-engine.js';
import { globalTeamManager } from './team-manager.js';
import { runSubAgent } from './sub-agent-runner.js';
import { TOOL_DEFINITIONS } from './tools.js';
export const DELEGATE_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'delegate_agent',
      description:
        'Spawn a REAL sub-agent from the active team. The sub-agent runs its own API session with its own system prompt from the team definition. Use instead of impersonating the member.',
      parameters: {
        type: 'object',
        properties: {
          member_id: {
            type: 'string',
            description: 'Team member id from the active team (e.g. planner, implementer)',
          },
          task: { type: 'string', description: 'Task description for this sub-agent' },
        },
        required: ['member_id', 'task'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delegate_agents_parallel',
      description:
        'Spawn multiple team sub-agents in parallel. Each runs an independent API session with its member prompt.',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                member_id: { type: 'string' },
                task: { type: 'string' },
              },
              required: ['member_id', 'task'],
            },
            description: 'List of { member_id, task }',
          },
        },
        required: ['tasks'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'spawn_agent',
      description:
        'Spawn a one-off sub-agent with a custom system prompt (not from team file). Use when the lead needs a specialized role on the fly.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Display name for this sub-agent' },
          system_prompt: { type: 'string', description: 'Full system instructions for the sub-agent' },
          task: { type: 'string', description: 'Task for the sub-agent' },
        },
        required: ['name', 'system_prompt', 'task'],
      },
    },
  },
];

/** 子 Agent 可用工具（与主 Agent 相同，委派工具仅主 Agent 持有） */
export const SUB_AGENT_TOOL_DEFINITIONS = TOOL_DEFINITIONS;

/** Team 模式下主 Agent（LEAD）仅保留只读 + 委派 + todo，禁止直接写文件/跑 shell */
const LEAD_TOOL_NAMES = new Set([
  'read_file',
  'list_dir',
  'grep',
  'glob',
  'todo_add',
  'todo_complete',
  'todo_list',
  'delegate_agent',
  'delegate_agents_parallel',
  'spawn_agent',
]);

export function getLeadToolDefinitions(teamActive: boolean): typeof TOOL_DEFINITIONS {
  if (!teamActive) return TOOL_DEFINITIONS;
  const readAndDelegate = TOOL_DEFINITIONS.filter(t => LEAD_TOOL_NAMES.has(t.function.name));
  const delegateOnly = DELEGATE_TOOL_DEFINITIONS.filter(
    t => !readAndDelegate.some(r => r.function.name === t.function.name),
  );
  return [...readAndDelegate, ...delegateOnly] as typeof TOOL_DEFINITIONS;
}

export interface DelegateContext {
  teamId: string | null;
  sessionId: string;
  cwd: string;
  config: AgentConfig;
  engine: AgentEngine;
  eventCb: (e: AgentEvent) => void;
}

let delegateContext: DelegateContext | null = null;

export function setDelegateContext(ctx: DelegateContext | null): void {
  delegateContext = ctx;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'agent';
}

export async function runDelegateTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ output: string; isError: boolean }> {
  const ctx = delegateContext;
  if (!ctx) {
    return { output: 'Error: Team delegate tools require an active team session.', isError: true };
  }

  const base = {
    cwd: ctx.cwd,
    sessionId: ctx.sessionId,
    config: ctx.config,
    engine: ctx.engine,
    parentEventCb: ctx.eventCb,
  };

  if (name === 'delegate_agent') {
    const memberId = String(args.member_id ?? '').trim();
    const task = String(args.task ?? '').trim();
    if (!memberId || !task) {
      return { output: 'Error: member_id and task are required', isError: true };
    }
    if (!ctx.teamId) {
      return { output: 'Error: No active team for delegate_agent', isError: true };
    }
    const team = globalTeamManager.get(ctx.teamId);
    const member = team?.members.find(m => m.id === memberId);
    if (!member) {
      const ids = team?.members.map(m => m.id).join(', ') ?? 'none';
      return { output: `Error: Unknown member_id "${memberId}". Available: ${ids}`, isError: true };
    }
    const output = await runSubAgent({
      ...base,
      memberId: member.id,
      memberName: member.name,
      memberPrompt: member.prompt,
      task,
    });
    return {
      output: `## Sub-agent: ${member.name} (${member.id})\n\n${output}`,
      isError: false,
    };
  }

  if (name === 'delegate_agents_parallel') {
    if (!ctx.teamId) {
      return { output: 'Error: No active team', isError: true };
    }
    const team = globalTeamManager.get(ctx.teamId);
    const tasks = args.tasks;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { output: 'Error: tasks[] required', isError: true };
    }

    const runs = tasks.map(async (entry: unknown) => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      const memberId = String(e.member_id ?? '').trim();
      const task = String(e.task ?? '').trim();
      const member = team?.members.find(m => m.id === memberId);
      if (!member || !task) return { memberId, error: 'invalid member or task' };
      const output = await runSubAgent({
        ...base,
        memberId: member.id,
        memberName: member.name,
        memberPrompt: member.prompt,
        task,
      });
      return { memberId, memberName: member.name, output };
    });

    const results = await Promise.all(runs);
    const blocks = results
      .filter(Boolean)
      .map(r => (r && 'output' in r && r.output
        ? `## ${r.memberName} (${r.memberId})\n\n${r.output}`
        : `## ${(r as { memberId: string }).memberId}\n\nError: ${(r as { error?: string }).error ?? 'failed'}`));
    return { output: blocks.join('\n\n---\n\n'), isError: false };
  }

  if (name === 'spawn_agent') {
    const agentName = String(args.name ?? 'Sub-agent').trim();
    const systemPrompt = String(args.system_prompt ?? '').trim();
    const task = String(args.task ?? '').trim();
    if (!systemPrompt || !task) {
      return { output: 'Error: system_prompt and task are required', isError: true };
    }
    const memberId = slugify(agentName);
    const output = await runSubAgent({
      ...base,
      memberId,
      memberName: agentName,
      memberPrompt: systemPrompt,
      task,
    });
    return { output: `## Spawned: ${agentName}\n\n${output}`, isError: false };
  }

  return { output: `Error: Unknown delegate tool ${name}`, isError: true };
}

export const DELEGATE_TOOL_NAMES = ['delegate_agent', 'delegate_agents_parallel', 'spawn_agent'] as const;
