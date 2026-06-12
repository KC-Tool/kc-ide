import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '../../shared/ipc';
import type { SkillListItem } from '../../shared/skills-types';
import type { TeamListItem } from '../../shared/ipc';
import type { InteractionMode } from '../../shared/agent-modes';
import { useI18n } from '../contexts/I18nContext';
import { deferNonCritical } from '../lib/scheduling';
import { buildAtMenuItems } from '../../shared/team-types';
import SlashCommandMenu, { buildSlashMenuItems, type SlashMenuItem } from './SlashCommandMenu';

const IconFolder = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconSend = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconStop = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

interface Props {
  session: Session | null;
  running: boolean;
  agentMode: InteractionMode;
  effectiveTeamId?: string;
  onSubmit: (text: string) => void;
  onStop: () => void;
  onSelectWorkspace: () => void;
  onSlashSelect?: (item: SlashMenuItem) => void;
}

function ChatComposer({
  session,
  running,
  agentMode,
  effectiveTeamId,
  onSubmit,
  onStop,
  onSelectWorkspace,
  onSlashSelect,
}: Props) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [atMenuOpen, setAtMenuOpen] = useState(false);
  const [slashSelected, setSlashSelected] = useState(0);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const ensureCatalog = useCallback(() => {
    if (catalogLoaded) return;
    setCatalogLoaded(true);
    deferNonCritical(() => {
      void window.koder.getSkills().then(setSkills);
      void window.koder.getTeams().then(setTeams);
    });
  }, [catalogLoaded]);

  useEffect(() => {
    deferNonCritical(() => ensureCatalog(), 1200);
    return window.koder.onSkillsChanged(() => {
      void window.koder.getSkills().then(setSkills);
    });
  }, [ensureCatalog]);

  useEffect(() => {
    return window.koder.onTeamsChanged(() => {
      void window.koder.getTeams().then(setTeams);
    });
  }, []);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, []);

  const slashFilter = input.startsWith('/') && !input.startsWith('//') ? input : '';
  const atFilter = input.startsWith('@') ? input : '';

  const slashMenuItems = useMemo(
    () => buildSlashMenuItems(skills, slashFilter, {
      skillsDesc: t('slash.skills.desc'),
      helpDesc: t('slash.help.desc'),
      skillUsePrefix: t('slash.skill'),
    }),
    [skills, slashFilter, t],
  );

  const atMenuItems = useMemo(
    () => buildAtMenuItems(teams, atFilter, {
      teamsDesc: t('at.teams.desc'),
      helpDesc: t('at.help.desc'),
      createTeamDesc: t('at.createTeam.desc'),
      teamUsePrefix: t('at.team'),
    }),
    [teams, atFilter, t],
  );

  const handleSlashSelect = useCallback((item: SlashMenuItem) => {
    setInput(item.insertText);
    setSlashMenuOpen(false);
    setAtMenuOpen(false);
    textareaRef.current?.focus();
    autoResize();
    onSlashSelect?.(item);
  }, [autoResize, onSlashSelect]);

  const commandMenuOpen = slashMenuOpen || atMenuOpen;
  const commandMenuItems = atMenuOpen ? atMenuItems : slashMenuItems;

  useEffect(() => {
    setSlashSelected(0);
  }, [slashFilter, atFilter]);

  useEffect(() => {
    if (input.startsWith('@')) {
      ensureCatalog();
      setSlashMenuOpen(false);
      setAtMenuOpen(atMenuItems.length > 0);
    } else if (input.startsWith('/')) {
      ensureCatalog();
      setAtMenuOpen(false);
      setSlashMenuOpen(slashMenuItems.length > 0);
    } else {
      setSlashMenuOpen(false);
      setAtMenuOpen(false);
    }
  }, [input, atMenuItems.length, slashMenuItems.length, ensureCatalog]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (commandMenuOpen && commandMenuItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelected((i) => (i + 1) % commandMenuItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelected((i) => (i - 1 + commandMenuItems.length) % commandMenuItems.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSlashSelect(commandMenuItems[slashSelected]);
        return;
      }
      if (e.key === 'Escape') {
        setSlashMenuOpen(false);
        setAtMenuOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const text = input.trim();
      if (text && !running) {
        onSubmit(text);
        setInput('');
        autoResize();
      }
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || running) return;
    onSubmit(text);
    setInput('');
    autoResize();
  };

  return (
    <div className="agent-input-shell">
      <SlashCommandMenu
        items={commandMenuItems}
        selectedIndex={slashSelected}
        onSelect={handleSlashSelect}
        visible={commandMenuOpen}
        kindLabels={{ cmd: t('slash.cmd'), skill: t('slash.skill'), team: t('at.team') }}
      />
      <div className="agent-input-box">
        <div className="agent-input-meta">
          <button
            type="button"
            className="agent-chip"
            onClick={onSelectWorkspace}
            disabled={running || !session}
            title={t('chat.workspace.select')}
          >
            <IconFolder />
            <span>{session?.cwd ? session.cwd.split(/[\\/]/).pop() : t('agent.workspace')}</span>
          </button>
          {agentMode === 'agent' && effectiveTeamId && (
            <span className="agent-chip agent-chip-team">@{effectiveTeamId}</span>
          )}
          {agentMode === 'plan' && (
            <span className="agent-chip agent-chip-plan">{t('agent.planHint')}</span>
          )}
        </div>

        <div className="agent-input-wrap">
          <textarea
            ref={textareaRef}
            className="agent-textarea"
            rows={1}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder={agentMode === 'plan' ? t('agent.placeholderPlan') : t('agent.placeholder')}
          />
        </div>

        <div className="agent-input-footer">
          <div className="agent-input-actions">
            <button
              type="button"
              className="agent-icon-btn"
              onClick={() => {
                ensureCatalog();
                setAtMenuOpen(true);
                setSlashMenuOpen(false);
                setInput((prev) => (prev.startsWith('@') ? prev : `@${prev}`));
                textareaRef.current?.focus();
              }}
              title="@"
            >
              @
            </button>
            <button
              type="button"
              className="agent-icon-btn"
              onClick={() => {
                ensureCatalog();
                setSlashMenuOpen(true);
                setAtMenuOpen(false);
                setInput((prev) => (prev.startsWith('/') ? prev : `/${prev}`));
                textareaRef.current?.focus();
              }}
              title="/"
            >
              /
            </button>
          </div>
          {running ? (
            <button type="button" className="agent-send-btn agent-stop-btn" onClick={onStop}>
              <IconStop /> {t('chat.stop')}
            </button>
          ) : (
            <button
              type="button"
              className="agent-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || !session}
            >
              <IconSend /> {t('chat.send')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ChatComposer);
