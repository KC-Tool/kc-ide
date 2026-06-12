import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ToolCallCard from './ToolCallCard';
import ThinkingBlock from './ThinkingBlock';
import LazyCodeBlock from './LazyCodeBlock';
import type { UiMessage } from '../lib/chat-message-model';

function parseMessageContent(text: string) {
  return text
    .replace(/\n<<TOOL_CALL:.*?>>/g, '')
    .replace(/\n<<TOOL_RESULT:.*?>>/g, '');
}

function renderMarkdown(text: string) {
  return (
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
      {text}
    </ReactMarkdown>
  );
}

const IconRollback = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

interface RowProps {
  message: UiMessage;
  msgIndex: number;
  running: boolean;
  planningLabel: string;
  thoughtLabel: string;
  thoughtNLabel: (n: number) => string;
  rollbackLabel: string;
  rollbackTitle: string;
  onRollback: (index: number) => void;
}

const ChatMessageRow = memo(function ChatMessageRow({
  message: m,
  msgIndex,
  running,
  planningLabel,
  thoughtLabel,
  thoughtNLabel,
  rollbackLabel,
  rollbackTitle,
  onRollback,
}: RowProps) {
  if (m.role === 'system') {
    return (
      <div className="agent-system-msg">
        {renderMarkdown(m.text)}
      </div>
    );
  }

  const cleanText = parseMessageContent(m.text);
  const thinkingCount = m.segments.filter((s) => s.type === 'thinking').length;

  return (
    <div className={`agent-msg agent-msg-${m.role}`}>
      {m.role === 'user' ? (
        <div className="agent-user-bubble">
          <p>{m.text}</p>
        </div>
      ) : (
        <div className="agent-assistant-body">
          {m.segments.map((seg, segIndex) => {
            if (seg.type === 'thinking') {
              const thinkIndex = m.segments
                .slice(0, segIndex + 1)
                .filter((s) => s.type === 'thinking').length;
              const label = seg.streaming
                ? planningLabel
                : thinkingCount > 1
                  ? thoughtNLabel(thinkIndex)
                  : thoughtLabel;
              return (
                <ThinkingBlock
                  key={seg.id}
                  content={seg.content}
                  streaming={seg.streaming}
                  label={label}
                />
              );
            }
            if (seg.type === 'tool_call') {
              return <ToolCallCard key={seg.id} toolCall={seg.toolCall} />;
            }
            if (seg.type === 'text' && seg.content) {
              return (
                <div key={seg.id} className="agent-text-segment">
                  {renderMarkdown(parseMessageContent(seg.content))}
                </div>
              );
            }
            return null;
          })}
          {m.segments.length === 0 && cleanText && (
            <div className="agent-text-segment">{renderMarkdown(cleanText)}</div>
          )}
          {m.streaming && <span className="streaming-cursor" />}
          {!m.streaming && !running && msgIndex > 0 && (
            <button
              type="button"
              className="agent-rollback-btn"
              onClick={() => onRollback(msgIndex > 0 ? msgIndex - 1 : msgIndex)}
              title={rollbackTitle}
            >
              <IconRollback /> {rollbackLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

interface Props {
  messages: UiMessage[];
  running: boolean;
  hydrating?: boolean;
  emptyTitle: string;
  emptyDesc: string;
  modeAgentLabel: string;
  modePlanLabel: string;
  planningLabel: string;
  thoughtLabel: string;
  thoughtNLabel: (n: number) => string;
  rollbackLabel: string;
  rollbackTitle: string;
  onRollback: (index: number) => void;
}

function ChatMessageList({
  messages,
  running,
  hydrating,
  emptyTitle,
  emptyDesc,
  modeAgentLabel,
  modePlanLabel,
  planningLabel,
  thoughtLabel,
  thoughtNLabel,
  rollbackLabel,
  rollbackTitle,
  onRollback,
}: Props) {
  if (messages.length === 0 && !hydrating) {
    return (
      <div className="agent-empty">
        <div className="agent-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h2>{emptyTitle}</h2>
        <p>{emptyDesc}</p>
        <div className="agent-empty-hints">
          <span>{modeAgentLabel}</span>
          <span>{modePlanLabel}</span>
          <span>/</span>
          <span>@</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {hydrating && (
        <div className="agent-hydrate-hint" aria-live="polite">…</div>
      )}
      {messages.map((m, msgIndex) => (
        <ChatMessageRow
          key={m.id}
          message={m}
          msgIndex={msgIndex}
          running={running}
          planningLabel={planningLabel}
          thoughtLabel={thoughtLabel}
          thoughtNLabel={thoughtNLabel}
          rollbackLabel={rollbackLabel}
          rollbackTitle={rollbackTitle}
          onRollback={onRollback}
        />
      ))}
    </>
  );
}

export default memo(ChatMessageList);
