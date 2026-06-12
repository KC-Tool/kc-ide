// 会话管理器 — 按工作区分目录持久化 ~/.koder/session/<folder>/<id>.json

import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import type { Session, SessionListItem, SessionRepoGroup, ChatMessage, FileSnapshot } from '../shared/ipc.js';
import type { TodoItem } from '../shared/todo-types.js';
import { formatTodosForAgent } from '../shared/todo-types.js';
import {
  cwdToStorageFolder,
  ensureSessionsRoot,
  formatCwdLabel,
  formatRepoDisplayName,
  getKoderSessionsRoot,
  getSessionFilePath,
} from './session-paths.js';

export { formatCwdLabel, formatRepoDisplayName, cwdToStorageFolder };

type SessionsUpdatedListener = () => void;

export class SessionManager {
  private sessions = new Map<string, Session>();
  private fileIndex = new Map<string, string>();
  private legacyPath = '';
  private loadPromise: Promise<void> | null = null;
  private ready = false;
  private onUpdatedListeners = new Set<SessionsUpdatedListener>();
  private updateBroadcastTimer: ReturnType<typeof setTimeout> | null = null;

  init(): void {
    ensureSessionsRoot();
    this.legacyPath = path.join(app.getPath('userData'), 'sessions.json');
    this.migrateLegacyIfNeeded();
    this.buildFileIndex();
    this.loadPromise = this.startBackgroundLoad();
  }

  onUpdated(listener: SessionsUpdatedListener): () => void {
    this.onUpdatedListeners.add(listener);
    return () => this.onUpdatedListeners.delete(listener);
  }

  isReady(): boolean {
    return this.ready;
  }

  async waitUntilReady(): Promise<void> {
    await this.loadPromise;
  }

