// Koder 预加载脚本
// 在 contextIsolation 沙箱中向 window 暴露受控的 koder API
// 此文件是 CJS（Electron 预加载要求 .cjs 扩展名）

try {
  const { contextBridge, ipcRenderer } = require('electron');

  // agent:event 监听器管理 —— 支持取消订阅
  const agentListeners = new Set();

  // agent:message_saved 监听器管理
  const messageSavedListeners = new Set();
  const skillsChangedListeners = new Set();

  ipcRenderer.on('agent:event', (_event, payload) => {
    for (const cb of agentListeners) {
      try {
        cb(payload);
      } catch (err) {
        console.error('[koder preload] listener error', err);
      }
    }
  });

  ipcRenderer.on('agent:message_saved', (_event, payload) => {
    for (const cb of messageSavedListeners) {
      try {
        cb(payload);
      } catch (err) {
        console.error('[koder preload] messageSaved listener error', err);
      }
    }
  });

  ipcRenderer.on('skills:changed', () => {
    for (const cb of skillsChangedListeners) {
      try {
        cb();
      } catch (err) {
        console.error('[koder preload] skillsChanged listener error', err);
      }
    }
  });

  contextBridge.exposeInMainWorld('koder', {
    // ---- 应用信息 ----
    getAppInfo: () => ipcRenderer.invoke('app:info'),

    // ---- Agent 配置 ----
    getAgentConfig: () => ipcRenderer.invoke('config:get'),
    updateAgentConfig: (patch) => ipcRenderer.invoke('config:update', patch),

    // ---- Agent 运行 ----
    runAgent: async (req, onEvent) => {
      const { sessionId } = await ipcRenderer.invoke('agent:run', req);
      if (typeof onEvent === 'function') {
        agentListeners.add(onEvent);
        const unsubscribe = () => agentListeners.delete(onEvent);
        return { sessionId, unsubscribe };
      }
      return { sessionId, unsubscribe: () => {} };
    },
    cancelAgent: (sessionId) => ipcRenderer.invoke('agent:cancel', sessionId),

    // ---- 会话管理 ----
    getSessions: () => ipcRenderer.invoke('session:list'),
    getSession: (id) => ipcRenderer.invoke('session:get', id),
    createSession: () => ipcRenderer.invoke('session:create'),
    deleteSession: (id) => ipcRenderer.invoke('session:delete', id),
    addMessage: (sessionId, msg) => ipcRenderer.invoke('session:addMessage', sessionId, msg),
    updateSession: (sessionId, patch) => ipcRenderer.invoke('session:update', sessionId, patch),

    // ---- 设置管理 ----
    getSettings: () => ipcRenderer.invoke('settings:get'),
    updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),

    // ---- 文件浏览 ----
    readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
    selectDirectory: () => ipcRenderer.invoke('fs:selectDirectory'),

    // ---- 回退 ----
    rollback: (sessionId, fromMessageIndex) => ipcRenderer.invoke('session:rollback', sessionId, fromMessageIndex),

    // ---- Skills ----
    getSkills: () => ipcRenderer.invoke('skills:list'),
    getSkill: (id) => ipcRenderer.invoke('skills:get', id),
    reloadSkills: () => ipcRenderer.invoke('skills:reload'),
    searchSkillHub: (params) => ipcRenderer.invoke('skillhub:search', params),
    installSkillFromSkillHub: (slug) => ipcRenderer.invoke('skillhub:install', slug),
    onSkillsChanged: (cb) => {
      skillsChangedListeners.add(cb);
      return () => skillsChangedListeners.delete(cb);
    },

    // ---- 消息保存通知 ----
    onMessageSaved: (cb) => {
      messageSavedListeners.add(cb);
      return () => messageSavedListeners.delete(cb);
    },
  });

  process.stdout.write('[koder preload] loaded, window.koder exposed\n');
} catch (err) {
  const message = (err && err.stack) || String(err);
  console.error('[koder preload] FATAL:', message);
  try {
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('preload:error', message);
  } catch {
    // 忽略
  }
  try {
    const { contextBridge } = require('electron');
    const reject = (msg) => () => Promise.reject(new Error(msg));
    contextBridge.exposeInMainWorld('koder', {
      __error: message,
      getAppInfo: reject('preload 初始化失败'),
      getAgentConfig: reject('preload 初始化失败'),
      updateAgentConfig: reject('preload 初始化失败'),
      runAgent: reject('preload 初始化失败'),
      cancelAgent: reject('preload 初始化失败'),
      getSessions: reject('preload 初始化失败'),
      getSession: reject('preload 初始化失败'),
      createSession: reject('preload 初始化失败'),
      deleteSession: reject('preload 初始化失败'),
      addMessage: reject('preload 初始化失败'),
      updateSession: reject('preload 初始化失败'),
      getSettings: reject('preload 初始化失败'),
      updateSettings: reject('preload 初始化失败'),
      readDir: reject('preload 初始化失败'),
      selectDirectory: reject('preload 初始化失败'),
      rollback: reject('preload 初始化失败'),
      getSkills: reject('preload 初始化失败'),
      getSkill: reject('preload 初始化失败'),
      reloadSkills: reject('preload 初始化失败'),
      searchSkillHub: reject('preload 初始化失败'),
      installSkillFromSkillHub: reject('preload 初始化失败'),
      onSkillsChanged: reject('preload 初始化失败'),
      onMessageSaved: reject('preload 初始化失败'),
    });
  } catch {
    // 真的什么都做不了
  }
}
