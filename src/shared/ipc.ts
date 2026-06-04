// Koder 主进程 ↔ 渲染进程共享类型与 IPC 契约
// 任何跨进程通信都必须经过这里定义

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
  type: 'text_delta' | 'thinking_delta' | 'tool_call_delta' | 'tool_call_start' | 'tool_result' | 'error' | 'done' | 'context_usage';
  data?: string;
  toolCall?: ToolCallInfo;
  toolResult?: ToolResult;
  sessionId?: string;
  ts: number;
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
}

import type { SkillDetail, SkillListItem } from './skills-types.js';
export type { SkillDetail, SkillListItem } from './skills-types.js';

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
  /** 每轮 assistant 回复对应的文件快照（key = assistant message id） */
  fileSnapshots?: Record<string, FileSnapshot[]>;
}

export interface SessionListItem {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
}

// ---- 设置 ----

export type ThemeMode = 'light' | 'dark';

export interface AppSettings {
  theme: ThemeMode;
  fontSize: number;
}

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
  createSession(): Promise<Session>;
  deleteSession(id: string): Promise<void>;
  addMessage(sessionId: string, msg: ChatMessage): Promise<void>;
  updateSession(sessionId: string, patch: Partial<Pick<Session, 'title' | 'cwd' | 'model'>>): Promise<void>;

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

  // 消息保存通知（主进程→渲染进程）
  onMessageSaved(cb: (payload: { sessionId: string }) => void): Unsubscribe;
}

declare global {
  interface Window {
    koder: KoderAPI;
  }
}
