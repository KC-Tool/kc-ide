import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useI18n } from '../contexts/I18nContext';
import LazyCodeBlock from './LazyCodeBlock';

interface Props {
  content: string;
  streaming?: boolean;
  label?: string;
}

const IconSparkle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </svg>
);

export default function ThinkingBlock({ content, streaming, label }: Props) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!streaming) return;
    startedAt.current = Date.now();
    setElapsed(0);
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => clearInterval(tick);
  }, [streaming]);

  if (!content && !streaming) return null;

  const seconds = streaming ? elapsed : Math.max(1, Math.ceil(content.length / 80));
  const headerText = label ?? (streaming
    ? t('agent.planning')
    : t('agent.thoughtFor', { s: seconds }));

  return (
    <div className="thinking-block" data-streaming={streaming ? 'true' : 'false'}>
      <button
        type="button"
        className="thinking-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="thinking-icon" aria-hidden="true">
          {streaming ? <span className="thinking-spinner" /> : <IconSparkle />}
        </span>
        <span className="thinking-label">{headerText}</span>
        <span className="thinking-chevron" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="thinking-body">
          <div className="thinking-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...rest }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeStr = String(children).replace(/\n$/, '');
                  if (match || codeStr.includes('\n')) {
                    return <LazyCodeBlock language={match?.[1] ?? ''}>{codeStr}</LazyCodeBlock>;
                  }
                  return <code className={className} {...rest}>{children}</code>;
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
          {streaming && <span className="streaming-cursor" />}
        </div>
      )}
    </div>
  );
}
