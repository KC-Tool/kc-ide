// Koder 主进程 ↔ 渲染进程共享类型与 IPC 契约
// 任何跨进程通信都必须经过这里定义

import type { SkillDetail, SkillListItem } from './skills-types.js';
import type {
  SkillHubInstallResult,
  SkillHubSearchParams,
  SkillHubSearchResult,
} from './skillhub-types.js';
import type {
  AgentTeam,
  TeamDeleteResult,
  TeamListItem,
  TeamSaveResult,
} from './team-types.js';
import type { TodoItem } from './todo-types.js';
export type { SkillDetail, SkillListItem } from './skills-types.js';
export type {
  SkillHubInstallResult,
  SkillHubRemoteSkill,
  SkillHubSearchParams,
  SkillHubSearchResult,
} from './skillhub-types.js';

// ---- Agent 配置 ----

export type ReasoningEffort = 'off' | 'low' | 'medium' | 'high' | 'xhigh';

export interface AgentConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  /** 模型最大上下文窗口（token 数），默认 200K */
  maxContextTokens: number;
  /** 推理/思考强度（OpenAI reasoning_effort 等兼容参数，off 表示不传） */
  reasoningEffort: ReasoningEffort;
  /** 启用 API Prompt 缓存优化（静态前缀分离 + cache_control） */
  promptCacheEnabled: boolean;
  /** 启用本地工具结果缓存（read/grep/glob/list_dir） */
  toolCacheEnabled: boolean;
  /** 工具缓存最大条目数 */
  toolCacheMaxEntries: number;
  /** 工具缓存 TTL（毫秒），0 = 仅按文件 mtime 失效 */
  toolCacheTtlMs: number;
}

// ---- Agent 工具调用 ----

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  output: string;
  isError: boolean;
  /** write_file 时的文件快照（用于回退） */
  fileSnapshot?: FileSnapshot;
}

// ---- Agent 事件 ----

export interface AgentEvent {
  type: 'text_delta' | 'thinking_delta' | 'tool_call_delta' | 'tool_call_start' | 'tool_result' | 'error' | 'done' | 'context_usage' | 'subagent_start' | 'subagent_text_delta' | 'subagent_done';
  data?: string;
  toolCall?: ToolCallInfo;
  toolResult?: ToolResult;
  sessionId?: string;
  ts: number;
  /** todo 工具更新后会话待办已变更 */
  todosChanged?: boolean;
  /** 子 Agent 委派上下文 */
  subagent?: {
    memberId: string;
    memberName: string;
    task?: string;
    output?: string;
  };
  /** 上下文占用（token 数），含分段明细 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    maxContextTokens?: number;
    /** 各组件占用估算明细 */
    breakdown?: {
      system: number;
      history: number;
      toolDefs: number;
      toolResults: number;
      currentOutput: number;
    };
    /** API Prompt 缓存命中 token 数（provider 返回） */
    cachedTokens?: number;
    /** Prompt 缓存命中率 0-100 */
    cacheHitRate?: number;
    /** 本地工具缓存命中/未命中 */
    toolCacheHits?: number;
    toolCacheMisses?: number;
  };
}

/** 文件快照（用于回退 agent 的文件修改） */
export interface FileSnapshot {
  path: string;
  originalContent: string;
  isNew: boolean;
  /** 写入后的文件内容（用于 diff 预览） */
  newContent?: string;
}

export interface AgentRunRequest {
  sessionId: string;
  prompt: string;
  cwd?: string;
  /** 显式指定要激活的 Skill（也可由 slash 命令解析） */
  skillId?: string;
  /** 显式指定 Team，或 @create-team 模式 */
  teamId?: string;
  createTeam?: boolean;
}

// ---- 会话管理 ----

/** 消息片段（按模型输出顺序排列，用于交错渲染思考/文本/工具调用） */
export interface MessageSegment {
  type: 'thinking' | 'text' | 'tool_call';
  id: string;
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    input: string;
    output: string;
    status: 'running' | 'done' | 'error';
    fileSnapshot?: FileSnapshot;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  /** Agent 思考/推理过程 */
  thinking?: string;
  /** Agent 工具调用记录（嵌入在 assistant 消息中） */
  toolCalls?: Array<{
    id: string;
    name: string;
    input: string;
    output: string;
    status: 'running' | 'done' | 'error';
    fileSnapshot?: FileSnapshot;
  }>;
  /** 按时间顺序排列的片段（优先用于 UI 渲染） */
  segments?: MessageSegment[];
}

export interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  cwd?: string;
  model?: string;
  /** 当前会话激活的 Agent Team */
  activeTeamId?: string;
  /** 会话待办列表 */
  todos?: TodoItem[];
  /** 每轮 assistant 回复对应的文件快照（key = assistant message id） */
  fileSnapshots?: Record<string, FileSnapshot[]>;
}

export interface SessionListItem {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  cwd?: string;
  /** 工作区文件夹显示名（目录 basename） */
  cwdLabel?: string;
  /** ~/.koder/session/ 下的子目录名 */
  storageFolder: string;
  /** 侧边栏仓库分组显示名 */
  repoLabel: string;
}

/** 按工作区分组的会话树（侧边栏） */
export interface SessionRepoGroup {
  cwd?: string;
  storageFolder: string;
  repoLabel: string;
  sessions: SessionListItem[];
}

export interface SkillDeleteResult {
  ok: boolean;
  error?: string;
}

// ---- 设置 ----

export type ThemeMode = 'light' | 'dark';

export type Locale = 'zh' | 'en';

export interface AppSettings {
  theme: ThemeMode;
  fontSize: number;
  /** 界面语言 */
  locale: Locale;
  /** 已确认时间锚点说明弹窗 */
  dismissedTemporalNotice?: boolean;
  /** 新会话默认激活的 Agent Team */
  defaultTeamId?: string;
}

export type {
  AgentTeam,
  TeamDeleteResult,
  TeamListItem,
  TeamMember,
  TeamSaveResult,
  TeamSource,
} from './team-types.js';
export type { TodoItem } from './todo-types.js';

// ---- 文件浏览 ----

export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
}

// ---- 应用信息 ----

export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  node: string;
  agentConfigured: boolean;
  agentModel: string;
}

// ---- 预加载 API 形状 ----

export type Unsubscribe = () => void;

export interface KoderAPI {
  getAppInfo(): Promise<AppInfo>;

  // Agent
  getAgentConfig(): Promise<AgentConfig>;
  updateAgentConfig(patch: Partial<AgentConfig>): Promise<AgentConfig>;
  runAgent(req: AgentRunRequest, onEvent: (e: AgentEvent) => void): Promise<{ sessionId: string; unsubscribe: Unsubscribe }>;
  cancelAgent(sessionId: string): Promise<{ ok: boolean }>;

  // 会话
  getSessions(): Promise<SessionListItem[]>;
  getSession(id: string): Promise<Session | null>;
  createSession(cwd?: string): Promise<Session>;
  getSessionRepoTree(): Promise<SessionRepoGroup[]>;
  deleteSession(id: string): Promise<void>;
  addMessage(sessionId: string, msg: ChatMessage): Promise<void>;
  updateSession(sessionId: string, patch: Partial<Pick<Session, 'title' | 'cwd' | 'model' | 'activeTeamId'>>): Promise<void>;

  // Agent Teams
  getTeams(): Promise<TeamListItem[]>;
  getTeam(id: string): Promise<AgentTeam | null>;
  saveTeam(team: AgentTeam): Promise<TeamSaveResult>;
  deleteTeam(id: string): Promise<TeamDeleteResult>;
  reloadTeams(): Promise<TeamListItem[]>;
  onTeamsChanged(cb: () => void): Unsubscribe;

  getSessionTodos(sessionId: string): Promise<TodoItem[]>;
  toggleSessionTodo(sessionId: string, todoId: string, done?: boolean): Promise<TodoItem[]>;
  onSessionTodosChanged(cb: (payload: { sessionId: string }) => void): Unsubscribe;

  // 设置
  getSettings(): Promise<AppSettings>;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;

  // 文件浏览
  readDir(dirPath?: string): Promise<DirEntry[]>;
  selectDirectory(): Promise<string | null>;

  // 回退
  rollback(sessionId: string, fromMessageIndex: number): Promise<{ ok: boolean; filesRestored: number; messagesRemoved: number }>;

  // Skills
  getSkills(): Promise<SkillListItem[]>;
  getSkill(id: string): Promise<SkillDetail | null>;
  reloadSkills(): Promise<SkillListItem[]>;
  searchSkillHub(params: SkillHubSearchParams): Promise<SkillHubSearchResult>;
  installSkillFromSkillHub(slug: string): Promise<SkillHubInstallResult>;
  deleteSkill(id: string): Promise<SkillDeleteResult>;
  onSkillsChanged(cb: () => void): Unsubscribe;

  // 消息保存通知（主进程→渲染进程）
  onMessageSaved(cb: (payload: { sessionId: string }) => void): Unsubscribe;
}

declare global {
  interface Window {
    koder: KoderAPI;
  }
}
