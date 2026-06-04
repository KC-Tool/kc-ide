// Koder 主进程入口
// - 创建 BrowserWindow
// - 注册 IPC：Agent 引擎、会话管理、设置管理、配置管理、文件浏览
// - 开发模式加载 Vite dev server，生产模式加载本地静态文件

import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { SessionManager } from './session-manager.js';
import { SettingsManager } from './settings-manager.js';
import { ConfigManager } from './config-manager.js';
import { AgentEngine } from './agent-engine.js';
import { globalSkillsManager } from './skills-manager.js';
import { parseSlashCommand } from '../shared/skills-types.js';
import type {
  AgentConfig,
  AgentEvent,
  AgentRunRequest,
  AppInfo,
  AppSettings,
  ChatMessage,
  DirEntry,
  FileSnapshot,
  MessageSegment,
  Session,
  SessionListItem,
} from '../shared/ipc.js';

const isDev = !app.isPackaged && process.env.KODER_DEV !== '0';
const VITE_DEV_URL = process.env.VITE_DEV_URL ?? 'http://localhost:5173';

let mainWindow: BrowserWindow | null = null;
let APP_ROOT = '';
let PRELOAD_PATH = '';
let RENDERER_DIST = '';

const sessions = new SessionManager();
const settings = new SettingsManager();
const configManager = new ConfigManager();
const agentEngine = new AgentEngine();

function buildEffectiveSystemPrompt(base: string): string {
  return base + globalSkillsManager.buildCatalogForSystemPrompt();
}

function buildAppInfo(): AppInfo {
  const cfg = configManager.get();
  return {
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron ?? 'unknown',
    node: process.versions.node,
    agentConfigured: configManager.isConfigured(),
    agentModel: cfg.model,
  };
}

function resolvePaths() {
  APP_ROOT = app.getAppPath();
  PRELOAD_PATH = path.join(APP_ROOT, 'src', 'preload', 'index.cjs');
  RENDERER_DIST = path.join(APP_ROOT, 'dist', 'renderer');

  console.log('[koder main] APP_ROOT     =', APP_ROOT);
  console.log('[koder main] PRELOAD_PATH =', PRELOAD_PATH, 'exists =', fs.existsSync(PRELOAD_PATH));
  console.log('[koder main] RENDERER_DIR =', RENDERER_DIST, 'exists =', fs.existsSync(RENDERER_DIST));
  console.log('[koder main] isDev        =', isDev);
}

