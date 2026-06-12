import { useEffect, useMemo, useState } from 'react';
import { computeLineDiff, countLines } from '../../shared/diff';
import type { FileSnapshot } from '../../shared/ipc';
import { extractPartialFileArgs } from '../../shared/tool-args';
import { detectLanguageFromPath } from '../lib/highlight';
import { getToolSummary } from '../lib/tool-summary';
import { useI18n } from '../contexts/I18nContext';
import CodeBlock from './CodeBlock';
import FileDiffView from './FileDiffView';

interface ToolCallData {
  id: string;
  name: string;
  input: string;
  output: string;
  status: 'running' | 'done' | 'error';
  fileSnapshot?: FileSnapshot;
}

interface Props {
  toolCall: ToolCallData;
}

function parseFileContent(toolCall: ToolCallData) {
  try {
    const parsed = JSON.parse(toolCall.input);
    return {
      path: parsed.path || '',
      content: parsed.content || '',
      anchor: parsed.anchor || '',
      action: parsed.action || '',
    };
  } catch {
    const partial = extractPartialFileArgs(toolCall.input);
    return {
      path: partial.path || '',
      content: partial.content || '',
      anchor: partial.anchor || '',
      action: partial.action || '',
    };
  }
}

function parseOutputStats(output: string): { lines?: number; bytes?: number } {
  const nowMatch = output.match(/file now (\d+) lines/i);
  const lineMatch = output.match(/(\d+)\s+lines?/i);
  const byteMatch = output.match(/(\d+)\s+bytes?/i);
  return {
    lines: nowMatch ? Number(nowMatch[1]) : lineMatch ? Number(lineMatch[1]) : undefined,
    bytes: byteMatch ? Number(byteMatch[1]) : undefined,
  };
}

function FilePreview({
  toolCall,
  fileInfo,
  lineCount,
}: {
  toolCall: ToolCallData;
  fileInfo: ReturnType<typeof parseFileContent>;
  lineCount: number;
}) {
  const { path: filePath, content: fileContent, anchor: insertAnchor, action: insertAction } = fileInfo;
  const isStreaming = toolCall.status === 'running';
  const outputStats = parseOutputStats(toolCall.output);
  const lang = filePath ? detectLanguageFromPath(filePath) : undefined;

  const MAX_PREVIEW = 50_000;
  const previewContent = fileContent.length > MAX_PREVIEW
    ? fileContent.slice(0, MAX_PREVIEW) + '\n\n// ... (内容过长，仅展示前 50K 字符)'
    : fileContent;

  const displayLines = toolCall.status === 'done' && outputStats.lines != null
    ? outputStats.lines
    : lineCount;

  return (
    <div className="tool-card-section">
      <div className="tool-card-section-label">
        {toolCall.name === 'insert_code' ? '插入内容' : '文件内容'}
        {isStreaming && ' · 实时写入中…'}
        {!isStreaming && displayLines > 0 && ` · ${displayLines} 行`}
      </div>
      <div className="tool-card-file-preview">
        <div className="tool-card-file-path">{filePath || '解析路径中…'}</div>
        {insertAnchor && (
          <div className="tool-card-file-meta">
            锚点: &quot;{insertAnchor.slice(0, 60)}&quot; · 操作: {insertAction}
          </div>
        )}
        <div className="tool-card-file-content-live">
          {previewContent ? (
            <CodeBlock language={lang} compact>{previewContent}</CodeBlock>
          ) : (
            <span className="tool-card-empty">{isStreaming ? '等待内容…' : '(无内容)'}</span>
          )}
          {isStreaming && <span className="streaming-cursor" />}
        </div>
        <div className="tool-card-file-info">
          <span>
            {displayLines > 0 ? `${displayLines} 行 · ` : ''}
            {(outputStats.bytes ?? fileContent.length)} 字符
          </span>
          <span>
            {toolCall.status === 'done' ? '已完成' : toolCall.status === 'error' ? '失败' : '写入中…'}
          </span>
        </div>
      </div>
    </div>
  );
}

const FILE_WRITE_TOOLS = new Set(['write_file', 'insert_code']);

function getOutputLabel(name: string, t: (key: string) => string): string {
  if (FILE_WRITE_TOOLS.has(name)) return t('tool.output.write');
  if (name === 'shell') return t('tool.output.exec');
  return t('tool.output.result');
}

