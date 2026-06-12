import { useState } from 'react';
import { KODER_ANCHOR_DISPLAY_EN, KODER_ANCHOR_DISPLAY_ZH, KODER_ANCHOR_ISO } from '../../shared/temporal-anchor';
import { useI18n } from '../contexts/I18nContext';
import Modal, { useModalClose } from './Modal';

interface Props {
  onDismiss: (dontShowAgain: boolean) => void;
}

export default function TemporalNoticeModal({ onDismiss }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(true);

  return (
    <Modal
      onClose={() => onDismiss(dontShowAgain)}
      closeOnOverlayClick={false}
      overlayClassName="temporal-notice-overlay"
      panelClassName="temporal-notice-modal"
      ariaLabelledby="temporal-notice-title"
    >
      <TemporalNoticeContent
        dontShowAgain={dontShowAgain}
        onDontShowAgainChange={setDontShowAgain}
      />
    </Modal>
  );
}

function TemporalNoticeContent({
  dontShowAgain,
  onDontShowAgainChange,
}: {
  dontShowAgain: boolean;
  onDontShowAgainChange: (value: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const requestClose = useModalClose();
  const displayDate = locale === 'en' ? KODER_ANCHOR_DISPLAY_EN : KODER_ANCHOR_DISPLAY_ZH;

  return (
    <>
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
            onChange={(e) => onDontShowAgainChange(e.target.checked)}
          />
          {t('temporal.dontShowAgain')}
        </label>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-primary" onClick={requestClose}>
          {t('temporal.understand')}
        </button>
      </div>
    </>
  );
}
