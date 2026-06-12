import { useI18n } from '../contexts/I18nContext';

interface Props {
  planMarkdown: string;
  filePath?: string;
  onBuild: () => void;
  onDismiss: () => void;
  onView?: () => void;
}

export default function PlanPanel({ planMarkdown, filePath, onBuild, onDismiss, onView }: Props) {
  const { t } = useI18n();
  const preview = planMarkdown.trim().slice(0, 120).replace(/\n/g, ' ');

  return (
    <div className="plan-panel">
      <div className="plan-panel-icon" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      </div>
      <div className="plan-panel-body">
        <div className="plan-panel-title">{t('agent.plan.ready')}</div>
        <div className="plan-panel-preview" title={preview}>{preview}{planMarkdown.length > 120 ? '…' : ''}</div>
      </div>
      <div className="plan-panel-actions">
        {filePath && onView && (
          <button type="button" className="btn btn-ghost plan-panel-view" onClick={onView}>
            {t('agent.plan.view')}
          </button>
        )}
        <button type="button" className="btn btn-ghost plan-panel-dismiss" onClick={onDismiss}>
          {t('agent.plan.dismiss')}
        </button>
        <button type="button" className="btn btn-primary plan-panel-build" onClick={onBuild}>
          {t('agent.plan.build')}
        </button>
      </div>
    </div>
  );
}