async function createMainWindow() {
  const currentSettings = settings.get();
  const bgColor = currentSettings.theme === 'dark' ? '#0f1115' : '#ffffff';

  const iconPath = path.join(APP_ROOT, 'build', 'icon.png');
  const appIcon = fs.existsSync(iconPath) ? iconPath : undefined;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 880,
    minHeight: 560,
    show: false,
    backgroundColor: bgColor,
    title: 'Koder',
    icon: appIcon,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // F12 切换开发者工具（不自动打开）
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      event.preventDefault();
      mainWindow?.webContents.toggleDevTools();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    await mainWindow.loadURL(VITE_DEV_URL);
  } else {
    await mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---- IPC: 应用信息 ----

ipcMain.handle('app:info', (): AppInfo => buildAppInfo());

// ---- IPC: Agent 配置 ----

ipcMain.handle('config:get', (): AgentConfig => {
  return configManager.get();
});

ipcMain.handle('config:update', (_event, patch: Partial<AgentConfig>): AgentConfig => {
  return configManager.update(patch);
});

// ---- IPC: Agent 运行 ----

ipcMain.handle('agent:run', async (event, req: AgentRunRequest) => {
  const sender = event.sender;
  const agentConfig = configManager.get();

  if (!configManager.isConfigured()) {
    sender.send('agent:event', {
      type: 'error',
      data: '未配置 API Key。请在设置中配置模型信息。',
      sessionId: req.sessionId,
      ts: Date.now(),
    } as AgentEvent);
    return { sessionId: req.sessionId };
  }

  // 获取会话历史，构建对话上下文
  const session = sessions.get(req.sessionId);
  const cwd = session?.cwd || req.cwd || app.getPath('home');

  const skillIds = globalSkillsManager.listIds();
  let userPrompt = req.prompt;
  let activeSkillId = req.skillId;

  if (!activeSkillId) {
    const parsed = parseSlashCommand(req.prompt, skillIds);
    if (parsed.type === 'invoke_skill' && parsed.skillId) {
      activeSkillId = parsed.skillId;
      userPrompt = parsed.userMessage || '请按照该 Skill 的指引完成任务。';
    }
  }

  if (activeSkillId) {
    const injection = globalSkillsManager.buildInjection(activeSkillId);
    if (injection) {
      userPrompt = injection + '\n' + userPrompt;
    } else {
      userPrompt = `[Skill not found: ${activeSkillId}]\n\n` + userPrompt;
    }
  }

  const effectiveConfig: AgentConfig = {
    ...agentConfig,
    systemPrompt: buildEffectiveSystemPrompt(agentConfig.systemPrompt),
  };

  const conversationHistory = (session?.messages ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.text,
  }));

  conversationHistory.push({
    role: 'user' as const,
    content: userPrompt,
  });

  // 收集文件快照（用于回退）
  const fileSnapshots: FileSnapshot[] = [];

  // 收集 streaming 过程中的 assistant 内容
  let assistantText = '';
  let assistantThinking = '';
  let assistantToolCalls: ChatMessage['toolCalls'] = [];
  const assistantSegments: MessageSegment[] = [];

  const appendThinkingSegment = (data: string) => {
    assistantThinking += data;
    const last = assistantSegments[assistantSegments.length - 1];
    if (last?.type === 'thinking') {
      last.content = (last.content ?? '') + data;
    } else {
      assistantSegments.push({ type: 'thinking', id: randomUUID(), content: data });
    }
  };

  const appendTextSegment = (data: string) => {
    assistantText += data;
    const last = assistantSegments[assistantSegments.length - 1];
    if (last?.type === 'text') {
      last.content = (last.content ?? '') + data;
    } else {
      assistantSegments.push({ type: 'text', id: randomUUID(), content: data });
    }
  };

  // 异步运行 agent
  void agentEngine.run(effectiveConfig, conversationHistory as any, cwd, (agentEvent) => {
    if (!sender.isDestroyed()) {
      if (agentEvent.type === 'text_delta') {
        appendTextSegment(agentEvent.data ?? '');
      } else if (agentEvent.type === 'thinking_delta') {
        appendThinkingSegment(agentEvent.data ?? '');
      } else if (agentEvent.type === 'tool_call_start' && agentEvent.toolCall) {
        assistantToolCalls.push({
          id: agentEvent.toolCall.id,
          name: agentEvent.toolCall.name,
          input: agentEvent.toolCall.arguments,
          output: '',
          status: 'running',
        });
        assistantSegments.push({
          type: 'tool_call',
          id: agentEvent.toolCall.id,
          toolCall: {
            id: agentEvent.toolCall.id,
            name: agentEvent.toolCall.name,
            input: agentEvent.toolCall.arguments,
            output: '',
            status: 'running',
          },
        });
      } else if (agentEvent.type === 'tool_result' && agentEvent.toolResult) {
        const existing = assistantToolCalls.find(tc => tc.id === agentEvent.toolResult!.toolCallId);
        if (existing) {
          existing.output = agentEvent.toolResult.output;
          existing.status = agentEvent.toolResult.isError ? 'error' : 'done';
          if (agentEvent.toolResult.fileSnapshot) {
            existing.fileSnapshot = agentEvent.toolResult.fileSnapshot;
          }
        }
        const seg = assistantSegments.find(
          s => s.type === 'tool_call' && s.toolCall?.id === agentEvent.toolResult!.toolCallId,
        );
        if (seg?.toolCall) {
          seg.toolCall.output = agentEvent.toolResult.output;
          seg.toolCall.status = agentEvent.toolResult.isError ? 'error' : 'done';
          if (agentEvent.toolResult.fileSnapshot) {
            seg.toolCall.fileSnapshot = agentEvent.toolResult.fileSnapshot;
          }
        }
        if (agentEvent.toolResult.fileSnapshot) {
          fileSnapshots.push(agentEvent.toolResult.fileSnapshot);
        }
      }
      sender.send('agent:event', { ...agentEvent, sessionId: req.sessionId });
    }
  }).then(() => {
    // agent 运行结束后：先保存 assistant 消息，再保存快照
    if (!sender.isDestroyed()) {
      const assistantMsg: ChatMessage = {
        id: randomUUID(),
        role: 'assistant',
        text: assistantText,
        timestamp: Date.now(),
        thinking: assistantThinking || undefined,
        toolCalls: assistantToolCalls.length > 0 ? assistantToolCalls : undefined,
        segments: assistantSegments.length > 0 ? assistantSegments : undefined,
      };
      sessions.addMessage(req.sessionId, assistantMsg);

      if (fileSnapshots.length > 0) {
        sessions.saveSnapshots(req.sessionId, assistantMsg.id, fileSnapshots);
      }

      // 通知渲染进程刷新
      if (!sender.isDestroyed()) {
        sender.send('agent:message_saved', { sessionId: req.sessionId });
      }
    }
  });

  return { sessionId: req.sessionId };
});

