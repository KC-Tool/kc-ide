import { useEffect, useRef, useState } from 'react';
import CodeBlock from './CodeBlock';

interface Props {
  language?: string;
  children: string;
  compact?: boolean;
}

/** 进入视口后再做语法高亮，减轻首屏/历史消息加载压力 */
export default function LazyCodeBlock({ language, children, compact }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '240px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const codeStr = String(children).replace(/\n$/, '');

  return (
    <div ref={ref}>
      {visible ? (
        <CodeBlock language={language} compact={compact}>{codeStr}</CodeBlock>
      ) : (
        <pre className={`hljs-block hljs-block-placeholder ${compact ? 'hljs-block-compact' : ''}`}>
          <code>{codeStr}</code>
        </pre>
      )}
    </div>
  );
}
