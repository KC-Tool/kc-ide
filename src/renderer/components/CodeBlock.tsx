import { useState } from 'react';
import { highlightCode } from '../lib/highlight';

const IconCopy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

interface Props {
  language?: string;
  children: string;
  /** 紧凑模式（工具卡片内） */
  compact?: boolean;
  showLineNumbers?: boolean;
}

export default function CodeBlock({ language, children, compact, showLineNumbers }: Props) {
  const [copied, setCopied] = useState(false);
  const codeStr = String(children).replace(/\n$/, '');
  const { html, language: detectedLang } = highlightCode(codeStr, language);
  const displayLang = detectedLang || language || 'text';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };

  const lines = codeStr.split('\n');

  return (
    <pre className={`hljs-block ${compact ? 'hljs-block-compact' : ''}`}>
      <div className="code-block-header">
        <span className="code-block-lang">{displayLang}</span>
        <button type="button" className={`code-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
          {copied ? <IconCheck /> : <IconCopy />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <div className="hljs-block-body">
        {showLineNumbers && lines.length > 1 ? (
          <table className="hljs-line-table">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className="hljs-line-num">{i + 1}</td>
                  <td className="hljs-line-code">
                    <code
                      className={`hljs language-${displayLang}`}
                      dangerouslySetInnerHTML={{
                        __html: highlightCode(line || ' ', displayLang).html,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <code
            className={`hljs language-${displayLang}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </pre>
  );
}

/** 行内代码高亮（单行） */
export function InlineCode({ children, language }: { children: string; language?: string }) {
  const { html, language: lang } = highlightCode(children, language);
  return (
    <code
      className={`inline-hljs language-${lang}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
