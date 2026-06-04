import { useCallback, useEffect, useState } from 'react';
import type { AppInfo, Session, ChatMessage } from '../shared/ipc';
import { ThemeProvider } from './contexts/ThemeContext';
import Chat from './components/Chat';
import Sidebar from './components/Sidebar';
import SettingsHub, { type SettingsTab } from './components/SettingsHub';
import SkillsStore from './components/SkillsStore';
import TemporalNoticeModal from './components/TemporalNoticeModal';
import { I18nProvider } from './contexts/I18nContext';
import { useI18n } from './contexts/I18nContext';
import FileBrowser from './components/FileBrowser';

function AppInner() {
  const { settings, refreshSettings } = useI18n();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [sessionRefreshKey, setSessionRefreshKey] = useState(0);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [settingsHub, setSettingsHub] = useState<{ open: boolean; tab: SettingsTab }>({
    open: false,
    tab: 'general',
  });
  const [showSkillsStore, setShowSkillsStore] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [cwdForBrowser, setCwdForBrowser] = useState('');
  const [showTemporalNotice, setShowTemporalNotice] = useState(false);

  const refreshAppInfo = useCallback(() => {
    void window.koder.getAppInfo().then(setInfo);
  }, []);

  const bumpSessions = useCallback(() => {
    setSessionRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    refreshAppInfo();
  }, [refreshAppInfo]);

  useEffect(() => {
    if (settings && !settings.dismissedTemporalNotice) {
      setShowTemporalNotice(true);
    }
  }, [settings?.dismissedTemporalNotice]);

  useEffect(() => {
    const unsub = window.koder.onMessageSaved(async () => {
      bumpSessions();
      if (currentSession) {
        const updated = await window.koder.getSession(currentSession.id);
        if (updated) setCurrentSession(updated);
      }
    });
    return unsub;
  }, [bumpSessions, currentSession]);

  useEffect(() => {
    (async () => {
      const list = await window.koder.getSessions();
      if (list.length > 0) {
        const latest = await window.koder.getSession(list[0].id);
        if (latest) setCurrentSession(latest);
      } else {
        const session = await window.koder.createSession();
        setCurrentSession(session);
      }
      bumpSessions();
    })();
  }, [bumpSessions]);

  const handleNewSession = useCallback(async (cwd?: string) => {
    const session = await window.koder.createSession(cwd);
    setCurrentSession(session);
    bumpSessions();
  }, [bumpSessions]);

  const handleSelectSession = useCallback(async (id: string) => {
    const session = await window.koder.getSession(id);
    if (session) setCurrentSession(session);
  }, []);

  const handleDeleteSession = useCallback(async (id: string) => {
    await window.koder.deleteSession(id);
    if (currentSession?.id === id) {
      const list = await window.koder.getSessions();
      if (list.length > 0) {
        const session = await window.koder.getSession(list[0].id);
        setCurrentSession(session);
      } else {
        const session = await window.koder.createSession();
        setCurrentSession(session);
      }
    }
    bumpSessions();
  }, [currentSession?.id, bumpSessions]);

  const handlePickWorkspaceFolder = useCallback(async () => {
    const dir = await window.koder.selectDirectory();
    if (!dir) return;
    const session = await window.koder.createSession(dir);
    setCurrentSession(session);
    bumpSessions();
  }, [bumpSessions]);

  const handleAddMessage = useCallback(async (msg: ChatMessage) => {
    if (!currentSession) return;
    await window.koder.addMessage(currentSession.id, msg);
    bumpSessions();
    const updated = await window.koder.getSession(currentSession.id);
    if (updated) setCurrentSession(updated);
  }, [currentSession, bumpSessions]);

  const handleOpenFileBrowser = useCallback((cwd: string) => {
    setCwdForBrowser(cwd);
    setShowFileBrowser(true);
  }, []);

  const handleWorkspaceChange = useCallback(async () => {
    if (currentSession) {
      const updated = await window.koder.getSession(currentSession.id);
      if (updated) {
        setCurrentSession(updated);
        bumpSessions();
      }
    }
  }, [currentSession, bumpSessions]);

  const handleRollback = useCallback(async () => {
    if (currentSession) {
      const updated = await window.koder.getSession(currentSession.id);
      if (updated) setCurrentSession(updated);
      bumpSessions();
    }
  }, [currentSession, bumpSessions]);

  const openSettings = useCallback((tab: SettingsTab = 'general') => {
    setSettingsHub({ open: true, tab });
  }, []);

  const handleDismissTemporalNotice = useCallback(async (dontShowAgain: boolean) => {
    setShowTemporalNotice(false);
    if (dontShowAgain) {
      await window.koder.updateSettings({ dismissedTemporalNotice: true });
      await refreshSettings();
    }
  }, [refreshSettings]);

  return (
    <ThemeProvider>
      <div className="app-shell">
        <Sidebar
          info={info}
          currentSessionId={currentSession?.id ?? null}
          refreshKey={sessionRefreshKey}
          onNewSession={(cwd) => void handleNewSession(cwd)}
          onSelectSession={(id) => void handleSelectSession(id)}
          onDeleteSession={(id) => void handleDeleteSession(id)}
          onPickWorkspaceFolder={() => void handlePickWorkspaceFolder()}
          onOpenSettings={openSettings}
          onOpenSkillsStore={() => setShowSkillsStore(true)}
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

      {showTemporalNotice && (
        <TemporalNoticeModal onDismiss={(d) => void handleDismissTemporalNotice(d)} />
      )}

      {settingsHub.open && (
        <SettingsHub
          initialTab={settingsHub.tab}
          onClose={() => setSettingsHub((s) => ({ ...s, open: false }))}
          onModelSaved={refreshAppInfo}
        />
      )}

      {showSkillsStore && (
        <SkillsStore onClose={() => setShowSkillsStore(false)} />
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
                bumpSessions();
              });
            }
            setShowFileBrowser(false);
          }}
        />
      )}
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}
