// Koder 会话管理器
// 负责会话的 CRUD 与持久化到 userData/sessions.json

import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Session, SessionListItem, ChatMessage, FileSnapshot } from '../shared/ipc.js';

export class SessionManager {
  private sessions: Session[] = [];
  private filePath = '';

  constructor() {
    // 延迟初始化：需要等 app ready 后才能获取 userData 路径
  }

  init(): void {
    this.filePath = path.join(app.getPath('userData'), 'sessions.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.sessions = JSON.parse(raw);
      }
    } catch {
      this.sessions = [];
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.sessions, null, 2), 'utf8');
    } catch (err) {
      console.error('[koder sessions] save error:', err);
    }
  }

  list(): SessionListItem[] {
    return this.sessions
      .map((s) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id: string): Session | null {
    return this.sessions.find((s) => s.id === id) ?? null;
  }

  create(): Session {
    const now = Date.now();
    const session: Session = {
      id: randomUUID(),
      title: '新会话',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.unshift(session);
    this.save();
    return session;
  }

  delete(id: string): void {
    this.sessions = this.sessions.filter((s) => s.id !== id);
    this.save();
  }

  addMessage(sessionId: string, msg: ChatMessage): void {
    const session = this.get(sessionId);
    if (!session) return;
    session.messages.push(msg);
    session.updatedAt = Date.now();

    // 用第一条用户消息自动生成标题
    if (session.title === '新会话' && msg.role === 'user') {
      session.title = msg.text.slice(0, 50) + (msg.text.length > 50 ? '…' : '');
    }

    this.save();
  }

  updateTitle(sessionId: string, title: string): void {
    const session = this.get(sessionId);
    if (!session) return;
    session.title = title;
    session.updatedAt = Date.now();
    this.save();
  }

  updateMeta(sessionId: string, patch: Partial<Pick<Session, 'title' | 'cwd' | 'model'>>): void {
    const session = this.get(sessionId);
    if (!session) return;
    if (patch.title !== undefined) session.title = patch.title;
    if (patch.cwd !== undefined) session.cwd = patch.cwd;
    if (patch.model !== undefined) session.model = patch.model;
    session.updatedAt = Date.now();
    this.save();
  }

  /** 保存某轮 assistant 回复对应的文件快照 */
  saveSnapshots(sessionId: string, assistantMessageId: string, snapshots: FileSnapshot[]): void {
    const session = this.get(sessionId);
    if (!session) return;
    if (!session.fileSnapshots) session.fileSnapshots = {};
    session.fileSnapshots[assistantMessageId] = snapshots;
    this.save();
  }

  /**
   * 回退：恢复文件快照 + 删除从 fromIndex 开始的所有消息
   * 返回恢复的文件数和删除的消息数
   */
  rollback(sessionId: string, fromIndex: number): { ok: boolean; filesRestored: number; messagesRemoved: number } {
    const session = this.get(sessionId);
    if (!session) return { ok: false, filesRestored: 0, messagesRemoved: 0 };

    let filesRestored = 0;

    // 恢复 fromIndex 之后所有 assistant 消息对应的文件快照
    if (session.fileSnapshots) {
      for (let i = fromIndex; i < session.messages.length; i++) {
        const msg = session.messages[i];
        const snapshots = session.fileSnapshots[msg.id];
        if (snapshots) {
          for (const snap of snapshots) {
            try {
              if (snap.isNew) {
                // 新建的文件 → 删除
                if (fs.existsSync(snap.path)) {
                  fs.unlinkSync(snap.path);
                }
              } else {
                // 已存在的文件 → 恢复原始内容
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

    // 删除从 fromIndex 开始的所有消息
    const messagesRemoved = session.messages.length - fromIndex;
    session.messages = session.messages.slice(0, fromIndex);
    session.updatedAt = Date.now();
    this.save();

    return { ok: true, filesRestored, messagesRemoved };
  }
}
