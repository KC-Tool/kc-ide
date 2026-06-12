import { useI18n } from '../contexts/I18nContext';
import { INTERACTION_MODES, type InteractionMode } from '../../shared/agent-modes';

export type { InteractionMode };

const CONTEXT_RING_R = 15.5;
const CONTEXT_RING_C = 2 * Math.PI * CONTEXT_RING_R;

interface Props {
  title?: string;
  modelName: string;
  configured: boolean;
  mode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  contextPercent: number;
  hasContextUsage: boolean;
  showContextDetail: boolean;
  onToggleContext: () => void;
  running: boolean;
}

const IconInfinity = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-5.096 0-5.096 8 0 8 5.096 0 7.133-8 12.739-8" />
  </svg>
);

export default function ChatHeader({
  title,
  modelName,
  configured,
  mode,
  onModeChange,
  contextPercent,
  hasContextUsage,
  showContextDetail,
  onToggleContext,
  running,
}: Props) {
  const { t } = useI18n();
  const pct = Math.min(Math.max(contextPercent, 0), 100);
  const dash = (pct / 100) * CONTEXT_RING_C;

  return (
    <header className="agent-header">
      <div className="agent-header-left">
        <div className="agent-header-title-row">
          <IconInfinity />
          <span className="agent-header-title">{title || t('agent.newChat')}</span>
          {running && <span className="agent-header-live">{t('agent.running')}</span>}
        </div>
        <div className="agent-mode-tabs" role="tablist" aria-label={t('agent.mode.label')}>
          {INTERACTION_MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`agent-mode-tab ${mode === m ? 'active' : ''}`}
              onClick={() => onModeChange(m)}
              title={t(`agent.mode.${m}Hint`)}
            >
              {t(`agent.mode.${m}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="agent-header-right">
        <button
          type="button"
          className={`agent-context-ring ${showContextDetail ? 'open' : ''} ${hasContextUsage ? 'has-usage' : 'empty'}`}
          onClick={onToggleContext}
          title={hasContextUsage ? t('chat.context.detail') : t('agent.context.empty')}
          disabled={!hasContextUsage}
        >
          <svg className="agent-context-svg" viewBox="0 0 36 36">
            <circle className="agent-context-track" cx="18" cy="18" r={CONTEXT_RING_R} fill="none" strokeWidth="3" />
            {hasContextUsage && (
              <circle
                className="agent-context-progress"
                cx="18"
                cy="18"
                r={CONTEXT_RING_R}
                fill="none"
                strokeWidth="3"
                strokeDasharray={`${dash} ${CONTEXT_RING_C}`}
                transform="rotate(-90 18 18)"
              />
            )}
          </svg>
          {hasContextUsage && (
            <span className="agent-context-pct">{pct.toFixed(0)}%</span>
          )}
        </button>
        <div className="agent-model-chip" title={configured ? modelName : t('agent.modelNotConfigured')}>
          <span className="agent-model-dot" data-configured={configured ? 'true' : 'false'} />
          <span className="agent-model-name">{configured ? modelName : t('agent.modelNotConfigured')}</span>
        </div>
      </div>
    </header>
  );
}
