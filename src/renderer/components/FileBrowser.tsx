import { useCallback, useEffect, useState } from 'react';
import type { DirEntry } from '../../shared/ipc';
import Modal, { useModalClose } from './Modal';

interface Props {
  initialPath: string;
  onClose: () => void;
  onSelectDir: (dir: string) => void;
}

const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconArrowUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
  </svg>
);

const IconHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconFolder = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconFile = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function formatSize(bytes: number): string {
  if (bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function parentDir(p: string): string {
  // Windows: C:\, Unix: /
  const normalized = p.replace(/[\\/]+$/, '');
  const sep = normalized.includes('\\') ? '\\' : '/';
  const idx = normalized.lastIndexOf(sep);
  if (idx <= 0) return normalized;
  // Windows root: C:\
  if (sep === '\\' && idx === 2 && normalized[1] === ':') {
    return normalized.slice(0, 3);
  }
  // Unix root
  if (idx === 0) return '/';
  return normalized.slice(0, idx);
}

export default function FileBrowser(props: Props) {
  return (
    <Modal onClose={props.onClose} panelClassName="modal-lg">
      <FileBrowserContent {...props} />
    </Modal>
  );
}

function FileBrowserContent({ initialPath, onSelectDir }: Props) {
  const requestClose = useModalClose();
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDir = useCallback(async (dirPath?: string) => {
    setLoading(true);
    try {
      const result = await window.koder.readDir(dirPath || undefined);
      setEntries(result);
      if (dirPath) {
        setCurrentPath(dirPath);
      } else if (result.length > 0) {
        // 首次加载时从返回结果推断当前路径
        setCurrentPath(parentDir(result[0].path));
      }
    } catch {
      setEntries([]);
    }
    setLoading(false);
  }, []);

  // 初始加载
  useEffect(() => {
    loadDir(initialPath || undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoUp = () => {
    if (currentPath) {
      loadDir(parentDir(currentPath));
    }
  };

  const handleGoHome = () => {
    loadDir(undefined);
  };

  const handlePathSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      loadDir(currentPath);
    }
  };

  const handleClickEntry = (entry: DirEntry) => {
    if (entry.isDirectory) {
      loadDir(entry.path);
    }
  };

  return (
    <>
        <div className="modal-header">
          <h2>文件浏览</h2>
          <button className="icon-btn" onClick={requestClose}>
            <IconX />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '12px 20px' }}>
          {/* 路径导航栏 */}
          <div className="fb-path-bar">
            <button className="fb-nav-btn" onClick={handleGoUp} title="上级目录">
              <IconArrowUp />
            </button>
            <button className="fb-nav-btn" onClick={handleGoHome} title="主目录">
              <IconHome />
            </button>
            <input
              className="fb-path-input"
              type="text"
              value={currentPath}
              onChange={(e) => setCurrentPath(e.target.value)}
              onKeyDown={handlePathSubmit}
              placeholder="输入路径…"
            />
          </div>

          {/* 文件列表 */}
          {loading ? (
            <div className="fb-loading">加载中…</div>
          ) : entries.length === 0 ? (
            <div className="fb-empty">目录为空或无法访问</div>
          ) : (
            <ul className="fb-list">
              {entries.map((entry) => (
                <li key={entry.path}>
                  <button className="fb-item" onClick={() => handleClickEntry(entry)}>
                    <span className={`fb-item-icon ${entry.isDirectory ? 'dir-icon' : ''}`}>
                      {entry.isDirectory ? <IconFolder /> : <IconFile />}
                    </span>
                    <span className="fb-item-name">{entry.name}</span>
                    {!entry.isDirectory && (
                      <span className="fb-item-size">{formatSize(entry.size)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={requestClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onSelectDir(currentPath);
              requestClose();
            }}
            disabled={!currentPath}
          >
            <IconCheck />
            选择此目录
          </button>
        </div>
    </>
  );
}
