// 子 Agent 运行器 — 独立 API 会话，使用成员专属 system prompt

import { randomUUID } from 'node:crypto';
import type { AgentConfig, AgentEvent } from '../shared/ipc.js';
import type { AgentEngine } from './agent-engine.js';
import { getTemporalAnchorSystemBlock, getTemporalAnchorWorkspaceLine } from './temporal-anchor.js';
import { SUB_AGENT_TOOL_DEFINITIONS } from './team-delegate.js';

const SUB_AGENT_BASE = `You are a Koder sub-agent working on a delegated task.
You have file and shell tools. Do NOT delegate to other agents.
Keep responses focused on your assigned task only. No emoji.`;

export interface SubAgentRunParams {
  memberId: string;
  memberName: string;
  memberPrompt: string;
  task: string;
  cwd: string;
  sessionId: string;
  config: AgentConfig;
  engine: AgentEngine;
  parentEventCb?: (e: AgentEvent) => void;
}

export async function runSubAgent(params: SubAgentRunParams): Promise<string> {
  const {
    memberId,
    memberName,
    memberPrompt,
    task,
    cwd,
    sessionId,
    config,
    engine,
    parentEventCb,
  } = params;

  const systemPrompt = [
    SUB_AGENT_BASE,
    getTemporalAnchorSystemBlock(),
    '',
    `Sub-agent identity: ${memberName} (id: ${memberId})`,
    `Working directory: ${cwd}`,
    getTemporalAnchorWorkspaceLine(),
    '',
    '--- Member instructions ---',
    memberPrompt.trim(),
  ].join('\n');

  const subConfig: AgentConfig = { ...config, systemPrompt };
  const subSessionId = `${sessionId}:sub:${memberId}:${randomUUID().slice(0, 8)}`;

  parentEventCb?.({
    type: 'subagent_start',
    data: task,
    ts: Date.now(),
    sessionId,
    subagent: { memberId, memberName, task },
  });

  let output = '';

  await engine.run(
    subConfig,
    [{ role: 'user', content: task }],
    cwd,
    (e) => {
      if (e.type === 'text_delta') {
        output += e.data ?? '';
        parentEventCb?.({
          type: 'subagent_text_delta',
          data: e.data,
          ts: e.ts,
          sessionId,
          subagent: { memberId, memberName },
        });
      } else if (e.type === 'tool_call_start' || e.type === 'tool_result') {
        parentEventCb?.({ ...e, sessionId, subagent: { memberId, memberName } });
      } else if (e.type === 'error') {
        output += `\n[Sub-agent error: ${e.data}]`;
      }
    },
    subSessionId,
    { tools: SUB_AGENT_TOOL_DEFINITIONS, skipResetWrittenFiles: true, maxIterations: 12 },
  );

  parentEventCb?.({
    type: 'subagent_done',
    data: output,
    ts: Date.now(),
    sessionId,
    subagent: { memberId, memberName, output },
  });

  return output.trim() || '(Sub-agent finished with no text output)';
}
