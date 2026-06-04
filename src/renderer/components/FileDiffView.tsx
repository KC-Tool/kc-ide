import { useMemo, useState } from 'react';
import { computeLineDiff, type DiffSummary } from '../../shared/diff';

interface Props {
  filePath: string;
  oldContent: string;
  newContent: string;
  isNewFile?: boolean;
}

type ViewMode = 'unified' | 'split';

export default function FileDiffView({ filePath, oldContent, newContent, isNewFile }: Props) {
  const [mode, setMode] = useState<ViewMode>('unified');

  const { lines, summary } = useMemo(
    () => computeLineDiff(oldContent, newContent),
    [oldContent, newContent],
  );

  const fileName = filePath.split(/[\\/]/).pop() || filePath;

  return (
    <div className="file-diff">
      <div className="file-diff-header">
        <div className="file-diff-title">
          <span className="file-diff-filename">{fileName}</span>
          <DiffSummaryBadge summary={summary} isNewFile={isNewFile} />
        </div>
        <div className="file-diff-tabs">
          <button
            type="button"
            className={`file-diff-tab ${mode === 'unified' ? 'active' : ''}`}
            onClick={() => setMode('unified')}
          >
            统一
          </button>
          <button
            type="button"
            className={`file-diff-tab ${mode === 'split' ? 'active' : ''}`}
            onClick={() => setMode('split')}
          >
            分栏
          </button>
        </div>
      </div>

      {mode === 'unified' ? (
        <pre className="file-diff-body">
          {lines.map((line, i) => (
            <div key={i} className={`file-diff-line file-diff-${line.type}`}>
              <span className="file-diff-gutter">
                {line.type === 'remove' || line.type === 'context' ? (line.oldNum ?? '') : ''}
                {' '}
                {line.type === 'add' || line.type === 'context' ? (line.newNum ?? '') : ''}
              </span>
              <span className="file-diff-sign">
                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
              </span>
              <code>{line.content || ' '}</code>
            </div>
          ))}
        </pre>
      ) : (
        <SplitDiffView oldContent={oldContent} newContent={newContent} summary={summary} />
      )}
    </div>
  );
}

function DiffSummaryBadge({ summary, isNewFile }: { summary: DiffSummary; isNewFile?: boolean }) {
  if (isNewFile) {
    return (
      <span className="file-diff-stats">
        <span className="file-diff-stat-add">新文件 · {summary.newLines} 行</span>
      </span>
    );
  }
  return (
    <span className="file-diff-stats">
      <span className="file-diff-stat-total">{summary.newLines} 行</span>
      {summary.added > 0 && <span className="file-diff-stat-add">+{summary.added}</span>}
      {summary.removed > 0 && <span className="file-diff-stat-remove">-{summary.removed}</span>}
    </span>
  );
}

function SplitDiffView({
  oldContent,
  newContent,
  summary,
}: {
  oldContent: string;
  newContent: string;
  summary: DiffSummary;
}) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  return (
    <div className="file-diff-split">
      <div className="file-diff-pane">
        <div className="file-diff-pane-label">修改前 · {summary.oldLines} 行</div>
        <pre className="file-diff-pane-body">
          {oldLines.map((line, i) => (
            <div key={i} className="file-diff-pane-line">
              <span className="file-diff-gutter">{i + 1}</span>
              <code>{line || ' '}</code>
            </div>
          ))}
        </pre>
      </div>
      <div className="file-diff-pane">
        <div className="file-diff-pane-label">修改后 · {summary.newLines} 行</div>
        <pre className="file-diff-pane-body">
          {newLines.map((line, i) => (
            <div key={i} className="file-diff-pane-line">
              <span className="file-diff-gutter">{i + 1}</span>
              <code>{line || ' '}</code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
