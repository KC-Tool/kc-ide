import { useMemo } from 'react';
import type { AppInfo, SessionListItem } from '../../shared/ipc';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import type { SettingsTab } from './SettingsHub';

interface Props {
  info: AppInfo | null;
  sessionList: SessionListItem[];
  currentSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  onOpenSkillsStore: () => void;
  onOpenFileBrowser: () => void;
}

function groupSessions(list: SessionListItem[], labels: { today: string; yesterday: string; older: string }) {
  const now = Date.now();
  const dayMs = 86400000;
  const today: SessionListItem[] = [];
  const yesterday: SessionListItem[] = [];
  const older: SessionListItem[] = [];

  for (const s of list) {
    const diff = now - s.updatedAt;
    if (diff < dayMs) {
      today.push(s);
    } else if (diff < dayMs * 2) {
      yesterday.push(s);
    } else {
      older.push(s);
    }
  }

  const groups: { label: string; items: SessionListItem[] }[] = [];
  if (today.length > 0) groups.push({ label: labels.today, items: today });
  if (yesterday.length > 0) groups.push({ label: labels.yesterday, items: yesterday });
  if (older.length > 0) groups.push({ label: labels.older, items: older });
  return groups;
}

const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconFolder = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
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
    <path d="M5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75L5 17z" />
    <path d="M19 13l.5 1.5L21 15l-1.5.5L19 17l-.5-1.5L17 15l1.5-.5L19 13z" />
  </svg>
);

const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function Sidebar({
  info,
  sessionList,
  currentSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onOpenSettings,
  onOpenSkillsStore,
  onOpenFileBrowser,
}: Props) {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();

  const groupLabels = useMemo(
    () => ({
      today: t('sidebar.group.today'),
      yesterday: t('sidebar.group.yesterday'),
      older: t('sidebar.group.older'),
    }),
    [t],
  );

  const groups = useMemo(
    () => groupSessions(sessionList, groupLabels),
    [sessionList, groupLabels],
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <div className="logo">K</div>
          <div className="brand-text">
            <div className="brand-name">{t('app.name')}</div>
            <div className="brand-sub">v{info?.version ?? '…'} · {t('app.subtitle')}</div>
          </div>
        </div>
        <button type="button" className="btn-new-chat" onClick={onNewSession}>
          <IconPlus />
          {t('sidebar.newChat')}
        </button>
      </div>

      <div className="session-list">
        {groups.length === 0 && (
          <div className="session-list-empty">{t('sidebar.noSessions')}</div>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <div className="session-group-label">{group.label}</div>
            {group.items.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`session-item ${s.id === currentSessionId ? 'active' : ''}`}
                onClick={() => onSelectSession(s.id)}
              >
                <span className="session-item-title">{s.title}</span>
                <button
                  type="button"
                  className="session-item-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(s.id);
                  }}
                  title={t('sidebar.deleteSession')}
                >
                  <IconX />
                </button>
              </button>
            ))}
          </div>
        ))}
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
        <div className="sidebar-footer-item" style={{ cursor: 'default' }}>
          <div className="theme-toggle">
            <span className="theme-toggle-label">{t('sidebar.theme.light')}</span>
            <button
              type="button"
              className={`theme-toggle-switch ${theme === 'dark' ? 'active' : ''}`}
              onClick={toggle}
              aria-label={t('settings.general.theme')}
            />
            <span className="theme-toggle-label">{t('sidebar.theme.dark')}</span>
          </div>
        </div>

        <div className="env-status">
          <div className="env-row">
            <span>{t('sidebar.env.agent')}</span>
            <span className={info?.agentConfigured ? 'status-ok' : 'status-warn'}>
              {info?.agentConfigured ? info.agentModel : t('sidebar.env.notConfigured')}
            </span>
          </div>
          <div className="env-row">
            <span>{t('sidebar.env.electron')}</span>
            <span>{info?.electron ?? '—'}</span>
          </div>
          <div className="env-row">
            <span>{t('sidebar.env.node')}</span>
            <span>{info?.node ?? '—'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
