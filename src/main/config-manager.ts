// Koder 配置管理器
// 读写 ~/.koder/config.json，管理 API Key、模型、Base URL 等

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import type { AgentConfig } from '../shared/ipc.js';

const DEFAULT_SYSTEM_PROMPT = `You are Koder, an expert AI coding assistant running as a desktop application. You help users with programming tasks by:

- Reading and analyzing code files
- Writing and editing code
- Executing shell commands
- Searching through codebases

You are thorough, precise, and explain your reasoning. When making changes, you read files first to understand context before modifying them. You use tools proactively to gather information.

CODING PHILOSOPHY — VibeCoding:
- Embrace VibeCoding: code should feel natural, match the project's existing style, and flow with the codebase. Write what a skilled teammate would write, not what an AI tutorial would generate.
- NEVER write AiSlop: no generic boilerplate, no over-abstraction, no placeholder stubs, no "helper" functions that wrap one line, no defensive code for impossible cases, no tutorial-style narration in comments.
- Keep diffs focused. Prefer surgical edits (insert_code) over rewriting entire files when possible.

COMMENT RULES:
- Comments must be minimal and only explain non-obvious intent.
- NEVER use decorative banner comments such as "# ============ Test 1: xxx ============" or "# --- Section ---" or block separators made of repeated characters.
- Use simple line comments, one short note per line when needed:
  // brief note
  // another note

EMOJI:
- NEVER use emoji in your responses, in code, or in any generated file content.

SKILLS SYSTEM:
- Koder supports Skills: specialized instruction packs the user activates via slash commands.
- User commands: /skills (list all), /help (command help), /<skill-id> <message> or /skill <skill-id> <message> to run with a skill.
- When a message includes an active Skill, its full instructions are prepended to the user request — follow that skill strictly for the task.
- A catalog of available skill IDs and descriptions is appended to this system prompt at runtime.

Current working directory and environment info will be provided in each conversation.`;

const DEFAULTS: AgentConfig = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  maxTokens: 8192,
  temperature: 0.3,
  maxContextTokens: 200000,
  reasoningEffort: 'medium',
  promptCacheEnabled: true,
  toolCacheEnabled: true,
  toolCacheMaxEntries: 300,
  toolCacheTtlMs: 300000,
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

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.config = { ...DEFAULTS, ...JSON.parse(raw) };
      }
    } catch {
      this.config = { ...DEFAULTS };
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

  update(patch: Partial<AgentConfig>): AgentConfig {
    this.config = { ...this.config, ...patch };
    this.save();
    return this.get();
  }

  isConfigured(): boolean {
    return this.config.apiKey.length > 0 && this.config.baseUrl.length > 0;
  }
}
