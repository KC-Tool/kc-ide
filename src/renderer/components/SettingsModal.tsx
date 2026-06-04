import { useCallback, useState } from 'react';
import type { AppSettings } from '../../shared/ipc';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  onClose: () => void;
}

const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function SettingsModal({ onClose }: Props) {
  const { settings, updateSettings } = useTheme();
  const [draft, setDraft] = useState<AppSettings | null>(settings ? { ...settings } : null);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    await updateSettings(draft);
    setSaving(false);
    onClose();
  }, [draft, updateSettings, onClose]);

  if (!draft) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <h2>设置</h2>
          <button className="icon-btn" onClick={onClose}><IconX /></button>
        </div>

        <div className="modal-body">
          <div className="settings-section">
            <div className="settings-section-title">外观</div>
            <div className="settings-row">
              <div>
                <div className="settings-label">主题</div>
                <div className="settings-label-desc">选择界面配色方案</div>
              </div>
              <div className="theme-toggle">
                <span className="theme-toggle-label">亮</span>
                <button
                  className={`theme-toggle-switch ${draft.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setDraft({ ...draft, theme: draft.theme === 'light' ? 'dark' : 'light' })}
                />
                <span className="theme-toggle-label">暗</span>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-label">字体大小</div>
                <div className="settings-label-desc">聊天消息的字体大小（像素）</div>
              </div>
              <input
                className="settings-input"
                type="number"
                min={11}
                max={20}
                value={draft.fontSize}
                onChange={(e) => setDraft({ ...draft, fontSize: Number(e.target.value) || 13 })}
                style={{ width: 80, textAlign: 'center' }}
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
