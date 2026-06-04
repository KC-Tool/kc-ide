import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentEvent, ChatMessage, FileSnapshot, MessageSegment, Session, Unsubscribe } from '../../shared/ipc';
import type { SkillListItem } from '../../shared/skills-types';
import { formatHelpMessage, formatSkillsListMessage, parseSlashCommand } from '../../shared/skills-types';
import CodeBlock from './CodeBlock';
import ToolCallCard from './ToolCallCard';
import ThinkingBlock from './ThinkingBlock';
import SlashCommandMenu, { buildSlashMenuItems, type SlashMenuItem } from './SlashCommandMenu';

interface Props {
  session: Session | null;
  onAddMessage: (msg: ChatMessage) => Promise<void>;
  onOpenFileBrowser: (cwd: string) => void;
  onWorkspaceChange: () => void;
  onRollback: () => void;
}

interface ToolCallInline {
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

interface ThinkingSegment {
  id: string;
  content: string;
  streaming: boolean;
}

/** 按到来顺序排列的消息片段（用于按序渲染） */
type UiSegment =
  | { type: 'thinking'; id: string; content: string; streaming: boolean }
  | { type: 'text'; id: string; content: string }
  | { type: 'tool_call'; id: string; toolCall: ToolCallInline };

function closeStreamingThinking(segments: UiSegment[]): UiSegment[] {
  return segments.map(s => s.type === 'thinking' && s.streaming ? { ...s, streaming: false } : s);
}

function applyThinkingDelta(segments: UiSegment[], data: string): UiSegment[] {
  const last = segments[segments.length - 1];
  if (last?.type === 'thinking' && last.streaming) {
    return [...segments.slice(0, -1), { ...last, content: last.content + data }];
  }
  return [...segments, { type: 'thinking', id: crypto.randomUUID(), content: data, streaming: true }];
}

function applyTextDelta(segments: UiSegment[], data: string): UiSegment[] {
  const last = segments[segments.length - 1];
  if (last?.type === 'text') {
    return [...segments.slice(0, -1), { ...last, content: last.content + data }];
  }
  return [...segments, { type: 'text', id: crypto.randomUUID(), content: data }];
}

function applyToolCallStart(segments: UiSegment[], tc: ToolCallInline): UiSegment[] {
  const closed = closeStreamingThinking(segments);
  const idx = closed.findIndex(s => s.type === 'tool_call' && s.toolCall.id === tc.id);
  if (idx >= 0) {
    const updated = [...closed];
    updated[idx] = { type: 'tool_call', id: tc.id, toolCall: { ...tc, status: 'running' } };
    return updated;
  }
  return [...closed, { type: 'tool_call', id: tc.id, toolCall: { ...tc } }];
}

function applyToolCallDelta(segments: UiSegment[], tc: ToolCallInline): UiSegment[] {
  const closed = closeStreamingThinking(segments);
  const idx = closed.findIndex(s => s.type === 'tool_call' && s.toolCall.id === tc.id);
  if (idx >= 0) {
    const seg = closed[idx];
    if (seg.type === 'tool_call') {
      const updated = [...closed];
      updated[idx] = {
        type: 'tool_call',
        id: tc.id,
        toolCall: { ...seg.toolCall, name: tc.name, input: tc.input, status: 'running' },
      };
      return updated;
    }
  }
  return [...closed, { type: 'tool_call', id: tc.id, toolCall: { ...tc, status: 'running' } }];
}

function applyToolResult(
  segments: UiSegment[],
  toolCallId: string,
  output: string,
  isError: boolean,
  fileSnapshot?: FileSnapshot,
): UiSegment[] {
  return closeStreamingThinking(segments).map(s =>
    s.type === 'tool_call' && s.toolCall.id === toolCallId
      ? {
          ...s,
          toolCall: {
            ...s.toolCall,
            output,
            status: isError ? 'error' as const : 'done' as const,
            fileSnapshot: fileSnapshot ?? s.toolCall.fileSnapshot,
          },
        }
      : s,
  );
}

function deriveFromSegments(segments: UiSegment[]) {
  const thinkingSegments = segments
    .filter((s): s is Extract<UiSegment, { type: 'thinking' }> => s.type === 'thinking')
    .map(s => ({ id: s.id, content: s.content, streaming: s.streaming }));
  const text = segments
    .filter((s): s is Extract<UiSegment, { type: 'text' }> => s.type === 'text')
    .map(s => s.content)
    .join('');
  const toolCalls = segments
    .filter((s): s is Extract<UiSegment, { type: 'tool_call' }> => s.type === 'tool_call')
    .map(s => s.toolCall);
  return { thinkingSegments, text, toolCalls };
}

function patchFromSegments(segments: UiSegment[]) {
  return { segments, ...deriveFromSegments(segments) };
}

function segmentsToPersisted(segments: UiSegment[]): MessageSegment[] {
  return segments.map(seg => {
    if (seg.type === 'thinking') {
      return { type: 'thinking', id: seg.id, content: seg.content };
    }
    if (seg.type === 'text') {
      return { type: 'text', id: seg.id, content: seg.content };
    }
    return { type: 'tool_call', id: seg.id, toolCall: { ...seg.toolCall } };
  });
}

function chatMessageToUi(m: ChatMessage): UiMessage {
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

  // 旧数据兼容：无 segments 时按 thinking → text → tools 顺序
  const segments: UiSegment[] = [];
  if (m.thinking) {
    segments.push({ type: 'thinking', id: crypto.randomUUID(), content: m.thinking, streaming: false });
  }
  if (m.text) {
    segments.push({ type: 'text', id: crypto.randomUUID(), content: m.text });
  }
  m.toolCalls?.forEach(tc => {
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

interface UiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  toolCalls: ToolCallInline[];
  streaming?: boolean;
  thinkingSegments: ThinkingSegment[];
  /** 按到来顺序排列的事件列表，决定渲染顺序 */
  segments: UiSegment[];
}

// SVG icons
const IconSend = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const IconStop = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
const IconChat = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const IconFolder = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);
const IconRollback = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

// 解析消息文本，提取工具调用标记，返回可渲染片段
function parseMessageContent(text: string, toolCalls: ToolCallInline[]) {
  // 移除文本中的标记（它们只是内部跟踪用的）
  const cleanText = text
    .replace(/\n<<TOOL_CALL:.*?>>/g, '')
    .replace(/\n<<TOOL_RESULT:.*?>>/g, '');

  return cleanText;
}

// Markdown 渲染
function renderMarkdown(text: string) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...rest }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeStr = String(children).replace(/\n$/, '');
          if (match || codeStr.includes('\n')) {
            return <CodeBlock language={match?.[1] ?? ''}>{codeStr}</CodeBlock>;
          }
          return <code className={className} {...rest}>{children}</code>;
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export default function Chat({ session, onAddMessage, onOpenFileBrowser, onWorkspaceChange, onRollback }: Props) {
  const [uiMessages, setUiMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [unsubscribe, setUnsubscribe] = useState<Unsubscribe | null>(null);

  // 回退确认弹窗状态
  const [pendingRollback, setPendingRollback] = useState<number | null>(null);
  // Toast 通知
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  // 上下文占用显示（默认 200K）
  const [contextUsage, setContextUsage] = useState<{
    current: number;
    max: number;
    breakdown?: {
      system: number;
      history: number;
      toolDefs: number;
      toolResults: number;
      currentOutput: number;
    };
    cachedTokens?: number;
    cacheHitRate?: number;
    toolCacheHits?: number;
    toolCacheMisses?: number;
  }>({ current: 0, max: 200000 });
  // 上下文详情面板展开状态
  const [showContextDetail, setShowContextDetail] = useState(false);
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashSelected, setSlashSelected] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<UiMessage[]>(uiMessages);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const currentAssistantId = useRef<string | null>(null);
  const currentToolCalls = useRef<ToolCallInline[]>([]);

  // session 切换时重置
  useEffect(() => {
    if (session) {
      setUiMessages(session.messages.map(chatMessageToUi));
    } else {
      setUiMessages([]);
    }
    setRunning(false);
    setContextUsage({ current: 0, max: 200000 });
    setShowContextDetail(false);
    currentAssistantId.current = null;
    currentToolCalls.current = [];
    if (unsubscribe) {
      unsubscribe();
      setUnsubscribe(null);
    }
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesRef.current = uiMessages;
  }, [uiMessages]);

  useEffect(() => {
    void window.koder.getSkills().then(setSkills);
  }, []);

  const slashFilter = input.startsWith('/') ? input : '';
  const slashMenuItems = buildSlashMenuItems(skills, slashFilter);

  useEffect(() => {
    setSlashSelected(0);
  }, [slashFilter]);

  useEffect(() => {
    setSlashMenuOpen(input.startsWith('/') && slashMenuItems.length > 0);
  }, [input, slashMenuItems.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [uiMessages]);

  // 自动清除 Toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, []);

  const appendSystemInfo = useCallback(async (text: string) => {
    if (!session) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      text,
      timestamp: Date.now(),
    };
    await onAddMessage(msg);
    setUiMessages((prev) => [...prev, {
      id: msg.id,
      role: 'system',
      text,
      timestamp: msg.timestamp,
      toolCalls: [],
      thinkingSegments: [],
      segments: [{ type: 'text', id: crypto.randomUUID(), content: text }],
    }]);
  }, [session, onAddMessage]);

  const handleSlashSelect = useCallback((item: SlashMenuItem) => {
    setInput(item.insertText);
    setSlashMenuOpen(false);
    textareaRef.current?.focus();
    autoResize();
  }, [autoResize]);

  const handleSubmit = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || running || !session) return;

