import type { ChatMessage, MessageSegment } from '../../shared/ipc';

export interface ToolCallInline {
  id: string;
  name: string;
  input: string;
  output: string;
  status: 'running' | 'done' | 'error';
  fileSnapshot?: {
    path: string;
    originalContent: string;
    isNew: boolean;
    newContent?: string;
  };
}

export interface ThinkingSegment {
  id: string;
  content: string;
  streaming: boolean;
}

export type UiSegment =
  | { type: 'thinking'; id: string; content: string; streaming: boolean }
  | { type: 'text'; id: string; content: string }
  | { type: 'tool_call'; id: string; toolCall: ToolCallInline };

export interface UiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  toolCalls: ToolCallInline[];
  streaming?: boolean;
  thinkingSegments: ThinkingSegment[];
  segments: UiSegment[];
}

function deriveFromSegments(segments: UiSegment[]) {
  const thinkingSegments = segments
    .filter((s): s is Extract<UiSegment, { type: 'thinking' }> => s.type === 'thinking')
    .map((s) => ({ id: s.id, content: s.content, streaming: s.streaming }));
  const text = segments
    .filter((s): s is Extract<UiSegment, { type: 'text' }> => s.type === 'text')
    .map((s) => s.content)
    .join('');
  const toolCalls = segments
    .filter((s): s is Extract<UiSegment, { type: 'tool_call' }> => s.type === 'tool_call')
    .map((s) => s.toolCall);
  return { thinkingSegments, text, toolCalls };
}

export function chatMessageToUi(m: ChatMessage): UiMessage {
  if (m.segments && m.segments.length > 0) {
    const segments: UiSegment[] = m.segments.flatMap((seg): UiSegment[] => {
      if (seg.type === 'thinking') {
        return [{ type: 'thinking', id: seg.id, content: seg.content ?? '', streaming: false }];
      }
      if (seg.type === 'text') {
        return [{ type: 'text', id: seg.id, content: seg.content ?? '' }];
      }
      if (seg.type === 'tool_call' && seg.toolCall) {
        return [{ type: 'tool_call', id: seg.id, toolCall: seg.toolCall }];
      }
      return [];
    });
    return {
      id: m.id,
      role: m.role,
      timestamp: m.timestamp,
      streaming: false,
      ...deriveFromSegments(segments),
      segments,
    };
  }

  const segments: UiSegment[] = [];
  if (m.thinking) {
    segments.push({ type: 'thinking', id: crypto.randomUUID(), content: m.thinking, streaming: false });
  }
  if (m.text) {
    segments.push({ type: 'text', id: crypto.randomUUID(), content: m.text });
  }
  m.toolCalls?.forEach((tc) => {
    segments.push({ type: 'tool_call', id: tc.id, toolCall: tc });
  });

  return {
    id: m.id,
    role: m.role,
    text: m.text,
    timestamp: m.timestamp,
    toolCalls: m.toolCalls ?? [],
    streaming: false,
    thinkingSegments: m.thinking
      ? [{ id: crypto.randomUUID(), content: m.thinking, streaming: false }]
      : [],
    segments,
  };
}

export function segmentsToPersisted(segments: UiSegment[]): MessageSegment[] {
  return segments.map((seg) => {
    if (seg.type === 'thinking') {
      return { type: 'thinking', id: seg.id, content: seg.content };
    }
    if (seg.type === 'text') {
      return { type: 'text', id: seg.id, content: seg.content };
    }
    return { type: 'tool_call', id: seg.id, toolCall: { ...seg.toolCall } };
  });
}

export function extractAssistantText(msg: UiMessage): string {
  const fromSegments = msg.segments
    .filter((s): s is Extract<UiSegment, { type: 'text' }> => s.type === 'text')
    .map((s) => s.content)
    .join('\n\n');
  return (fromSegments || msg.text).trim();
}
