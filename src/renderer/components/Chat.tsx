import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AgentEvent, ChatMessage, FileSnapshot, Session, Unsubscribe } from '../../shared/ipc';
import type { SkillListItem } from '../../shared/skills-types';
import { formatAtHelpLocalized, formatHelpLocalized, formatSkillsListLocalized, formatTeamsListLocalized } from '../../shared/i18n';
import { parseSlashCommand } from '../../shared/skills-types';
import { parseAtCommand } from '../../shared/team-types';
import type { TeamListItem, TodoItem } from '../../shared/ipc';
import TodoPanel from './TodoPanel';
import SubAgentPanel, { type SubAgentRun } from './SubAgentPanel';
import { useI18n } from '../contexts/I18nContext';
import Modal, { useModalClose } from './Modal';
import ChatHeader from './ChatHeader';
import ChatMessageList from './ChatMessageList';
import ChatComposer from './ChatComposer';
import type { InteractionMode } from '../../shared/agent-modes';
import { PLAN_BUILD_USER_PREFIX } from '../../shared/agent-modes';
import PlanPanel from './PlanPanel';
import PlanModal from './PlanModal';
import { formatTokenCount } from '../lib/format-tokens';
import { applyAppFrameRate } from '../lib/apply-frame-rate';
import { hydrateMessagesProgressive } from '../lib/hydrate-messages';
import { createStickToBottomScheduler, isNearBottom, scrollToBottomSmooth } from '../lib/stick-to-bottom';
import {
  extractAssistantText,
  segmentsToPersisted,
  type ToolCallInline,
  type UiMessage,
  type UiSegment,
} from '../lib/chat-message-model';

interface Props {
  session: Session | null;
  onAddMessage: (msg: ChatMessage) => Promise<void>;
  onOpenFileBrowser: (cwd: string) => void;
  onWorkspaceChange: () => void;
  onRollback: () => void;
}

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