    const skillIds = skills.map(s => s.id);
    const parsed = parseSlashCommand(prompt, skillIds);

    setInput('');
    setSlashMenuOpen(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    if (parsed.type === 'list_skills') {
      await appendSystemInfo(formatSkillsListMessage(skills));
      return;
    }
    if (parsed.type === 'list_help') {
      await appendSystemInfo(formatHelpMessage());
      return;
    }

    setRunning(true);
    currentToolCalls.current = [];

    const now = Date.now();
    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();
    currentAssistantId.current = assistantMsgId;

    const userMsg: UiMessage = {
      id: userMsgId, role: 'user', text: prompt, timestamp: now, toolCalls: [], thinkingSegments: [], segments: [],
    };
    const assistantMsg: UiMessage = {
      id: assistantMsgId, role: 'assistant', text: '', timestamp: now + 1, toolCalls: [], streaming: true, thinkingSegments: [], segments: [],
    };

    setUiMessages((prev) => [...prev, userMsg, assistantMsg]);

    await onAddMessage({ id: userMsgId, role: 'user', text: prompt, timestamp: now });

    try {
      const { sessionId, unsubscribe: unsub } = await window.koder.runAgent(
        {
          sessionId: session.id,
          prompt,
          cwd: session.cwd || undefined,
          skillId: parsed.type === 'invoke_skill' ? parsed.skillId : undefined,
        },
        (e: AgentEvent) => {
          if (e.type === 'text_delta') {
            setUiMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                const segments = applyTextDelta(m.segments, e.data ?? '');
                return { ...m, ...patchFromSegments(segments) };
              }),
            );
          } else if (e.type === 'thinking_delta') {
            setUiMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                const segments = applyThinkingDelta(m.segments, e.data ?? '');
                return { ...m, ...patchFromSegments(segments) };
              }),
            );
          } else if (e.type === 'tool_call_delta' && e.toolCall) {
            const tc: ToolCallInline = {
              id: e.toolCall.id,
              name: e.toolCall.name,
              input: e.toolCall.arguments,
              output: '',
              status: 'running',
            };
            const existing = currentToolCalls.current.find(t => t.id === tc.id);
            if (existing) {
              existing.name = tc.name;
              existing.input = tc.input;
            } else {
              currentToolCalls.current.push(tc);
            }
            setUiMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                const segments = applyToolCallDelta(m.segments, tc);
                return { ...m, ...patchFromSegments(segments) };
              }),
            );
          } else if (e.type === 'tool_call_start' && e.toolCall) {
            const tc: ToolCallInline = {
              id: e.toolCall.id,
              name: e.toolCall.name,
              input: e.toolCall.arguments,
              output: '',
              status: 'running',
            };
            const existing = currentToolCalls.current.find(t => t.id === tc.id);
            if (existing) {
              existing.name = tc.name;
              existing.input = tc.input;
            } else {
              currentToolCalls.current.push(tc);
            }
            setUiMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                const segments = applyToolCallStart(m.segments, tc);
                return { ...m, ...patchFromSegments(segments) };
              }),
            );
          } else if (e.type === 'tool_result' && e.toolResult) {
            const tc = currentToolCalls.current.find((t) => t.id === e.toolResult!.toolCallId);
            if (tc) {
              tc.output = e.toolResult.output;
              tc.status = e.toolResult.isError ? 'error' : 'done';
              if (e.toolResult.fileSnapshot) {
                tc.fileSnapshot = e.toolResult.fileSnapshot;
              }
            }
            setUiMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                const segments = applyToolResult(
                  m.segments,
                  e.toolResult!.toolCallId,
                  e.toolResult!.output,
                  e.toolResult!.isError,
                  e.toolResult!.fileSnapshot,
                );
                return { ...m, ...patchFromSegments(segments) };
              }),
            );
          } else if (e.type === 'error') {
            setUiMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                const segments = applyTextDelta(m.segments, `\n\n**错误**: ${e.data ?? '未知错误'}`);
                const closed = closeStreamingThinking(segments).map(s =>
                  s.type === 'thinking' ? { ...s, streaming: false } : s,
                );
                return { ...m, ...patchFromSegments(closed), streaming: false };
              }),
            );
            setRunning(false);
          } else if (e.type === 'done') {
            setUiMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                const closed = closeStreamingThinking(m.segments);
                return {
                  ...m,
                  ...patchFromSegments(closed),
                  streaming: false,
                };
              }),
            );
            setRunning(false);
          } else if (e.type === 'context_usage' && e.usage) {
            setContextUsage((prev) => ({
              current: e.usage!.totalTokens,
              max: e.usage!.maxContextTokens ?? prev.max,
              breakdown: e.usage!.breakdown,
              cachedTokens: e.usage!.cachedTokens,
              cacheHitRate: e.usage!.cacheHitRate,
              toolCacheHits: e.usage!.toolCacheHits,
              toolCacheMisses: e.usage!.toolCacheMisses,
            }));
          }
        },
      );

      setUnsubscribe(() => unsub);
    } catch (err) {
      setUiMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, text: `**错误**: ${(err as Error).message}`, streaming: false }
            : m,
        ),
      );
      setRunning(false);
    }
  }, [input, running, session, onAddMessage, skills, appendSystemInfo]);

  // streaming 结束后持久化 assistant 消息
  // 注意：主进程的 agent:run .then() 会自动保存消息 + 快照，
  // 这里只做 session 刷新（如果主进程已保存则跳过，避免重复）
  useEffect(() => {
    if (!running && uiMessages.length > 0) {
      const lastMsg = uiMessages[uiMessages.length - 1];
      if (lastMsg.role === 'assistant' && lastMsg.text && !lastMsg.streaming) {
        // 刷新 session（但不要重复 addMessage，由主进程负责）
        (async () => {
          if (session) {
            const updated = await window.koder.getSession(session.id);
            if (updated) {
              const msgExists = updated.messages.some((m) => m.id === lastMsg.id);
              if (!msgExists) {
                // 主进程还没保存，我们帮它保存
                const thinkingText = lastMsg.thinkingSegments.map(s => s.content).join('\n\n');
                await onAddMessage({
                  id: lastMsg.id,
                  role: 'assistant',
                  text: lastMsg.text,
                  timestamp: lastMsg.timestamp,
                  thinking: thinkingText || undefined,
                  toolCalls: lastMsg.toolCalls.length > 0
                    ? lastMsg.toolCalls.map((tc) => ({
                        id: tc.id, name: tc.name, input: tc.input, output: tc.output, status: tc.status,
                        fileSnapshot: tc.fileSnapshot,
                      }))
                    : undefined,
                  segments: lastMsg.segments.length > 0 ? segmentsToPersisted(lastMsg.segments) : undefined,
                });
              }
            }
          }
        })();
      }
    }
  }, [running, uiMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (unsubscribe) unsubscribe(); };
  }, [unsubscribe]);

  const handleCancel = useCallback(async () => {
    if (session) await window.koder.cancelAgent(session.id);
    if (unsubscribe) { unsubscribe(); setUnsubscribe(null); }
    setRunning(false);
    setUiMessages((prev) =>
      prev.map((m) => m.streaming ? { ...m, streaming: false } : m),
    );
  }, [session, unsubscribe]);

  const handleSelectWorkspace = useCallback(async () => {
    const dir = await window.koder.selectDirectory();
    if (dir && session) {
      await window.koder.updateSession(session.id, { cwd: dir });
      onWorkspaceChange();
    }
  }, [session, onWorkspaceChange]);

  const handleRollback = useCallback(async (assistantMsgIndex: number) => {
    if (!session || running) return;
    // 先关闭确认弹窗
    setPendingRollback(null);
    const result = await window.koder.rollback(session.id, assistantMsgIndex);
    if (result.ok) {
      setUiMessages((prev) => prev.slice(0, assistantMsgIndex));
      onRollback();
      setToast({
        message: `回退成功：恢复了 ${result.filesRestored} 个文件，删除了 ${result.messagesRemoved} 条消息`,
        type: 'success',
      });
    } else {
      setToast({ message: '回退失败：找不到该会话', type: 'error' });
    }
  }, [session, running, onRollback]);

  /** 点击回退按钮时，弹出确认框 */
  const confirmRollback = useCallback((assistantMsgIndex: number) => {
    setPendingRollback(assistantMsgIndex);
  }, []);

  const cancelRollback = useCallback(() => {
    setPendingRollback(null);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMenuOpen && slashMenuItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelected(i => (i + 1) % slashMenuItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelected(i => (i - 1 + slashMenuItems.length) % slashMenuItems.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        handleSlashSelect(slashMenuItems[slashSelected]);
        return;
      }
      if (e.key === 'Escape') {
        setSlashMenuOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="chat">
      <div className="chat-scroll" ref={scrollRef}>
        {uiMessages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon"><IconChat /></div>
            <h2>开始对话</h2>
            <p>输入你的编程需求，Koder Agent 会自动读取代码、执行命令、完成任务。</p>
          </div>
        ) : (
          uiMessages.map((m, msgIndex) => {
            if (m.role === 'system') {
              return (
                <div key={m.id} className="msg-system-row">
                  <div className="msg-system-inner">{renderMarkdown(m.text)}</div>
                </div>
              );
            }
            const cleanText = parseMessageContent(m.text, m.toolCalls);
            const thinkingCount = m.segments.filter(s => s.type === 'thinking').length;
            return (
              <div key={m.id} className="msg-row">
                <div className="msg-row-inner">
                  <div className={`msg-avatar msg-avatar-${m.role}`}>
                    {m.role === 'user' ? '你' : 'K'}
                  </div>
                  <div className="msg-body">
                    <div className="msg-role-label">{m.role === 'user' ? '你' : 'Koder'}</div>
                    <div className="msg-content">
                      {m.role === 'assistant' ? (
                        <>
                          {m.segments.map((seg, segIndex) => {
                            if (seg.type === 'thinking') {
                              const thinkIndex = m.segments
                                .slice(0, segIndex + 1)
                                .filter(s => s.type === 'thinking').length;
                              const label = seg.streaming
                                ? '思考中…'
                                : thinkingCount > 1
                                  ? `思考过程 ${thinkIndex}`
                                  : '思考过程';
                              return (
                                <ThinkingBlock
                                  key={seg.id}
                                  content={seg.content}
                                  streaming={seg.streaming}
                                  label={label}
                                />
                              );
                            }
                            if (seg.type === 'tool_call') {
                              return <ToolCallCard key={seg.id} toolCall={seg.toolCall} />;
                            }
                            if (seg.type === 'text' && seg.content) {
                              return (
                                <div key={seg.id} className="msg-text-segment">
                                  {renderMarkdown(parseMessageContent(seg.content, m.toolCalls))}
                                </div>
                              );
                            }
                            return null;
                          })}
                          {/* 无 segments 时的兜底 */}
                          {m.segments.length === 0 && cleanText && renderMarkdown(cleanText)}
                          {m.streaming && <span className="streaming-cursor" />}
                        </>
                      ) : (
                        <p>{m.text}</p>
                      )}
                    </div>
                    {/* 回退按钮：仅在非流式 assistant 消息上显示 */}
                    {m.role === 'assistant' && !m.streaming && !running && msgIndex > 0 && (
                      <button
                        className="msg-rollback-btn"
                        onClick={() => confirmRollback(msgIndex > 0 ? msgIndex - 1 : msgIndex)}
                        title="回退此轮对话（恢复文件 + 删除消息）"
                      >
                        <IconRollback /> 回退
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="composer">
        <div className="composer-inner">
          <div className="composer-toolbar">
            <button
              className="workspace-btn"
              onClick={handleSelectWorkspace}
              disabled={running || !session}
              title="选择工作目录"
            >
              <IconFolder />
              <span className="workspace-label">
                {session?.cwd ? session.cwd.split(/[\\/]/).pop() : '选择工作区'}
              </span>
            </button>
            {session?.cwd && (
              <span className="workspace-path" title={session.cwd}>{session.cwd}</span>
            )}
          </div>
          {/* 上下文占用指示器 */}
          {contextUsage.current > 0 && (
            <div className="context-usage-section">
              <div
                className="context-usage-bar"
                onClick={() => setShowContextDetail(prev => !prev)}
                title={showContextDetail ? '收起详情' : '点击查看详情'}
              >
                <div
                  className="context-usage-fill"
                  style={{ width: `${Math.min((contextUsage.current / contextUsage.max) * 100, 100)}%` }}
                />
                <span className="context-usage-text">
                  {Math.min((contextUsage.current / contextUsage.max) * 100, 100).toFixed(1)}% · {(contextUsage.current / 1000).toFixed(0)}K / {(contextUsage.max / 1000).toFixed(0)}K
                  {contextUsage.cacheHitRate != null && contextUsage.cacheHitRate > 0 && (
                    <> · 缓存 {contextUsage.cacheHitRate.toFixed(0)}%</>
                  )}
                </span>
              </div>
              {showContextDetail && contextUsage.breakdown && (
                <div className="context-usage-detail">
                  {(contextUsage.cachedTokens != null && contextUsage.cachedTokens > 0) && (
                    <div className="context-detail-row context-detail-cache">
                      <span>API Prompt 缓存</span>
                      <span className="context-detail-cache-val">
                        {(contextUsage.cachedTokens / 1000).toFixed(1)}K tokens · 命中率 {contextUsage.cacheHitRate?.toFixed(1) ?? 0}%
                      </span>
                    </div>
                  )}
                  {(contextUsage.toolCacheHits != null || contextUsage.toolCacheMisses != null) && (
                    <div className="context-detail-row context-detail-cache">
                      <span>本地工具缓存</span>
                      <span className="context-detail-cache-val">
                        命中 {contextUsage.toolCacheHits ?? 0} · 未命中 {contextUsage.toolCacheMisses ?? 0}
                      </span>
                    </div>
                  )}
                  <div className="context-detail-row">
                    <span>系统提示词</span>
                    <span className="context-detail-bar-wrap">
                      <span className="context-detail-bar" style={{ width: `${(contextUsage.breakdown.system / contextUsage.max) * 100}%` }} />
                    </span>
                    <span className="context-detail-num">{(contextUsage.breakdown.system / 1000).toFixed(1)}K</span>
                  </div>
                  <div className="context-detail-row">
                    <span>对话历史</span>
                    <span className="context-detail-bar-wrap">
                      <span className="context-detail-bar" style={{ width: `${(contextUsage.breakdown.history / contextUsage.max) * 100}%` }} />
                    </span>
                    <span className="context-detail-num">{(contextUsage.breakdown.history / 1000).toFixed(1)}K</span>
                  </div>
                  <div className="context-detail-row">
                    <span>工具定义</span>
                    <span className="context-detail-bar-wrap">
                      <span className="context-detail-bar" style={{ width: `${(contextUsage.breakdown.toolDefs / contextUsage.max) * 100}%` }} />
                    </span>
                    <span className="context-detail-num">{(contextUsage.breakdown.toolDefs / 1000).toFixed(1)}K</span>
                  </div>
                  <div className="context-detail-row">
                    <span>工具结果</span>
                    <span className="context-detail-bar-wrap">
                      <span className="context-detail-bar" style={{ width: `${(contextUsage.breakdown.toolResults / contextUsage.max) * 100}%` }} />
                    </span>
                    <span className="context-detail-num">{(contextUsage.breakdown.toolResults / 1000).toFixed(1)}K</span>
                  </div>
                  <div className="context-detail-row">
                    <span>当前输出</span>
                    <span className="context-detail-bar-wrap">
                      <span className="context-detail-bar" style={{ width: `${(contextUsage.breakdown.currentOutput / contextUsage.max) * 100}%` }} />
                    </span>
                    <span className="context-detail-num">{(contextUsage.breakdown.currentOutput / 1000).toFixed(1)}K</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="composer-input-wrap">
            <SlashCommandMenu
              items={slashMenuItems}
              selectedIndex={slashSelected}
              onSelect={handleSlashSelect}
              visible={slashMenuOpen}
            />
            <textarea
              ref={textareaRef}
              className="composer-textarea"
              rows={1}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              placeholder="输入需求… 输入 / 查看命令与 Skills（Ctrl/⌘ + Enter 发送）"
            />
          </div>
          <div className="composer-actions">
            <span className="composer-hint">Ctrl/⌘ + Enter 发送</span>
            <div className="composer-buttons">
              {running ? (
                <button className="btn btn-danger" onClick={handleCancel}>
                  <IconStop /> 停止
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handleSubmit} disabled={!input.trim() || !session}>
                  <IconSend /> 发送
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 回退确认弹窗 */}
      {pendingRollback !== null && (
        <div className="modal-overlay" onClick={cancelRollback}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>确认回退</h2>
              <button className="icon-btn" onClick={cancelRollback}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p>回退操作将：</p>
              <ul>
                <li>恢复 Agent 修改过的文件到原始状态</li>
                <li>删除此轮对话及之后的所有消息</li>
              </ul>
              <p style={{ color: 'var(--danger)', fontWeight: 500 }}>此操作不可撤销，确定要继续吗？</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={cancelRollback}>取消</button>
              <button className="btn btn-danger" onClick={() => handleRollback(pendingRollback)}>确认回退</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 通知 */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