  private scheduleBroadcast(): void {
    if (this.updateBroadcastTimer) return;
    this.updateBroadcastTimer = setTimeout(() => {
      this.updateBroadcastTimer = null;
      for (const fn of this.onUpdatedListeners) {
        try { fn(); } catch { /* ignore */ }
      }
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('sessions:updated');
        }
      }
    }, 120);
  }

  private buildFileIndex(): void {
    this.fileIndex.clear();
    const root = getKoderSessionsRoot();
    if (!fs.existsSync(root)) return;

    for (const folderEnt of fs.readdirSync(root, { withFileTypes: true })) {
      if (!folderEnt.isDirectory()) continue;
      const folderPath = path.join(root, folderEnt.name);
      let files: string[];
      try {
        files = fs.readdirSync(folderPath);
      } catch {
        continue;
      }
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const id = file.slice(0, -'.json'.length);
        this.fileIndex.set(id, path.join(folderPath, file));
      }
    }
  }

  private loadOneSync(id: string): Session | null {
    const filePath = this.fileIndex.get(id);
    if (!filePath || !fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const session = JSON.parse(raw) as Session;
      if (session?.id) {
        this.sessions.set(session.id, session);
        return session;
      }
    } catch {
      // skip corrupt file
    }
    return null;
  }

  private async loadAllFallback(): Promise<void> {
    const files = Array.from(this.fileIndex.values());
    const BATCH = 4;
    for (let i = 0; i < files.length; i += BATCH) {
      const batch = files.slice(i, i + BATCH);
      await new Promise<void>((resolve) => {
        setImmediate(() => {
          for (const filePath of batch) {
            try {
              const raw = fs.readFileSync(filePath, 'utf8');
              const session = JSON.parse(raw) as Session;
              if (session?.id) this.sessions.set(session.id, session);
            } catch {
              // skip
            }
          }
          this.scheduleBroadcast();
          resolve();
        });
      });
    }
  }

  private startBackgroundLoad(): Promise<void> {
    const files = Array.from(this.fileIndex.values());
    if (files.length === 0) {
      this.ready = true;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const workerPath = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        'session-load-worker.cjs',
      );

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.ready = true;
        this.scheduleBroadcast();
        resolve();
      };

      try {
        const worker = new Worker(workerPath, { workerData: { files } });
        worker.on('message', (msg: { ok?: boolean; session?: Session; done?: boolean }) => {
          if (msg.done) {
            worker.terminate().catch(() => {});
            finish();
            return;
          }
          if (msg.ok && msg.session?.id) {
            this.sessions.set(msg.session.id, msg.session);
            this.scheduleBroadcast();
          }
        });
        worker.on('error', (err) => {
          console.error('[koder sessions] worker error:', err);
          worker.terminate().catch(() => {});
          void this.loadAllFallback().then(finish);
        });
        worker.on('exit', (code) => {
          if (!settled && code !== 0) {
            void this.loadAllFallback().then(finish);
          }
        });
      } catch (err) {
        console.error('[koder sessions] worker spawn failed:', err);
        void this.loadAllFallback().then(finish);
      }
    });
  }

  private migrateLegacyIfNeeded(): void {
    if (!fs.existsSync(this.legacyPath)) return;
    try {
      const raw = fs.readFileSync(this.legacyPath, 'utf8');
      const list = JSON.parse(raw) as Session[];
      if (!Array.isArray(list)) return;

      for (const session of list) {
        this.writeSessionFile(session);
      }

      const backup = `${this.legacyPath}.bak`;
      fs.renameSync(this.legacyPath, backup);
      console.log('[koder sessions] migrated legacy sessions.json →', getKoderSessionsRoot());
    } catch (err) {
      console.error('[koder sessions] legacy migrate error:', err);
    }
  }

  private writeSessionFile(session: Session): void {
    const filePath = getSessionFilePath(session.id, session.cwd);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
  }

  private removeSessionFile(session: Session): void {
    const filePath = getSessionFilePath(session.id, session.cwd);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }

  private persist(session: Session): void {
    this.writeSessionFile(session);
    this.sessions.set(session.id, session);
  }

  list(): SessionListItem[] {
    const items = Array.from(this.sessions.values()).map((s) => {
      const storageFolder = cwdToStorageFolder(s.cwd);
      return {
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
        cwd: s.cwd,
        cwdLabel: formatCwdLabel(s.cwd),
        storageFolder,
        repoLabel: formatRepoDisplayName(s.cwd, storageFolder),
      };
    });
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id: string): Session | null {
    return this.sessions.get(id) ?? this.loadOneSync(id);
  }

  create(cwd?: string): Session {
    const now = Date.now();
    const session: Session = {
      id: randomUUID(),
      title: '新会话',
      messages: [],
      createdAt: now,
      updatedAt: now,
      cwd: cwd || undefined,
    };
    this.fileIndex.set(session.id, getSessionFilePath(session.id, session.cwd));
    this.persist(session);
    return session;
  }

  delete(id: string): void {
    const session = this.get(id);
    if (!session) return;
    this.removeSessionFile(session);
    this.sessions.delete(id);
    this.fileIndex.delete(id);
    this.scheduleBroadcast();
  }

  getTodos(sessionId: string): TodoItem[] {
    const session = this.get(sessionId);
    return session?.todos ? [...session.todos] : [];
  }

  addTodo(sessionId: string, text: string): TodoItem | null {
    const session = this.get(sessionId);
    if (!session || !text.trim()) return null;
    if (!session.todos) session.todos = [];
    const item: TodoItem = {
      id: randomUUID().slice(0, 8),
      text: text.trim(),
      done: false,
      createdAt: Date.now(),
    };
    session.todos.push(item);
    session.updatedAt = Date.now();
    this.persist(session);
    return item;
  }

  completeTodo(sessionId: string, todoId: string): { ok: boolean; item?: TodoItem; error?: string } {
    const session = this.get(sessionId);
    if (!session?.todos) return { ok: false, error: 'No todos in session' };
    const item = session.todos.find(t => t.id === todoId);
    if (!item) return { ok: false, error: `Todo not found: ${todoId}` };
    if (!item.done) {
      item.done = true;
      item.completedAt = Date.now();
      session.updatedAt = Date.now();
      this.persist(session);
    }
    return { ok: true, item };
  }

  setTodoDone(sessionId: string, todoId: string, done: boolean): { ok: boolean; item?: TodoItem; error?: string } {
    const session = this.get(sessionId);
    if (!session?.todos) return { ok: false, error: 'No todos in session' };
    const item = session.todos.find(t => t.id === todoId);
    if (!item) return { ok: false, error: `Todo not found: ${todoId}` };
    item.done = done;
    item.completedAt = done ? Date.now() : undefined;
    session.updatedAt = Date.now();
    this.persist(session);
    return { ok: true, item };
  }

  formatTodosList(sessionId: string): string {
    return formatTodosForAgent(this.getTodos(sessionId));
  }

  addMessage(sessionId: string, msg: ChatMessage): void {
    const session = this.get(sessionId);
    if (!session) return;
    session.messages.push(msg);
    session.updatedAt = Date.now();

    if (session.title === '新会话' && msg.role === 'user') {
      session.title = msg.text.slice(0, 50) + (msg.text.length > 50 ? '…' : '');
    }

    this.persist(session);
  }

  updateTitle(sessionId: string, title: string): void {
    const session = this.get(sessionId);
    if (!session) return;
    session.title = title;
    session.updatedAt = Date.now();
    this.persist(session);
  }

  updateMeta(sessionId: string, patch: Partial<Pick<Session, 'title' | 'cwd' | 'model' | 'activeTeamId'>>): void {
    const session = this.get(sessionId);
    if (!session) return;

    const oldCwd = session.cwd;
    const cwdChanged = patch.cwd !== undefined && cwdToStorageFolder(patch.cwd) !== cwdToStorageFolder(oldCwd);

    if (patch.title !== undefined) session.title = patch.title;
    if (patch.cwd !== undefined) session.cwd = patch.cwd;
    if (patch.model !== undefined) session.model = patch.model;
    if (patch.activeTeamId !== undefined) session.activeTeamId = patch.activeTeamId || undefined;
    session.updatedAt = Date.now();

    if (cwdChanged) {
      this.removeSessionFile({ ...session, cwd: oldCwd });
    }

    this.persist(session);
  }

  saveSnapshots(sessionId: string, assistantMessageId: string, snapshots: FileSnapshot[]): void {
    const session = this.get(sessionId);
    if (!session) return;
    if (!session.fileSnapshots) session.fileSnapshots = {};
    session.fileSnapshots[assistantMessageId] = snapshots;
    this.persist(session);
  }

  rollback(sessionId: string, fromIndex: number): { ok: boolean; filesRestored: number; messagesRemoved: number } {
    const session = this.get(sessionId);
    if (!session) return { ok: false, filesRestored: 0, messagesRemoved: 0 };

    let filesRestored = 0;

    if (session.fileSnapshots) {
      for (let i = fromIndex; i < session.messages.length; i++) {
        const msg = session.messages[i];
        const snapshots = session.fileSnapshots[msg.id];
        if (snapshots) {
          for (const snap of snapshots) {
            try {
              if (snap.isNew) {
                if (fs.existsSync(snap.path)) {
                  fs.unlinkSync(snap.path);
                }
              } else {
                const dir = path.dirname(snap.path);
                if (!fs.existsSync(dir)) {
                  fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(snap.path, snap.originalContent, 'utf8');
              }
              filesRestored++;
            } catch (err) {
              console.error('[koder sessions] rollback file restore error:', snap.path, err);
            }
          }
          delete session.fileSnapshots[msg.id];
        }
      }
    }

    const messagesRemoved = session.messages.length - fromIndex;
    session.messages = session.messages.slice(0, fromIndex);
    session.updatedAt = Date.now();
    this.persist(session);

    return { ok: true, filesRestored, messagesRemoved };
  }

  listRepoTree(): SessionRepoGroup[] {
    const list = this.list();
    const map = new Map<string, SessionRepoGroup>();

    for (const s of list) {
      const key = s.cwd ?? '';
      if (!map.has(key)) {
        map.set(key, {
          cwd: s.cwd,
          storageFolder: s.storageFolder,
          repoLabel: s.repoLabel,
          sessions: [],
        });
      }
      map.get(key)!.sessions.push(s);
    }

    const groups = Array.from(map.values());
    for (const g of groups) {
      g.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    groups.sort((a, b) => {
      const ta = a.sessions[0]?.updatedAt ?? 0;
      const tb = b.sessions[0]?.updatedAt ?? 0;
      return tb - ta;
    });
    return groups;
  }

  /** 列出已有工作区目录（含仅有文件夹、尚无会话的情况） */
  listWorkspaceFolders(): string[] {
    const root = getKoderSessionsRoot();
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();
  }
}