export default function Chat({ session, onAddMessage, onOpenFileBrowser, onWorkspaceChange, onRollback }: Props) {
  const { t, locale, settings } = useI18n();
  const [uiMessages, setUiMessages] = useState<UiMessage[]>([]);
  const [messagesHydrating, setMessagesHydrating] = useState(false);
  const [running, setRunning] = useState(false);
  const skillsRef = useRef<SkillListItem[]>([]);
  const teamsRef = useRef<TeamListItem[]>([]);
  const [unsubscribe, setUnsubscribe] = useState<Unsubscribe | null>(null);

  // 回退确认弹窗状态
  const [pendingRollback, setPendingRollback] = useState<number | null>(null);
  // Toast 通知
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const maxContextRef = useRef(200000);
  // 上下文占用显示（max 来自设置 → 模型 → 最大上下文）
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
  const [showContextDetail, setShowContextDetail] = useState(true);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoPanelCollapsed, setTodoPanelCollapsed] = useState(false);
  const [subagentRuns, setSubagentRuns] = useState<SubAgentRun[]>([]);
  const [agentMode, setAgentMode] = useState<InteractionMode>('agent');
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [pendingPlanPath, setPendingPlanPath] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const agentModeRef = useRef<InteractionMode>('agent');
  const [modelName, setModelName] = useState('');
  const [modelConfigured, setModelConfigured] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  useEffect(() => {
    agentModeRef.current = agentMode;
    if (agentMode !== 'plan') {
      setPendingPlan(null);
      setPendingPlanPath(null);
      setPlanModalOpen(false);
    }
  }, [agentMode]);

  // 切换会话时强制重置为 agent 模式，避免 plan 状态污染新会话
  useEffect(() => {
    setAgentMode('agent');
    setPendingPlan(null);
    setPendingPlanPath(null);
    setPlanModalOpen(false);
  }, [session]);

  const applyAgentConfig = useCallback((cfg: { maxContextTokens?: number; appFrameRate?: number }) => {
    if (cfg.maxContextTokens != null && cfg.maxContextTokens > 0) {
      maxContextRef.current = cfg.maxContextTokens;
      setContextUsage((prev) => ({ ...prev, max: cfg.maxContextTokens! }));
    }
    if (cfg.appFrameRate != null) {
      applyAppFrameRate(document.documentElement, cfg.appFrameRate);
    }
  }, []);

  useEffect(() => {
    void window.koder.getAgentConfig().then(applyAgentConfig);
    return window.koder.onConfigUpdated(applyAgentConfig);
  }, [applyAgentConfig]);

  useEffect(() => {
    return window.koder.onPlanSaved((payload) => {
      if (session && payload.sessionId !== session.id) return;
      setPendingPlan(payload.markdown);
      setPendingPlanPath(payload.filePath);
      setPlanModalOpen(true);
    });
  }, [session?.id]);

  const stickToBottomRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickScrollRef = useRef(createStickToBottomScheduler(() => scrollRef.current));
  const messagesRef = useRef<UiMessage[]>(uiMessages);
  const currentAssistantId = useRef<string | null>(null);
  const currentToolCalls = useRef<ToolCallInline[]>([]);

  // session 切换时分块加载消息，避免阻塞输入
  useEffect(() => {
    let cancelled = false;

    if (!session) {
      setUiMessages([]);
      setMessagesHydrating(false);
      setRunning(false);
      setContextUsage({ current: 0, max: maxContextRef.current });
      setShowContextDetail(false);
      currentAssistantId.current = null;
      currentToolCalls.current = [];
      if (unsubscribe) {
        unsubscribe();
        setUnsubscribe(null);
      }
      return;
    }

    setRunning(false);
    setContextUsage({ current: 0, max: maxContextRef.current });
    setShowContextDetail(false);
    currentAssistantId.current = null;
    currentToolCalls.current = [];
    if (unsubscribe) {
      unsubscribe();
      setUnsubscribe(null);
    }

    setUiMessages([]);
    setMessagesHydrating(true);
    void hydrateMessagesProgressive(session.messages, (msgs, hydrating) => {
      if (cancelled) return;
      setUiMessages(msgs);
      setMessagesHydrating(hydrating);
    });

    return () => { cancelled = true; };
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesRef.current = uiMessages;
  }, [uiMessages]);

  const ensureCatalogForSubmit = useCallback(async () => {
    if (skillsRef.current.length === 0) {
      skillsRef.current = await window.koder.getSkills();
    }
    if (teamsRef.current.length === 0) {
      teamsRef.current = await window.koder.getTeams();
    }
  }, []);

  const loadTodos = useCallback(async () => {
    if (!session) {
      setTodos([]);
      return;
    }
    const list = await window.koder.getSessionTodos(session.id);
    setTodos(list);
  }, [session]);

  useEffect(() => {
    void loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    if (!session) return;
    const unsubTodos = window.koder.onSessionTodosChanged(({ sessionId }) => {
      if (sessionId === session.id) void loadTodos();
    });
    return unsubTodos;
  }, [session, loadTodos]);

  useEffect(() => {
    void window.koder.getAppInfo().then((info) => {
      setModelName(info.agentModel);
      setModelConfigured(info.agentConfigured);
    });
  }, [session?.id, running]);

  const handleThreadScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = isNearBottom(el);
    setShowScrollBottom(!stickToBottomRef.current && uiMessages.length > 0);
  }, [uiMessages.length]);

  // 自动贴底：layout 阶段 instant 滚动，合并到每帧一次（不用 smooth）
  useLayoutEffect(() => {
    if (stickToBottomRef.current) {
      stickScrollRef.current.schedule();
    }
  }, [uiMessages, subagentRuns, running]);

  useEffect(() => () => stickScrollRef.current.cancel(), []);

  const scrollToBottom = useCallback(() => {
    stickToBottomRef.current = true;
    const el = scrollRef.current;
    if (el) scrollToBottomSmooth(el);
    setShowScrollBottom(false);
  }, []);

  // 自动清除 Toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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

  const effectiveTeamId = session?.activeTeamId ?? settings?.defaultTeamId;

  const handleSubmit = useCallback(async (promptOverride?: string) => {
    const isPlanBuild = !!promptOverride && promptOverride.startsWith(PLAN_BUILD_USER_PREFIX);
    const prompt = (promptOverride ?? '').trim();
    if (!prompt || running || !session) return;

    await ensureCatalogForSubmit();
    const teams = teamsRef.current;
    const skills = skillsRef.current;
    const teamIds = teams.map(t => t.id);
    const skillIds = skills.map(s => s.id);

    let runPrompt: string;
    let displayPrompt: string;
    let activeSkillId: string | undefined;
    let createTeam = false;
    let activeTeamId: string | undefined;
    const interactionMode: InteractionMode = isPlanBuild ? 'agent' : agentMode;

    if (isPlanBuild) {
      runPrompt = prompt;
      displayPrompt = t('agent.plan.buildUser');
      activeTeamId = session.activeTeamId ?? settings?.defaultTeamId;
    } else {
      const atParsed = parseAtCommand(prompt, teamIds);

      if (atParsed.type === 'list_teams') {
        await appendSystemInfo(formatTeamsListLocalized(locale, teams));
        return;
      }
      if (atParsed.type === 'list_help') {
        await appendSystemInfo(formatAtHelpLocalized(locale));
        return;
      }
      if (atParsed.type === 'activate_team') {
        await window.koder.updateSession(session.id, { activeTeamId: atParsed.teamId });
        onWorkspaceChange();
        const team = teams.find(t => t.id === atParsed.teamId);
        await appendSystemInfo(
          locale === 'en'
            ? `Agent Team **${team?.name ?? atParsed.teamId}** activated for this session.`
            : `已为本会话激活 Agent Team：**${team?.name ?? atParsed.teamId}**（\`${atParsed.teamId}\`）`,
        );
        if (!atParsed.userMessage.trim()) return;
      }

      let agentPrompt = atParsed.type === 'activate_team' ? atParsed.userMessage : prompt;
      createTeam = atParsed.type === 'create_team';
      if (createTeam) {
        agentPrompt = atParsed.userMessage || (locale === 'en' ? 'Create a software dev agent team.' : '创建一个适合软件开发的多角色 Agent Team。');
      }

      const parsed = parseSlashCommand(createTeam ? '' : agentPrompt, skillIds);

      if (!createTeam && parsed.type === 'list_skills') {
        await appendSystemInfo(formatSkillsListLocalized(locale, skills));
        return;
      }
      if (!createTeam && parsed.type === 'list_help') {
        await appendSystemInfo(formatHelpLocalized(locale));
        return;
      }

      runPrompt = agentPrompt;
      activeSkillId = undefined;
      if (!createTeam && parsed.type === 'invoke_skill' && parsed.skillId) {
        activeSkillId = parsed.skillId;
        runPrompt = parsed.userMessage || (locale === 'en' ? 'Follow the skill instructions.' : '请按照该 Skill 的指引完成任务。');
      }

      activeTeamId =
        interactionMode === 'agent'
          ? (atParsed.type === 'activate_team'
            ? atParsed.teamId
            : session.activeTeamId ?? settings?.defaultTeamId)
          : undefined;

      displayPrompt = createTeam
        ? `@create-team ${agentPrompt}`
        : atParsed.type === 'activate_team'
          ? `@team ${atParsed.teamId} ${agentPrompt}`.trim()
          : prompt;
    }

    setRunning(true);
    setSubagentRuns([]);
    currentToolCalls.current = [];

    const now = Date.now();
    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();
    currentAssistantId.current = assistantMsgId;

    const userMsg: UiMessage = {
      id: userMsgId, role: 'user', text: displayPrompt, timestamp: now, toolCalls: [], thinkingSegments: [], segments: [],
    };
    const assistantMsg: UiMessage = {
      id: assistantMsgId, role: 'assistant', text: '', timestamp: now + 1, toolCalls: [], streaming: true, thinkingSegments: [], segments: [],
    };

    setUiMessages((prev) => [...prev, userMsg, assistantMsg]);

    await onAddMessage({ id: userMsgId, role: 'user', text: displayPrompt, timestamp: now });

    try {
      const { sessionId, unsubscribe: unsub } = await window.koder.runAgent(
        {
          sessionId: session.id,
          prompt: runPrompt,
          cwd: session.cwd || undefined,
          skillId: activeSkillId,
          teamId: activeTeamId,
          createTeam,
          interactionMode,
        },
        (e: AgentEvent) => {
          if (e.type === 'subagent_start' && e.subagent) {
            setSubagentRuns((prev) => [
              ...prev,
              {
                key: `${e.subagent!.memberId}-${Date.now()}`,
                memberId: e.subagent!.memberId,
                memberName: e.subagent!.memberName,
                task: e.subagent!.task ?? e.data ?? '',
                output: '',
                running: true,
              },
            ]);
            return;
          }
          if (e.type === 'subagent_text_delta' && e.subagent) {
            const mid = e.subagent.memberId;
            setSubagentRuns((prev) => {
              const idx = [...prev].reverse().findIndex(r => r.memberId === mid && r.running);
              if (idx === -1) return prev;
              const realIdx = prev.length - 1 - idx;
              return prev.map((r, i) =>
                i === realIdx ? { ...r, output: r.output + (e.data ?? '') } : r,
              );
            });
            return;
          }
          if (e.type === 'subagent_done' && e.subagent) {
            const mid = e.subagent.memberId;
            setSubagentRuns((prev) => {
              const idx = [...prev].reverse().findIndex(r => r.memberId === mid && r.running);
              if (idx === -1) return prev;
              const realIdx = prev.length - 1 - idx;
              return prev.map((r, i) =>
                i === realIdx
                  ? { ...r, running: false, output: e.subagent!.output ?? r.output }
                  : r,
              );
            });
            return;
          }

          if (e.subagent) return;

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
                // 工具结果到达时立即关闭 thinking streaming，否则 ThinkingBlock 不展开
                const closed = closeStreamingThinking(segments).map(s =>
                  s.type === 'thinking' ? { ...s, streaming: false } : s,
                );
                return { ...m, ...patchFromSegments(closed) };
              }),
            );
            if (e.todosChanged) void loadTodos();
          } else if (e.type === 'error') {
            setUiMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                const segments = applyTextDelta(m.segments, `\n\n**${t('chat.error')}**: ${e.data ?? t('chat.errorUnknown')}`);
                const closed = closeStreamingThinking(segments).map(s =>
                  s.type === 'thinking' ? { ...s, streaming: false } : s,
                );
                return { ...m, ...patchFromSegments(closed), streaming: false };
              }),
            );
            setRunning(false);
          } else if (e.type === 'done') {
            setUiMessages((prev) => {
              const updated = prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                const closed = closeStreamingThinking(m.segments);
                return {
                  ...m,
                  ...patchFromSegments(closed),
                  streaming: false,
                };
              });
              if (agentModeRef.current === 'plan') {
                const msg = updated.find((m) => m.id === assistantMsgId);
                if (msg) {
                  const planText = extractAssistantText(msg);
                  if (planText) {
                    setPendingPlan(planText);
                    // plan:saved 事件由主进程写入 ~/.koder/plan/ 后触发并打开弹窗
                  }
                }
              }
              return updated;
            });
            setRunning(false);
          } else if (e.type === 'context_usage' && e.usage) {
            setContextUsage((prev) => ({
              current: e.usage!.totalTokens,
              max: e.usage!.maxContextTokens ?? maxContextRef.current,
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
            ? { ...m, text: `**${t('chat.error')}**: ${(err as Error).message}`, streaming: false }
            : m,
        ),
      );
      setRunning(false);
    }
  }, [running, session, onAddMessage, locale, appendSystemInfo, settings?.defaultTeamId, agentMode, onWorkspaceChange, t, ensureCatalogForSubmit]);

  const handleBuildPlan = useCallback(() => {
    if (!pendingPlan) return;
    const plan = pendingPlan;
    setPendingPlan(null);
    setAgentMode('agent');
    void handleSubmit(PLAN_BUILD_USER_PREFIX + plan);
  }, [pendingPlan, handleSubmit]);

  // 主进程的 agent:run .then() 负责保存 assistant 消息，此处不做重复保存

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
    const result = await window.koder.rollback(session.id, assistantMsgIndex);
    if (result.ok) {
      setUiMessages((prev) => prev.slice(0, assistantMsgIndex));
      onRollback();
      setToast({
        message: t('chat.rollback.ok', { files: result.filesRestored, msgs: result.messagesRemoved }),
        type: 'success',
      });
    } else {
      setToast({ message: t('chat.rollback.fail'), type: 'error' });
    }
  }, [session, running, onRollback]);

  /** 点击回退按钮时，弹出确认框 */
  const confirmRollback = useCallback((assistantMsgIndex: number) => {
    setPendingRollback(assistantMsgIndex);
  }, []);

  const contextPercent = contextUsage.max > 0
    ? (contextUsage.current / contextUsage.max) * 100
    : 0;
  const sessionTitle = session?.title?.trim()
    || (session?.cwd ? session.cwd.split(/[\\/]/).pop() : undefined);

  return (
    <div className="agent-panel">
      <ChatHeader
        title={sessionTitle}
        modelName={modelName}
        configured={modelConfigured}
        mode={agentMode}
        onModeChange={setAgentMode}
        contextPercent={contextPercent}
        hasContextUsage={contextUsage.current > 0}
        showContextDetail={showContextDetail}
        onToggleContext={() => setShowContextDetail(prev => !prev)}
        running={running}
      />

      <div className="agent-thread-wrap">
        <div className="agent-thread" ref={scrollRef} onScroll={handleThreadScroll}>
          <ChatMessageList
            messages={uiMessages}
            running={running}
            hydrating={messagesHydrating}
            emptyTitle={t('chat.empty.title')}
            emptyDesc={t('chat.empty.desc')}
            modeAgentLabel={t('agent.mode.agent')}
            modePlanLabel={t('agent.mode.plan')}
            planningLabel={t('agent.planning')}
            thoughtLabel={t('agent.thought')}
            thoughtNLabel={(n) => `${t('agent.thought')} ${n}`}
            rollbackLabel={t('chat.rollback')}
            rollbackTitle={t('chat.rollback.warn')}
            onRollback={confirmRollback}
          />
        </div>

        {showScrollBottom && (
          <button type="button" className="agent-scroll-bottom" onClick={scrollToBottom}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {t('agent.scrollBottom')}
          </button>
        )}
      </div>

      <div className="agent-composer">
        <div className="agent-composer-inner">
          {showContextDetail && contextUsage.breakdown && (
            <div className="context-usage-detail agent-context-detail">
              {(contextUsage.cachedTokens != null && contextUsage.cachedTokens > 0) && (
                <div className="context-detail-row context-detail-cache">
                  <span>{t('chat.context.apiCache')}</span>
                  <span className="context-detail-cache-val">
                    {formatTokenCount(contextUsage.cachedTokens)} tokens · {t('chat.context.cacheHit')} {contextUsage.cacheHitRate?.toFixed(1) ?? 0}%
                  </span>
                </div>
              )}
              {(contextUsage.toolCacheHits != null || contextUsage.toolCacheMisses != null) && (
                <div className="context-detail-row context-detail-cache">
                  <span>{t('chat.context.toolCache')}</span>
                  <span className="context-detail-cache-val">
                    {t('chat.context.hits')} {contextUsage.toolCacheHits ?? 0} · {t('chat.context.misses')} {contextUsage.toolCacheMisses ?? 0}
                  </span>
                </div>
              )}
              <div className="context-detail-row">
                <span>{t('chat.context.system')}</span>
                <span className="context-detail-bar-wrap">
                  <span className="context-detail-bar" style={{ width: `${(contextUsage.breakdown.system / contextUsage.max) * 100}%` }} />
                </span>
                <span className="context-detail-num">{formatTokenCount(contextUsage.breakdown.system)}</span>
              </div>
              <div className="context-detail-row">
                <span>{t('chat.context.history')}</span>
                <span className="context-detail-bar-wrap">
                  <span className="context-detail-bar" style={{ width: `${(contextUsage.breakdown.history / contextUsage.max) * 100}%` }} />
                </span>
                <span className="context-detail-num">{formatTokenCount(contextUsage.breakdown.history)}</span>
              </div>
              <div className="context-detail-row">
                <span>{t('chat.context.toolDefs')}</span>
                <span className="context-detail-bar-wrap">
                  <span className="context-detail-bar" style={{ width: `${(contextUsage.breakdown.toolDefs / contextUsage.max) * 100}%` }} />
                </span>
                <span className="context-detail-num">{formatTokenCount(contextUsage.breakdown.toolDefs)}</span>
              </div>
              <div className="context-detail-row">
                <span>{t('chat.context.toolResults')}</span>
                <span className="context-detail-bar-wrap">
                  <span className="context-detail-bar" style={{ width: `${(contextUsage.breakdown.toolResults / contextUsage.max) * 100}%` }} />
                </span>
                <span className="context-detail-num">{formatTokenCount(contextUsage.breakdown.toolResults)}</span>
              </div>
              <div className="context-detail-row">
                <span>{t('chat.context.output')}</span>
                <span className="context-detail-bar-wrap">
                  <span className="context-detail-bar" style={{ width: `${(contextUsage.breakdown.currentOutput / contextUsage.max) * 100}%` }} />
                </span>
                <span className="context-detail-num">{formatTokenCount(contextUsage.breakdown.currentOutput)}</span>
              </div>
            </div>
          )}

          {subagentRuns.length > 0 && <SubAgentPanel runs={subagentRuns} />}
          {todos.length > 0 && (
            <TodoPanel
              todos={todos}
              collapsed={todoPanelCollapsed}
              onToggleCollapse={() => setTodoPanelCollapsed(c => !c)}
            />
          )}

          {pendingPlan && agentMode === 'plan' && !running && (
            <PlanPanel
              planMarkdown={pendingPlan}
              filePath={pendingPlanPath ?? undefined}
              onBuild={handleBuildPlan}
              onDismiss={() => {
                setPendingPlan(null);
                setPendingPlanPath(null);
              }}
              onView={() => setPlanModalOpen(true)}
            />
          )}

          {planModalOpen && pendingPlan && (
            <PlanModal
              markdown={pendingPlan}
              filePath={pendingPlanPath ?? undefined}
              onBuild={handleBuildPlan}
              onDismiss={() => setPlanModalOpen(false)}
            />
          )}

          <ChatComposer
            session={session}
            running={running}
            agentMode={agentMode}
            effectiveTeamId={effectiveTeamId}
            onSubmit={(text) => { void handleSubmit(text); }}
            onStop={handleCancel}
            onSelectWorkspace={handleSelectWorkspace}
            onSlashSelect={() => {}}
          />
        </div>
      </div>

      {/* 回退确认弹窗 */}
      {pendingRollback !== null && (
        <Modal onClose={() => setPendingRollback(null)} panelClassName="modal-sm">
          <RollbackConfirmDialog
            index={pendingRollback}
            onConfirm={handleRollback}
          />
        </Modal>
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

function RollbackConfirmDialog({
  index,
  onConfirm,
}: {
  index: number;
  onConfirm: (assistantMsgIndex: number) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const requestClose = useModalClose();

  return (
    <>
      <div className="modal-header">
        <h2>{t('chat.rollback.title')}</h2>
        <button type="button" className="icon-btn" onClick={requestClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="modal-body">
        <p>{t('chat.rollback.body1')}</p>
        <ul>
          <li>{t('chat.rollback.li1')}</li>
          <li>{t('chat.rollback.li2')}</li>
        </ul>
        <p style={{ color: 'var(--danger)', fontWeight: 500 }}>{t('chat.rollback.warn')}</p>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={requestClose}>{t('chat.cancel')}</button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            requestClose();
            void onConfirm(index);
          }}
        >
          {t('chat.confirmRollback')}
        </button>
      </div>
    </>
  );
}
