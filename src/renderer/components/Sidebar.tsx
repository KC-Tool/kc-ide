import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppInfo, SessionRepoGroup } from '../../shared/ipc';
import { useI18n } from '../contexts/I18nContext';
import type { SettingsTab } from './SettingsHub';

interface Props {
  info: AppInfo | null;
  currentSessionId: string | null;
  onNewSession: (cwd?: string) => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onPickWorkspaceFolder: () => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  onOpenSkillsStore: () => void;
  onOpenFileBrowser: () => void;
  refreshKey?: number;
}

const IconFolder = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconFolderPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={open ? 'repo-chevron open' : 'repo-chevron'}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconSparkles = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
  </svg>
);

function repoKey(group: SessionRepoGroup): string {
  return group.cwd ?? `__${group.storageFolder}`;
}

export default function Sidebar({
  info,
  currentSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onPickWorkspaceFolder,
  onOpenSettings,
  onOpenSkillsStore,
  onOpenFileBrowser,
  refreshKey = 0,
}: Props) {
  const { t } = useI18n();
  const [repoTree, setRepoTree] = useState<SessionRepoGroup[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadTree = useCallback(async () => {
    const tree = await window.koder.getSessionRepoTree();
    setRepoTree(tree);
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const g of tree) {
        next.add(repoKey(g));
      }
      if (currentSessionId) {
        for (const g of tree) {
          if (g.sessions.some(s => s.id === currentSessionId)) {
            next.add(repoKey(g));
          }
        }
      }
      return next;
    });
  }, [currentSessionId]);

  useEffect(() => {
    void loadTree();
  }, [loadTree, refreshKey]);

  const toggleRepo = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const currentRepoKey = useMemo(() => {
    if (!currentSessionId) return null;
    for (const g of repoTree) {
      if (g.sessions.some(s => s.id === currentSessionId)) {
        return repoKey(g);
      }
    }
    return null;
  }, [repoTree, currentSessionId]);

  return (
    <aside className="sidebar">
      <div className="sidebar-header sidebar-header-compact">
        <div className="brand">
          <div className="logo">K</div>
          <div className="brand-text">
            <div className="brand-name">{t('app.name')}</div>
            <div className="brand-sub">v{info?.version ?? '…'}</div>
          </div>
        </div>
      </div>

      <div className="repo-list-header">
        <span className="repo-list-title">{t('sidebar.repositories')}</span>
        <div className="repo-list-actions">
          <button
            type="button"
            className="repo-icon-btn"
            onClick={onPickWorkspaceFolder}
            title={t('sidebar.addWorkspace')}
          >
            <IconFolderPlus />
          </button>
        </div>
      </div>

      <div className="repo-list">
        {repoTree.length === 0 && (
          <div className="session-list-empty">{t('sidebar.noSessions')}</div>
        )}
        {repoTree.map((group) => {
          const key = repoKey(group);
          const isOpen = expanded.has(key);
          const isActiveRepo = currentRepoKey === key;

          return (
            <div key={key} className={`repo-group ${isActiveRepo ? 'repo-group-active' : ''}`}>
              <div className="repo-folder-row">
                <button
                  type="button"
                  className="repo-folder-toggle"
                  onClick={() => toggleRepo(key)}
                  title={isOpen ? t('sidebar.collapseRepo') : t('sidebar.expandRepo')}
                >
                  <IconChevron open={isOpen} />
                </button>
                <button
                  type="button"
                  className="repo-folder-main"
                  onClick={() => toggleRepo(key)}
                  title={group.cwd ?? t('sidebar.workspaceNone')}
                >
                  <span className="repo-folder-icon"><IconFolder /></span>
                  <span className="repo-folder-name">
                    {group.storageFolder === '_unassigned' ? t('sidebar.workspaceNone') : group.repoLabel}
                  </span>
                </button>
                <button
                  type="button"
                  className="repo-icon-btn repo-new-session"
                  onClick={() => onNewSession(group.cwd)}
                  title={t('sidebar.newSessionInRepo')}
                >
                  +
                </button>
              </div>

              {isOpen && (
                <div className="repo-sessions">
                  {group.sessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`repo-session-item ${s.id === currentSessionId ? 'active' : ''}`}
                      onClick={() => onSelectSession(s.id)}
                      title={s.title}
                    >
                      <span className="repo-session-dot" aria-hidden />
                      <span className="repo-session-title">{s.title}</span>
                      <button
                        type="button"
                        className="repo-session-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(s.id);
                        }}
                        title={t('sidebar.deleteSession')}
                      >
                        ×
                      </button>
                    </button>
                  ))}
                  {group.sessions.length === 0 && (
                    <div className="repo-sessions-empty">{t('sidebar.newSessionInRepo')}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-footer-item" onClick={onOpenFileBrowser}>
          <IconFolder />
          {t('sidebar.fileBrowser')}
        </button>
        <button type="button" className="sidebar-footer-item" onClick={onOpenSkillsStore}>
          <IconSparkles />
          {t('sidebar.skillsStore')}
        </button>
        <button type="button" className="sidebar-footer-item" onClick={() => onOpenSettings('general')}>
          <IconSettings />
          {t('sidebar.settings')}
        </button>

        <div className="env-status">
          <div className="env-row">
            <span>{t('sidebar.env.agent')}</span>
            <span className={info?.agentConfigured ? 'status-ok' : 'status-warn'}>
              {info?.agentConfigured ? info.agentModel : t('sidebar.env.notConfigured')}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
