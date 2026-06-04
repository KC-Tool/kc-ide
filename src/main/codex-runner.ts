// Codex CLI 子进程管理器
// 负责：检测 codex 是否在 PATH、启动子进程、流式把 stdout/stderr 推回主进程

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// 本地类型（不再依赖共享 IPC 契约）
interface CodexRunRequest {
  prompt: string;
  cwd?: string;
  model?: string;
  sandbox?: string;
  approval?: string;
  extraArgs?: string[];
}

type EventCallback = (e: {
  type: 'stdout' | 'stderr' | 'exit' | 'error' | 'start';
  data?: string;
  code?: number;
  message?: string;
  ts: number;
}) => void;

interface RunHandle {
  runId: string;
  child: ChildProcessWithoutNullStreams;
  cancelled: boolean;
}

export class CodexRunner {
  private available: boolean | null = null;
  private version: string | null = null;
  private runs = new Map<string, RunHandle>();

  nextRunId(): string {
    return randomUUID();
  }

  isAvailable(): boolean {
    return this.available === true;
  }

  cachedVersion(): string | null {
    return this.version;
  }

  async detect(): Promise<{ available: boolean; version: string | null; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn('codex', ['--version'], { shell: false });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (b) => (stdout += b.toString()));
      child.stderr.on('data', (b) => (stderr += b.toString()));
      child.on('error', (err) => {
        this.available = false;
        this.version = null;
        resolve({ available: false, version: null, error: err.message });
      });
      child.on('close', (code) => {
        if (code === 0) {
          const v = stdout.trim().split(/\s+/).pop() ?? null;
          this.available = true;
          this.version = v;
          resolve({ available: true, version: v });
        } else {
          this.available = false;
          this.version = null;
          resolve({ available: false, version: null, error: stderr.trim() || `exit ${code}` });
        }
      });
    });
  }

  run(req: CodexRunRequest, runId: string, cb: EventCallback): void {
    const args = this.buildArgs(req);
    const cwd = req.cwd ?? process.cwd();

    cb({ type: 'start', data: `codex ${args.join(' ')}`, ts: Date.now() });

    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn('codex', args, {
        cwd,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
        shell: false,
      });
    } catch (err) {
      cb({ type: 'error', message: (err as Error).message, ts: Date.now() });
      return;
    }

    const handle: RunHandle = { runId, child, cancelled: false };
    this.runs.set(runId, handle);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => cb({ type: 'stdout', data: chunk, ts: Date.now() }));
    child.stderr.on('data', (chunk: string) => cb({ type: 'stderr', data: chunk, ts: Date.now() }));

    child.on('error', (err) => {
      cb({ type: 'error', message: err.message, ts: Date.now() });
      this.runs.delete(runId);
    });

    child.on('close', (code) => {
      if (!handle.cancelled) {
        cb({ type: 'exit', code: code ?? -1, ts: Date.now() });
      }
      this.runs.delete(runId);
    });
  }

  cancel(runId: string): boolean {
    const handle = this.runs.get(runId);
    if (!handle) return false;
    handle.cancelled = true;
    handle.child.kill();
    return true;
  }

  killAll(): void {
    for (const h of this.runs.values()) {
      h.cancelled = true;
      h.child.kill();
    }
    this.runs.clear();
  }

  private buildArgs(req: CodexRunRequest): string[] {
    const args: string[] = ['exec', '--color', 'never'];

    if (req.model) {
      args.push('--model', req.model);
    }
    if (req.sandbox) {
      args.push('--sandbox', req.sandbox);
    }
    if (req.cwd) {
      args.push('--cd', req.cwd);
    }

    if (req.approval === 'never') {
      args.push('--dangerously-bypass-approvals-and-sandbox');
    } else if (!req.sandbox) {
      args.push('--full-auto');
    }

    args.push('--skip-git-repo-check');
    args.push(req.prompt);

    if (req.extraArgs?.length) {
      args.push(...req.extraArgs);
    }
    return args;
  }
}
