import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Modal, { useModalClose } from './Modal';
import { useI18n } from '../contexts/I18nContext';
import CodeBlock from './CodeBlock';

interface Props {
  markdown: string;
  filePath?: string;
  onBuild: () => void;
  onDismiss: () => void;
}

function PlanModalContent({ markdown, filePath, onBuild, onDismiss }: Props) {
  const requestClose = useModalClose();
  const { t } = useI18n();

  const handleDismiss = () => {
    onDismiss();
    requestClose();
  };

  const handleBuild = () => {
    onBuild();
    requestClose();
  };

  return (
    <>
      <div className="modal-header">
        <h2 id="plan-modal-title">{t('agent.plan.modalTitle')}</h2>
        <button type="button" className="icon-btn" onClick={handleDismiss} aria-label={t('common.close')}>
          ×
        </button>
      </div>
      <div className="plan-modal-body">
        {filePath && (
          <div className="plan-modal-path" title={filePath}>
            {t('agent.plan.savedTo')}: <code>{filePath}</code>
          </div>
        )}
        <div className="plan-modal-markdown">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeStr = String(children).replace(/\n$/, '');
                if (match) {
                  return <CodeBlock language={match[1]} compact>{codeStr}</CodeBlock>;
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
      <div className="modal-footer plan-modal-footer">
        <button type="button" className="btn btn-ghost" onClick={handleDismiss}>
          {t('agent.plan.dismiss')}
        </button>
        <button type="button" className="btn btn-primary" onClick={handleBuild}>
          {t('agent.plan.build')}
        </button>
      </div>
    </>
  );
}

export default function PlanModal(props: Props) {
  return (
    <Modal panelClassName="modal-lg plan-modal" ariaLabelledby="plan-modal-title">
      <PlanModalContent {...props} />
    </Modal>
  );
}
