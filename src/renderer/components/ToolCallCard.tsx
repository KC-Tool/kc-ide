import { useEffect, useMemo, useState } from 'react';
import { computeLineDiff, countLines } from '../../shared/diff';
import type { FileSnapshot } from '../../shared/ipc';
import { extractPartialFileArgs } from '../../shared/tool-args';
import { detectLanguageFromPath } from '../lib/highlight';
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

const TOOL_LABELS: Record<string, string> = {
  read_file: '读取文件',
  write_file: '写入文件',
  list_dir: '列出目录',
  shell: '执行命令',
  grep: '搜索内容',
  glob: '查找文件',
  insert_code: '插入代码',
};

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
  const scrollRef = useRef<HTMLPreElement>(null);
  const { path: filePath, content: fileContent, anchor: insertAnchor, action: insertAction } = fileInfo;
  const isStreaming = toolCall.status === 'running';
  const outputStats = parseOutputStats(toolCall.output);

  const MAX_PREVIEW = 50_000;
  const previewContent = fileContent.length > MAX_PREVIEW
    ? fileContent.slice(0, MAX_PREVIEW) + '\n\n// ... (内容过长，仅展示前 50K 字符)'
    : fileContent;

  const displayLines = toolCall.status === 'done' && outputStats.lines != null
    ? outputStats.lines
    : lineCount;

  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [previewContent, isStreaming]);

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
        <pre ref={scrollRef} className="tool-card-code tool-card-file-content tool-card-file-content-live">
          <code>{previewContent || (isStreaming ? '' : '(无内容)')}</code>
          {isStreaming && <span className="streaming-cursor" />}
        </pre>
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

export default function ToolCallCard({ toolCall }: Props) {
  const isFileTool = toolCall.name === 'write_file' || toolCall.name === 'insert_code';
  const [expanded, setExpanded] = useState(isFileTool);
  const [panel, setPanel] = useState<'preview' | 'diff'>('preview');

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

  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;
  const statusClass = toolCall.status === 'running' ? 'tool-running'
    : toolCall.status === 'error' ? 'tool-error'
    : 'tool-done';

  let inputDisplay = fileInfo.path;
  if (!inputDisplay) {
    try {
      const parsed = JSON.parse(toolCall.input);
      inputDisplay = parsed.path || parsed.command || parsed.pattern || toolCall.input;
    } catch {
      inputDisplay = toolCall.input.slice(0, 40);
    }
  }

  const displayLines = outputStats.lines ?? diffSummary?.newLines ?? lineCount;
  const showStatsBadge = isFileTool && toolCall.status === 'done' && displayLines > 0;

  return (
    <div className={`tool-card ${statusClass}`}>
      <button type="button" className="tool-card-header" onClick={() => setExpanded(!expanded)}>
        <span className="tool-card-icon tool-card-icon-text">{label.slice(0, 1)}</span>
        <span className="tool-card-label">{label}</span>
        <span className="tool-card-input" title={inputDisplay}>{inputDisplay}</span>
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
        <span className="tool-card-status">
          {toolCall.status === 'running' && <span className="spinner" />}
          {toolCall.status === 'done' && '✓'}
          {toolCall.status === 'error' && '✗'}
        </span>
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
              <div className="tool-card-section-label">执行结果</div>
              <pre className="tool-card-code tool-card-output">{toolCall.output}</pre>
            </div>
          )}
          <div className="tool-card-section">
            <div className="tool-card-section-label">原始输入</div>
            <pre className="tool-card-code">{toolCall.input}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