ipcMain.handle('agent:cancel', async (_event, sessionId: string) => {
  return { ok: agentEngine.cancel(sessionId) };
});

// ---- IPC: 会话管理 ----

ipcMain.handle('session:list', (): SessionListItem[] => {
  return sessions.list();
});

ipcMain.handle('session:get', (_event, id: string): Session | null => {
  return sessions.get(id);
});

ipcMain.handle('session:create', (): Session => {
  return sessions.create();
});

ipcMain.handle('session:delete', (_event, id: string): void => {
  sessions.delete(id);
});

ipcMain.handle('session:addMessage', (_event, sessionId: string, msg: ChatMessage): void => {
  sessions.addMessage(sessionId, msg);
});

ipcMain.handle('session:update', (_event, sessionId: string, patch: Partial<Pick<Session, 'title' | 'cwd' | 'model'>>): void => {
  sessions.updateMeta(sessionId, patch);
});

ipcMain.handle('session:rollback', (_event, sessionId: string, fromMessageIndex: number) => {
  return sessions.rollback(sessionId, fromMessageIndex);
});

// ---- IPC: 设置管理 ----

ipcMain.handle('settings:get', (): AppSettings => {
  return settings.get();
});

ipcMain.handle('settings:update', (_event, patch: Partial<AppSettings>): AppSettings => {
  return settings.update(patch);
});

// ---- IPC: 文件浏览 ----

ipcMain.handle('fs:readDir', async (_event, dirPath?: string): Promise<DirEntry[]> => {
  const target = dirPath || app.getPath('home');
  try {
    const entries = fs.readdirSync(target, { withFileTypes: true });
    return entries
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => {
        const fullPath = path.join(target, e.name);
        let size = 0;
        if (!e.isDirectory()) {
          try { size = fs.statSync(fullPath).size; } catch { /* ignore */ }
        }
        return { name: e.name, path: fullPath, isDirectory: e.isDirectory(), size };
      })
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } catch {
    return [];
  }
});

ipcMain.handle('fs:selectDirectory', async (): Promise<string | null> => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择工作目录',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.on('preload:error', (_event, message: string) => {
  console.error('[koder main] preload FATAL:', message);
});

// ---- IPC: Skills ----

ipcMain.handle('skills:list', () => globalSkillsManager.list());

ipcMain.handle('skills:get', (_event, id: string) => globalSkillsManager.get(id));

ipcMain.handle('skills:reload', () => {
  globalSkillsManager.reload();
  return globalSkillsManager.list();
});

// ---- App lifecycle ----

app.whenReady().then(async () => {
  resolvePaths();
  sessions.init();
  settings.init();
  globalSkillsManager.init();
  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  agentEngine.cancelAll();
});
