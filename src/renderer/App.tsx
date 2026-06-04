import { useCallback, useEffect, useState } from 'react';
import type { AppInfo, Session, SessionListItem, ChatMessage } from '../shared/ipc';
import { ThemeProvider } from './contexts/ThemeContext';
import Chat from './components/Chat';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import ModelSettings from './components/ModelSettings';
import FileBrowser from './components/FileBrowser';

export default function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [sessionList, setSessionList] = useState<SessionListItem[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [cwdForBrowser, setCwdForBrowser] = useState('');

  const refreshAppInfo = useCallback(() => {
    void window.koder.getAppInfo().then(setInfo);
  }, []);

  useEffect(() => {
    refreshAppInfo();
  }, [refreshAppInfo]);

  const refreshSessionList = useCallback(async () => {
    const list = await window.koder.getSessions();
    setSessionList(list);
  }, []);

  // 监听主进程消息保存完成事件，自动刷新会话列表
  useEffect(() => {
    const unsub = window.koder.onMessageSaved(async () => {
      await refreshSessionList();
      if (currentSession) {
        const updated = await window.koder.getSession(currentSession.id);
        if (updated) setCurrentSession(updated);
      }
    });
    return unsub;
  }, [refreshSessionList, currentSession]);

  useEffect(() => {
    (async () => {
      await refreshSessionList();
      const list = await window.koder.getSessions();
      if (list.length > 0) {
        const latest = await window.koder.getSession(list[0].id);
        if (latest) setCurrentSession(latest);
      } else {
        const session = await window.koder.createSession();
        setCurrentSession(session);
        await refreshSessionList();
      }
    })();
  }, [refreshSessionList]);

  const handleNewSession = useCallback(async () => {
    const session = await window.koder.createSession();
    setCurrentSession(session);
    await refreshSessionList();
  }, [refreshSessionList]);

  const handleSelectSession = useCallback(async (id: string) => {
    const session = await window.koder.getSession(id);
    if (session) setCurrentSession(session);
  }, []);

  const handleDeleteSession = useCallback(async (id: string) => {
    await window.koder.deleteSession(id);
    if (currentSession?.id === id) {
      const list = await window.koder.getSessions();
      const remaining = list.find((s) => s.id !== id);
      if (remaining) {
        const session = await window.koder.getSession(remaining.id);
        setCurrentSession(session);
      } else {
        await handleNewSession();
      }
    }
    await refreshSessionList();
  }, [currentSession?.id, handleNewSession, refreshSessionList]);

  const handleAddMessage = useCallback(async (msg: ChatMessage) => {
    if (!currentSession) return;
    await window.koder.addMessage(currentSession.id, msg);
    await refreshSessionList();
    const updated = await window.koder.getSession(currentSession.id);
    if (updated) setCurrentSession(updated);
  }, [currentSession, refreshSessionList]);

  const handleOpenFileBrowser = useCallback((cwd: string) => {
    setCwdForBrowser(cwd);
    setShowFileBrowser(true);
  }, []);

  const handleWorkspaceChange = useCallback(async () => {
    if (currentSession) {
      const updated = await window.koder.getSession(currentSession.id);
      if (updated) setCurrentSession(updated);
    }
  }, [currentSession]);

  const handleRollback = useCallback(async () => {
    if (currentSession) {
      const updated = await window.koder.getSession(currentSession.id);
      if (updated) setCurrentSession(updated);
      await refreshSessionList();
    }
  }, [currentSession, refreshSessionList]);

  return (
    <ThemeProvider>
      <div className="app-shell">
        <Sidebar
          info={info}
          sessionList={sessionList}
          currentSessionId={currentSession?.id ?? null}
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onOpenSettings={() => setShowSettings(true)}
          onOpenModelSettings={() => setShowModelSettings(true)}
          onOpenFileBrowser={() => handleOpenFileBrowser(currentSession?.cwd ?? '')}
        />
        <main className="app-main">
          <Chat
            session={currentSession}
            onAddMessage={handleAddMessage}
            onOpenFileBrowser={handleOpenFileBrowser}
            onWorkspaceChange={handleWorkspaceChange}
            onRollback={handleRollback}
          />
        </main>
      </div>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {showModelSettings && (
        <ModelSettings
          onClose={() => {
            setShowModelSettings(false);
            refreshAppInfo();
          }}
        />
      )}

      {showFileBrowser && (
        <FileBrowser
          initialPath={cwdForBrowser}
          onClose={() => setShowFileBrowser(false)}
          onSelectDir={(dir) => {
            if (currentSession) {
              window.koder.updateSession(currentSession.id, { cwd: dir }).then(() => {
                window.koder.getSession(currentSession.id).then((s) => {
                  if (s) setCurrentSession(s);
                });
              });
            }
            setShowFileBrowser(false);
          }}
        />
      )}
    </ThemeProvider>
  );
}
