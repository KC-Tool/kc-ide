// Koder 配置管理器
// 读写 ~/.koder/config.json，管理 API Key、模型、Base URL 等

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import type { AgentConfig } from '../shared/ipc.js';
import {
  DEFAULT_SYSTEM_PROMPT,
  SYSTEM_PROMPT_REVISION,
  isBundledSystemPrompt,
} from '../shared/system-prompt.js';

const DEFAULTS: AgentConfig = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  maxTokens: 16384,
  temperature: 0.3,
  maxContextTokens: 200000,
  reasoningEffort: 'medium',
  promptCacheEnabled: true,
  toolCacheEnabled: true,
  toolCacheMaxEntries: 300,
  toolCacheTtlMs: 300000,
  systemPromptRevision: SYSTEM_PROMPT_REVISION,
  systemPromptCustomized: false,
  appFrameRate: 60,
};

export class ConfigManager {
  private config: AgentConfig;
  private filePath: string;

  constructor() {
    this.config = { ...DEFAULTS };
    const koderDir = path.join(os.homedir(), '.koder');
    this.filePath = path.join(koderDir, 'config.json');
    this.load();
  }

  private migrateSystemPrompt(stored: Partial<AgentConfig>): Partial<AgentConfig> {
    const revision = stored.systemPromptRevision ?? 0;
    const customized = stored.systemPromptCustomized === true
      || (stored.systemPrompt != null && !isBundledSystemPrompt(stored.systemPrompt));

    if (revision < SYSTEM_PROMPT_REVISION && !customized) {
      return {
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        systemPromptRevision: SYSTEM_PROMPT_REVISION,
        systemPromptCustomized: false,
      };
    }

    return {
      systemPromptRevision: Math.max(revision, SYSTEM_PROMPT_REVISION),
      systemPromptCustomized: customized,
    };
  }

  private load(): void {
    let migrated = false;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const stored = JSON.parse(raw) as Partial<AgentConfig>;
        const promptPatch = this.migrateSystemPrompt(stored);
        this.config = { ...DEFAULTS, ...stored, ...promptPatch };
        migrated = promptPatch.systemPrompt !== undefined
          && stored.systemPrompt !== promptPatch.systemPrompt;
      }
    } catch {
      this.config = { ...DEFAULTS };
    }
    if (migrated) {
      this.save();
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (err) {
      console.error('[koder config] save error:', err);
    }
  }

  get(): AgentConfig {
    return { ...this.config };
  }

  getDefaultSystemPrompt(): string {
    return DEFAULT_SYSTEM_PROMPT;
  }

  update(patch: Partial<AgentConfig>): AgentConfig {
    const next = { ...this.config, ...patch };
    if (patch.systemPrompt !== undefined) {
      const trimmed = patch.systemPrompt.trim();
      if (trimmed === DEFAULT_SYSTEM_PROMPT.trim()) {
        next.systemPromptCustomized = false;
        next.systemPromptRevision = SYSTEM_PROMPT_REVISION;
      } else if (patch.systemPromptCustomized !== false) {
        next.systemPromptCustomized = true;
      }
    }
    if (patch.systemPromptCustomized === false) {
      next.systemPrompt = DEFAULT_SYSTEM_PROMPT;
      next.systemPromptRevision = SYSTEM_PROMPT_REVISION;
    }
    this.config = next;
    this.save();
    return this.get();
  }

  isConfigured(): boolean {
    return this.config.apiKey.length > 0 && this.config.baseUrl.length > 0;
  }
}
