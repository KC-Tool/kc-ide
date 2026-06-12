// API Prompt 缓存优化 — 静态前缀分离 + cache_control 断点，提高 provider 端命中率

import type { AgentConfig } from '../shared/ipc.js';
import { getTemporalAnchorWorkspaceLine } from './temporal-anchor.js';
import { buildPromptCacheKey, stableToolsJson } from './tool-cache.js';
import { TOOL_DEFINITIONS } from './tools.js';

interface ChatMessage {
  role: string;
  content?: string | unknown[];
  tool_calls?: unknown[];
  tool_call_id?: string;
}

type ApiMessage = Record<string, unknown>;

const CACHE_CONTROL = { type: 'ephemeral' };

/** 构建 cache 友好的 messages 数组 */
export function buildCacheOptimizedMessages(
  config: AgentConfig,
  conversationHistory: ChatMessage[],
  cwd: string,
): ApiMessage[] {
  const messages: ApiMessage[] = [];

  if (config.promptCacheEnabled) {
    // 静态 system prompt 单独成块并标记 cache_control（Anthropic / 部分 OpenAI 兼容）
    messages.push({
      role: 'system',
      content: [
        {
          type: 'text',
          text: config.systemPrompt,
          cache_control: CACHE_CONTROL,
        },
      ],
    });
    // 动态 cwd 独立消息，避免污染 system 静态前缀
    messages.push({
      role: 'user',
      content: `[Workspace Context]\nCurrent working directory: ${cwd}\n${getTemporalAnchorWorkspaceLine()}`,
    });
  } else {
    messages.push({
      role: 'system',
      content: `${config.systemPrompt}\n\nCurrent working directory: ${cwd}\n${getTemporalAnchorWorkspaceLine()}`,
    });
  }

  for (const m of conversationHistory) {
    messages.push(convertHistoryMessage(m));
  }

  if (config.promptCacheEnabled) {
    addRollingCacheBreakpoint(messages);
  }

  return messages;
}

function convertHistoryMessage(m: ChatMessage): ApiMessage {
  const msg: ApiMessage = { role: m.role };
  if (m.content !== undefined) msg.content = m.content;
  if (m.tool_calls) msg.tool_calls = m.tool_calls;
  if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
  return msg;
}

/**
 * 在历史消息上设置 cache 断点（最多 4 处），拉长可缓存前缀，提高续聊命中率
 */
function addRollingCacheBreakpoint(messages: ApiMessage[]): void {
  if (messages.length < 3) return;

  const MAX_BREAKPOINTS = 4;
  let marked = 0;
  let skippedLatestUser = false;

  for (let i = messages.length - 1; i >= 0 && marked < MAX_BREAKPOINTS; i--) {
    const role = messages[i].role as string;
    if (role === 'user') {
      if (!skippedLatestUser) {
        skippedLatestUser = true;
      }
      continue;
    }
    if (role === 'assistant' || role === 'tool') {
      attachCacheControl(messages[i]);
      marked++;
    }
  }
}

function attachCacheControl(msg: ApiMessage): void {
  const content = msg.content;
  if (typeof content === 'string') {
    msg.content = [
      {
        type: 'text',
        text: content,
        cache_control: CACHE_CONTROL,
      },
    ];
  } else if (Array.isArray(content) && content.length > 0) {
    const last = content[content.length - 1] as Record<string, unknown>;
    if (last && typeof last === 'object' && !last.cache_control) {
      last.cache_control = CACHE_CONTROL;
    }
  }
}

/** 推理/思考类模型通常使用 max_completion_tokens 且不支持 temperature */
export function usesCompletionTokenLimit(config: AgentConfig): boolean {
  if (config.reasoningEffort && config.reasoningEffort !== 'off') return true;
  const m = config.model.toLowerCase();
  return /\bo[0-9]+[-_]?|gpt-5|reasoner|deepseek-r|thinking/.test(m);
}

/** 构建 API 请求体（含 prompt 缓存优化字段） */
export function buildApiRequestBody(
  config: AgentConfig,
  messages: ApiMessage[],
  cwd: string,
  tools: typeof TOOL_DEFINITIONS = TOOL_DEFINITIONS,
): Record<string, unknown> {
  const tokenLimit = Math.max(256, config.maxTokens || 16384);
  const reasoning = usesCompletionTokenLimit(config);

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    tools,
    stream: true,
    stream_options: { include_usage: true },
  };

  if (reasoning) {
    // o-系列 / reasoning 模型：max_tokens 可能导致 0 输出或卡住
    body.max_completion_tokens = tokenLimit;
  } else {
    body.max_tokens = tokenLimit;
    body.temperature = config.temperature;
  }

  if (config.reasoningEffort && config.reasoningEffort !== 'off') {
    body.reasoning_effort = config.reasoningEffort;
  }

  if (config.promptCacheEnabled) {
    // OpenAI 兼容：prompt_cache_key 稳定同会话前缀
    body.prompt_cache_key = buildPromptCacheKey(config.model, config.systemPrompt, cwd);
    // 部分服务支持 store 模式
    body.store = false;
  }

  // 稳定 tools 序列化顺序（调试用，body 已用对象）
  void stableToolsJson(tools);

  return body;
}

/** 从 streaming / 非 streaming usage 中提取 cached_tokens */
export function extractCachedTokens(usage: Record<string, unknown> | undefined): number {
  if (!usage) return 0;

  const details = usage.prompt_tokens_details as Record<string, number> | undefined;
  if (details?.cached_tokens) return details.cached_tokens;

  const inputDetails = usage.input_tokens_details as Record<string, number> | undefined;
  if (inputDetails?.cached_tokens) return inputDetails.cached_tokens;

  if (typeof usage.cached_tokens === 'number') return usage.cached_tokens;
  if (typeof usage.cache_read_input_tokens === 'number') return usage.cache_read_input_tokens;

  return 0;
}

export function extractPromptTokens(usage: Record<string, unknown> | undefined): number {
  if (!usage) return 0;
  return (usage.prompt_tokens as number)
    ?? (usage.input_tokens as number)
    ?? 0;
}