export default function ToolCallCard({ toolCall }: Props) {
  const { locale, t } = useI18n();
  const isFileTool = toolCall.name === 'write_file' || toolCall.name === 'insert_code';
  const [expanded, setExpanded] = useState(isFileTool);
  const [panel, setPanel] = useState<'preview' | 'diff'>('preview');

  const summary = useMemo(
    () => getToolSummary(toolCall.name, toolCall.input, locale),
    [toolCall.name, toolCall.input, locale],
  );

  const fileInfo = useMemo(() => parseFileContent(toolCall), [toolCall.input, toolCall.name]);
  const outputStats = useMemo(() => parseOutputStats(toolCall.output), [toolCall.output]);

  const newContent = toolCall.fileSnapshot?.newContent ?? fileInfo.content;
  const lineCount = countLines(newContent || fileInfo.content);

  const diffSummary = useMemo(() => {
    if (!toolCall.fileSnapshot || !newContent) return null;
    return computeLineDiff(toolCall.fileSnapshot.originalContent, newContent).summary;
  }, [toolCall.fileSnapshot, newContent]);

  const canDiff = isFileTool
    && toolCall.status === 'done'
    && !!toolCall.fileSnapshot
    && !!newContent
    && !toolCall.output.startsWith('Error');

  useEffect(() => {
    if (isFileTool && toolCall.status === 'running') {
      setExpanded(true);
      setPanel('preview');
    }
    if (canDiff) {
      setExpanded(true);
      setPanel('diff');
    }
  }, [isFileTool, toolCall.status, canDiff]);

  const statusClass = toolCall.status === 'running' ? 'tool-running'
    : toolCall.status === 'error' ? 'tool-error'
    : 'tool-done';

  const displayLines = outputStats.lines ?? diffSummary?.newLines ?? lineCount;
  const showStatsBadge = isFileTool && toolCall.status === 'done' && displayLines > 0;

  const outputLabel = useMemo(
    () => getOutputLabel(toolCall.name, t),
    [toolCall.name, t],
  );

  const outputLanguage = useMemo(() => {
    if (toolCall.output.startsWith('Error')) return 'plaintext';
    if (toolCall.name === 'shell') return 'bash';
    return undefined;
  }, [toolCall.output, toolCall.name]);

  const simpleLabel = useMemo(() => {
    try {
      if (toolCall.name === 'list_dir' || toolCall.name === 'read_file') {
        const parsed = JSON.parse(toolCall.input || '{}');
        const path = parsed.path || '';
        const basename = path.split(/[\\/]/).pop() || path;
        if (toolCall.name === 'list_dir') {
          return `Analyzed ${basename}`;
        }
        return `Read ${basename}`;
      }
      if (toolCall.name === 'grep' || toolCall.name === 'glob') {
        const parsed = JSON.parse(toolCall.input || '{}');
        const pattern = parsed.pattern || parsed.query || '';
        return `${toolCall.name}: ${pattern}`;
      }
    } catch {
      // JSON parse failed, fall back to summary
    }
    return `${summary.verb} ${summary.target || ''}`;
  }, [toolCall.name, toolCall.input, summary]);

  return (
    <div className={`tool-card tool-card-cursor ${statusClass}`}>
      <button type="button" className="tool-card-header" onClick={() => setExpanded(!expanded)}>
        <span className="tool-card-status">
          {toolCall.status === 'running' && <span className="spinner" />}
          {toolCall.status === 'done' && (
            <svg className="tool-card-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 8 6 11 13 5" />
            </svg>
          )}
          {toolCall.status === 'error' && <span className="tool-card-error-mark">!</span>}
        </span>
        <span className="tool-card-summary">
          <span className="tool-card-simple-label">{simpleLabel}</span>
        </span>
        {showStatsBadge && diffSummary && (
          <span className="tool-card-stats-badge">
            {toolCall.fileSnapshot?.isNew ? (
              <span className="tool-card-stat-add">{displayLines} 行</span>
            ) : (
              <>
                <span className="tool-card-stat-total">{displayLines} 行</span>
                {diffSummary.added > 0 && <span className="tool-card-stat-add">+{diffSummary.added}</span>}
                {diffSummary.removed > 0 && <span className="tool-card-stat-remove">-{diffSummary.removed}</span>}
              </>
            )}
          </span>
        )}
        {showStatsBadge && !diffSummary && (
          <span className="tool-card-stats-badge">
            <span className="tool-card-stat-add">{displayLines} 行</span>
          </span>
        )}
        <span className="tool-card-chevron">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && isFileTool && canDiff && (
        <div className="tool-card-panel-tabs">
          <button
            type="button"
            className={`tool-card-panel-tab ${panel === 'preview' ? 'active' : ''}`}
            onClick={() => setPanel('preview')}
          >
            预览
          </button>
          <button
            type="button"
            className={`tool-card-panel-tab ${panel === 'diff' ? 'active' : ''}`}
            onClick={() => setPanel('diff')}
          >
            对比
          </button>
        </div>
      )}

      {expanded && isFileTool && (panel === 'preview' || toolCall.status === 'running' || !canDiff) && (
        <div className="tool-card-live-preview">
          <FilePreview toolCall={toolCall} fileInfo={fileInfo} lineCount={lineCount} />
        </div>
      )}

      {expanded && isFileTool && panel === 'diff' && canDiff && toolCall.fileSnapshot && (
        <div className="tool-card-diff-wrap">
          <FileDiffView
            filePath={toolCall.fileSnapshot.path}
            oldContent={toolCall.fileSnapshot.originalContent}
            newContent={newContent}
            isNewFile={toolCall.fileSnapshot.isNew}
          />
        </div>
      )}

      {expanded && (
        <div className="tool-card-body">
          {toolCall.output && (
            <div className="tool-card-section">
              <div className="tool-card-section-label">{outputLabel}</div>
              <CodeBlock compact language={outputLanguage}>{toolCall.output}</CodeBlock>
            </div>
          )}
          <div className="tool-card-section">
            <div className="tool-card-section-label">{t('tool.input.raw')}</div>
            <CodeBlock compact language="json">{toolCall.input}</CodeBlock>
          </div>
        </div>
      )}
    </div>
  );
}
