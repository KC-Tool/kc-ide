import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';

interface Props {
  content: string;
  streaming?: boolean;
  label?: string;
}

export default function ThinkingBlock({ content, streaming, label }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!content) return null;

  return (
    <div className="thinking-block">
      <button type="button" className="thinking-header" onClick={() => setExpanded(!expanded)}>
        <span className="thinking-icon">
          {streaming ? <span className="thinking-pulse" /> : <span className="thinking-dot" />}
        </span>
        <span className="thinking-label">
          {label ?? (streaming ? '思考中…' : '思考过程')}
        </span>
        <span className="thinking-chevron">{expanded ? '▾' : '▸'}</span>
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
                    return <CodeBlock language={match?.[1] ?? ''}>{codeStr}</CodeBlock>;
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
