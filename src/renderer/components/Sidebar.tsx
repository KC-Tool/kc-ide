import { useMemo } from 'react';
import type { AppInfo, SessionListItem } from '../../shared/ipc';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  info: AppInfo | null;
  sessionList: SessionListItem[];
  currentSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onOpenSettings: () => void;
  onOpenModelSettings: () => void;
  onOpenFileBrowser: () => void;
}

// 按时间分组：今天、昨天、更早
function groupSessions(list: SessionListItem[]) {
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
  if (today.length > 0) groups.push({ label: '今天', items: today });
  if (yesterday.length > 0) groups.push({ label: '昨天', items: yesterday });
  if (older.length > 0) groups.push({ label: '更早', items: older });
  return groups;
}

// SVG icons (inline, no dependency)
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

const IconCpu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
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
  onOpenModelSettings,
  onOpenFileBrowser,
}: Props) {
  const { theme, toggle } = useTheme();
  const groups = useMemo(() => groupSessions(sessionList), [sessionList]);

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="brand">
          <div className="logo">K</div>
          <div className="brand-text">
            <div className="brand-name">Koder</div>
            <div className="brand-sub">v{info?.version ?? '…'} · Codex Desktop</div>
          </div>
        </div>
        <button className="btn-new-chat" onClick={onNewSession}>
          <IconPlus />
          新会话
        </button>
      </div>

      {/* Session List */}
      <div className="session-list">
        {groups.length === 0 && (
          <div className="session-list-empty">还没有会话</div>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <div className="session-group-label">{group.label}</div>
            {group.items.map((s) => (
              <button
                key={s.id}
                className={`session-item ${s.id === currentSessionId ? 'active' : ''}`}
                onClick={() => onSelectSession(s.id)}
              >
                <span className="session-item-title">{s.title}</span>
                <button
                  className="session-item-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(s.id);
                  }}
                  title="删除会话"
                >
                  <IconX />
                </button>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="sidebar-footer-item" onClick={onOpenFileBrowser}>
          <IconFolder />
          文件浏览
        </button>
        <button className="sidebar-footer-item" onClick={onOpenModelSettings}>
          <IconCpu />
          模型配置
        </button>
        <button className="sidebar-footer-item" onClick={onOpenSettings}>
          <IconSettings />
          设置
        </button>
        <div className="sidebar-footer-item" style={{ cursor: 'default' }}>
          <div className="theme-toggle">
            <span className="theme-toggle-label">亮</span>
            <button
              className={`theme-toggle-switch ${theme === 'dark' ? 'active' : ''}`}
              onClick={toggle}
              aria-label="切换主题"
            />
            <span className="theme-toggle-label">暗</span>
          </div>
        </div>

        <div className="env-status">
          <div className="env-row">
            <span>Agent</span>
            <span className={info?.agentConfigured ? 'status-ok' : 'status-warn'}>
              {info?.agentConfigured ? info.agentModel : '未配置'}
            </span>
          </div>
          <div className="env-row">
            <span>Electron</span>
            <span>{info?.electron ?? '—'}</span>
          </div>
          <div className="env-row">
            <span>Node</span>
            <span>{info?.node ?? '—'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
