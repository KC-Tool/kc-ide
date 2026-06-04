import { useCallback, useState } from 'react';
import { KODER_ANCHOR_DISPLAY_EN, KODER_ANCHOR_DISPLAY_ZH, KODER_ANCHOR_ISO } from '../../shared/temporal-anchor';
import { useI18n } from '../contexts/I18nContext';

interface Props {
  onDismiss: (dontShowAgain: boolean) => void;
}

export default function TemporalNoticeModal({ onDismiss }: Props) {
  const { t, locale } = useI18n();
  const [dontShowAgain, setDontShowAgain] = useState(true);

  const displayDate = locale === 'en' ? KODER_ANCHOR_DISPLAY_EN : KODER_ANCHOR_DISPLAY_ZH;

  const handleConfirm = useCallback(() => {
    onDismiss(dontShowAgain);
  }, [dontShowAgain, onDismiss]);

  return (
    <div className="modal-overlay temporal-notice-overlay">
      <div className="modal temporal-notice-modal" role="dialog" aria-labelledby="temporal-notice-title">
        <div className="modal-header">
          <h2 id="temporal-notice-title">{t('temporal.title')}</h2>
        </div>
        <div className="modal-body">
          <p className="temporal-notice-lead">{t('temporal.lead')}</p>
          <div className="temporal-notice-highlight">
            <span className="temporal-notice-date">{displayDate}</span>
            <code className="temporal-notice-iso">{KODER_ANCHOR_ISO}</code>
          </div>
          <ul className="temporal-notice-list">
            <li>{t('temporal.li1')}</li>
            <li>{t('temporal.li2')}</li>
            <li>{t('temporal.li3')}</li>
          </ul>
          <p className="temporal-notice-foot">{t('temporal.foot')}</p>
          <label className="temporal-notice-check">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            {t('temporal.dontShowAgain')}
          </label>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={handleConfirm}>
            {t('temporal.understand')}
          </button>
        </div>
      </div>
    </div>
  );
}
