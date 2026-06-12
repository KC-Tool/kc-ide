import { useCallback, useEffect, useState } from 'react';
import type { AgentTeam, TeamListItem } from '../../shared/ipc';
import { useI18n } from '../contexts/I18nContext';

interface Props {
  defaultTeamId?: string;
  onDefaultTeamChange: (id: string | undefined) => void;
}

export default function TeamsSettingsPanel({ defaultTeamId, onDefaultTeamChange }: Props) {
  const { t } = useI18n();
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [editing, setEditing] = useState<AgentTeam | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await window.koder.getTeams();
    setTeams(list);
  }, []);

  useEffect(() => {
    void load();
    const unsub = window.koder.onTeamsChanged(() => { void load(); });
    return unsub;
  }, [load]);

  const startCreate = () => {
    setEditing({
      id: '',
      name: '',
      description: '',
      orchestration:
        'Lead agent delegates to REAL sub-agents via delegate_agent — never impersonates members.',
      members: [
        { id: 'lead', name: 'Lead', role: '协调', prompt: 'You coordinate and synthesize.' },
      ],
      source: 'user',
    });
  };

  const startEdit = async (id: string) => {
    const team = await window.koder.getTeam(id);
    if (team) setEditing({ ...team, members: team.members.map(m => ({ ...m })) });
  };

  const updateMember = (index: number, patch: Partial<AgentTeam['members'][0]>) => {
    if (!editing) return;
    const members = editing.members.map((m, i) => (i === index ? { ...m, ...patch } : m));
    setEditing({ ...editing, members });
  };

  const addMember = () => {
    if (!editing) return;
    const n = editing.members.length + 1;
    setEditing({
      ...editing,
      members: [
        ...editing.members,
        { id: `member-${n}`, name: `Member ${n}`, role: '', prompt: '' },
      ],
    });
  };

  const removeMember = (index: number) => {
    if (!editing || editing.members.length <= 1) return;
    setEditing({ ...editing, members: editing.members.filter((_, i) => i !== index) });
  };

  const handleSave = async () => {
    if (!editing) return;
    const id = editing.id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!id) {
      setToast(t('teams.invalidId'));
      return;
    }
    setSaving(true);
    const result = await window.koder.saveTeam({ ...editing, id });
    setSaving(false);
    if (result.ok) {
      setToast(t('teams.saved'));
      setEditing(null);
      void load();
    } else {
      setToast(result.error || t('teams.saveFail'));
    }
  };

  const handleDelete = async (id: string) => {
    const result = await window.koder.deleteTeam(id);
    if (result.ok) {
      if (defaultTeamId === id) onDefaultTeamChange(undefined);
      void load();
      setToast(t('teams.deleted'));
    } else {
      setToast(result.error || t('teams.deleteFail'));
    }
  };

  if (editing) {
    return (
      <div className="settings-section teams-editor">
        <div className="settings-section-title">{editing.id ? t('teams.edit') : t('teams.create')}</div>
        <p className="teams-format-hint">{t('teams.formatHint')}</p>

        <div className="settings-row">
          <div className="settings-label">{t('teams.field.id')}</div>
          <input
            className="settings-input"
            value={editing.id}
            disabled={editing.source === 'builtin'}
            onChange={(e) => setEditing({ ...editing, id: e.target.value })}
            placeholder="my-team"
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">{t('teams.field.name')}</div>
          <input
            className="settings-input"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">{t('teams.field.description')}</div>
          <input
            className="settings-input"
            value={editing.description}
            onChange={(e) => setEditing({ ...editing, description: e.target.value })}
          />
        </div>
        <div className="settings-row settings-row-col">
          <div className="settings-label">{t('teams.field.orchestration')}</div>
          <textarea
            className="settings-input teams-textarea"
            rows={4}
            value={editing.orchestration}
            onChange={(e) => setEditing({ ...editing, orchestration: e.target.value })}
          />
        </div>

        <div className="settings-section-title">{t('teams.members')}</div>
        {editing.members.map((m, i) => (
          <div key={i} className="teams-member-card">
            <div className="teams-member-header">
              <span>{t('teams.member')} {i + 1}</span>
              {editing.members.length > 1 && (
                <button type="button" className="btn-text danger" onClick={() => removeMember(i)}>
                  {t('teams.removeMember')}
                </button>
              )}
            </div>
            <input
              className="settings-input"
              placeholder="id"
              value={m.id}
              onChange={(e) => updateMember(i, { id: e.target.value })}
            />
            <input
              className="settings-input"
              placeholder={t('teams.field.name')}
              value={m.name}
              onChange={(e) => updateMember(i, { name: e.target.value })}
            />
            <input
              className="settings-input"
              placeholder={t('teams.field.role')}
              value={m.role}
              onChange={(e) => updateMember(i, { role: e.target.value })}
            />
            <textarea
              className="settings-input teams-textarea"
              rows={3}
              placeholder={t('teams.field.prompt')}
              value={m.prompt}
              onChange={(e) => updateMember(i, { prompt: e.target.value })}
            />
          </div>
        ))}
        <button type="button" className="btn-secondary teams-add-member" onClick={addMember}>
          {t('teams.addMember')}
        </button>

        <div className="teams-editor-actions">
          <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
            {t('settings.cancel')}
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void handleSave()}>
            {saving ? t('settings.saving') : t('teams.saveTeam')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title">{t('teams.title')}</div>
      <p className="teams-intro">{t('teams.intro')}</p>
      <p className="teams-path">{t('teams.storagePath')}</p>

      {toast && <div className="teams-toast">{toast}</div>}

      <div className="settings-row">
        <div>
          <div className="settings-label">{t('teams.defaultTeam')}</div>
          <div className="settings-label-desc">{t('teams.defaultTeamDesc')}</div>
        </div>
        <select
          className="settings-input"
          value={defaultTeamId || ''}
          onChange={(e) => onDefaultTeamChange(e.target.value || undefined)}
          style={{ width: 200 }}
        >
          <option value="">{t('teams.none')}</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
      </div>

      <div className="teams-toolbar">
        <button type="button" className="btn-primary" onClick={startCreate}>
          {t('teams.create')}
        </button>
        <button type="button" className="btn-secondary" onClick={() => void window.koder.reloadTeams().then(load)}>
          {t('teams.reload')}
        </button>
      </div>

      <ul className="teams-list">
        {teams.map((team) => (
          <li key={team.id} className="teams-list-item">
            <div className="teams-list-main">
              <strong>{team.name}</strong>
              <span className="teams-list-id">{team.id}</span>
              <span className={`teams-badge teams-badge-${team.source}`}>{team.source}</span>
              <span className="teams-list-meta">{team.memberCount} {t('teams.membersCount')}</span>
              {team.description && <p className="teams-list-desc">{team.description}</p>}
            </div>
            <div className="teams-list-actions">
              <button type="button" className="btn-text" onClick={() => void startEdit(team.id)}>
                {t('teams.edit')}
              </button>
              {team.source !== 'builtin' && (
                <button type="button" className="btn-text danger" onClick={() => void handleDelete(team.id)}>
                  {t('teams.delete')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {teams.length === 0 && <p className="teams-empty">{t('teams.empty')}</p>}
    </div>
  );
}
