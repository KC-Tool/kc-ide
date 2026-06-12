// 从持久化会话消息构建 API 对话历史（含 tool_calls / tool 结果，供续聊复用上下文与 Prompt 缓存）

import type { ChatMessage, MessageSegment } from '../shared/ipc.js';

export interface ApiHistoryMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

const MAX_TOOL_OUTPUT_CHARS = 16_000;

function truncateToolOutput(output: string): string {
  if (output.length <= MAX_TOOL_OUTPUT_CHARS) return output;
  const omitted = output.length - MAX_TOOL_OUTPUT_CHARS;
  return `${output.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n\n[... ${omitted} chars omitted from history — use read_file if you need the full output again ...]`;
}

function pushAssistantWithTools(
  out: ApiHistoryMessage[],
  text: string,
  tools: Array<{ id: string; name: string; input: string; output: string }>,
): void {
  if (tools.length === 0) {
    if (text.trim()) {
      out.push({ role: 'assistant', content: text });
    }
    return;
  }

  out.push({
    role: 'assistant',
    content: text.trim() || undefined,
    tool_calls: tools.map((tc) => ({
      id: tc.id,
      type: 'function' as const,
      function: { name: tc.name, arguments: tc.input },
    })),
  });

  for (const tc of tools) {
    out.push({
      role: 'tool',
      tool_call_id: tc.id,
      content: truncateToolOutput(tc.output),
    });
  }
}

function expandFromSegments(segments: MessageSegment[]): ApiHistoryMessage[] {
  const out: ApiHistoryMessage[] = [];
  let i = 0;

  while (i < segments.length) {
    const seg = segments[i];
    if (seg.type === 'thinking') {
      i++;
      continue;
    }

    if (seg.type === 'text') {
      let text = '';
      while (i < segments.length && segments[i].type === 'text') {
        text += segments[i].content ?? '';
        i++;
      }

      const tools: Array<{ id: string; name: string; input: string; output: string }> = [];
      while (i < segments.length && segments[i].type === 'tool_call' && segments[i].toolCall) {
        const tc = segments[i].toolCall!;
        tools.push({
          id: tc.id,
          name: tc.name,
          input: tc.input,
          output: tc.output,
        });
        i++;
      }

      pushAssistantWithTools(out, text, tools);
      continue;
    }

    if (seg.type === 'tool_call' && seg.toolCall) {
      const tools: Array<{ id: string; name: string; input: string; output: string }> = [];
      while (i < segments.length && segments[i].type === 'tool_call' && segments[i].toolCall) {
        const tc = segments[i].toolCall!;
        tools.push({
          id: tc.id,
          name: tc.name,
          input: tc.input,
          output: tc.output,
        });
        i++;
      }
      pushAssistantWithTools(out, '', tools);
      continue;
    }

    i++;
  }

  return out;
}

function expandFromLegacy(msg: ChatMessage): ApiHistoryMessage[] {
  const tools = (msg.toolCalls ?? [])
    .filter((tc) => tc.id && tc.name)
    .map((tc) => ({
      id: tc.id,
      name: tc.name,
      input: tc.input,
      output: tc.output,
    }));

  if (tools.length > 0) {
    const out: ApiHistoryMessage[] = [];
    pushAssistantWithTools(out, msg.text, tools);
    return out;
  }

  if (msg.text.trim()) {
    return [{ role: 'assistant', content: msg.text }];
  }
  return [];
}

/** 将会话消息展开为 OpenAI 兼容的多轮 messages（含历史 tool 结果） */
export function buildConversationHistoryForApi(messages: ChatMessage[]): ApiHistoryMessage[] {
  const out: ApiHistoryMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      if (msg.text.trim()) {
        out.push({ role: 'user', content: msg.text });
      }
      continue;
    }

    if (msg.role === 'system') {
      if (msg.text.trim()) {
        out.push({ role: 'system', content: msg.text });
      }
      continue;
    }

    if (msg.role === 'assistant') {
      if (msg.segments && msg.segments.length > 0) {
        out.push(...expandFromSegments(msg.segments));
      } else {
        out.push(...expandFromLegacy(msg));
      }
    }
  }

  return out;
}
