// Koder 国际化 — 中英文文案

import type { Locale } from './ipc';

export type { Locale };

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};

type Messages = Record<string, string>;

const zh: Messages = {
  'app.name': 'Koder',
  'app.subtitle': 'AI 编程助手',

  'sidebar.newChat': '新会话',
  'sidebar.noSessions': '还没有会话',
  'sidebar.group.today': '今天',
  'sidebar.group.yesterday': '昨天',
  'sidebar.group.older': '更早',
  'sidebar.fileBrowser': '文件浏览',
  'sidebar.settings': '设置',
  'sidebar.skillsStore': 'Skills 商店',
  'sidebar.theme.light': '亮',
  'sidebar.theme.dark': '暗',
  'sidebar.env.agent': 'Agent',
  'sidebar.env.electron': 'Electron',
  'sidebar.env.node': 'Node',
  'sidebar.env.notConfigured': '未配置',

  'settings.title': '设置',
  'settings.tab.general': '通用',
  'settings.tab.model': '模型',
  'settings.tab.skills': 'Skills 商店',
  'settings.cancel': '取消',
  'settings.save': '保存',
  'settings.saving': '保存中…',
  'settings.saveModel': '保存配置',

  'settings.general.appearance': '外观',
  'settings.general.language': '界面语言',
  'settings.general.languageDesc': '切换后即时生效，并写入配置文件',
  'settings.general.theme': '主题',
  'settings.general.themeDesc': '选择界面配色方案',
  'settings.general.fontSize': '字体大小',
  'settings.general.fontSizeDesc': '聊天消息的字体大小（像素）',

  'settings.model.api': 'API 连接',
  'settings.model.apiKey': 'API Key',
  'settings.model.apiKeyDesc': 'OpenAI 或兼容服务的 API 密钥',
  'settings.model.baseUrl': 'Base URL',
  'settings.model.baseUrlDesc': 'API 端点（OpenAI 兼容格式）',
  'settings.model.modelId': '模型',
  'settings.model.modelIdDesc': '模型 ID',
  'settings.model.showKey': '显示',
  'settings.model.hideKey': '隐藏',
  'settings.model.generation': '生成参数',
  'settings.model.reasoning': '思考等级',
  'settings.model.reasoningDesc': 'reasoning_effort，需模型/API 支持',
  'settings.model.maxTokens': '最大 Token',
  'settings.model.maxTokensDesc': '单次生成上限',
  'settings.model.temperature': '温度',
  'settings.model.temperatureDesc': '随机性 0–2',
  'settings.model.maxContext': '最大上下文',
  'settings.model.maxContextDesc': '上下文窗口（token）',
  'settings.model.reasoning.off': '关闭',
  'settings.model.cache': '缓存',
  'settings.model.promptCache': 'API Prompt 缓存',
  'settings.model.promptCacheDesc': '提高 provider 端命中率',
  'settings.model.toolCache': '本地工具缓存',
  'settings.model.toolCacheDesc': '缓存 read/grep/glob/list_dir',
  'settings.model.toolCacheMax': '工具缓存上限',
  'settings.model.toolCacheMaxDesc': 'LRU 条目数',
  'settings.model.enabled': '已启用',
  'settings.model.disabled': '已关闭',
  'settings.model.systemPrompt': '系统提示词',

  'skills.title': 'Skills 商店',
  'skills.intro': 'Skills 是专项能力包，在聊天中用 /skills 或 /<id> 激活。',
  'skills.builtin': '内置 Skills',
  'skills.user': '用户 Skills',
  'skills.userPath': '自定义目录：~/.koder/skills/<id>/SKILL.md',
  'skills.reload': '刷新列表',
  'skills.useHint': '在聊天输入',
  'skills.viewDetail': '查看',
  'skills.noUser': '暂无用户 Skills，可从 SkillHub 安装或按路径手动添加。',
  'skills.source.builtin': '内置',
  'skills.source.user': '用户',
  'skills.search.placeholder': '搜索 SkillHub 技能…',
  'skills.search.button': '搜索',
  'skills.install': '安装',
  'skills.installing': '安装中…',
  'skills.installOk': '已安装 /{id}，/ 命令已更新',
  'skills.installFail': '安装失败',
  'skills.remote': 'SkillHub 社区',
  'skills.total': '共 {count} 个技能',
  'skills.pagePrev': '上一页',
  'skills.pageNext': '下一页',
  'skills.openSkillHub': '打开 SkillHub',
  'skills.installFromUrl': '粘贴链接或 slug，如 https://www.skillhub.cn/skills/xxx',
  'skills.alreadyInstalled': '已安装',
  'skills.invalidUrl': '无法识别的 Skill 链接或 slug',

  'chat.empty.title': '开始对话',
  'chat.empty.desc': '输入编程需求，Koder Agent 会读取代码、执行命令、完成任务。',
  'chat.placeholder': '输入需求… 输入 / 查看命令与 Skills（Ctrl/⌘ + Enter 发送）',
  'chat.send': '发送',
  'chat.stop': '停止',
  'chat.hint': 'Ctrl/⌘ + Enter 发送',
  'chat.you': '你',
  'chat.assistant': 'Koder',
  'chat.rollback': '回退',
  'chat.workspace.select': '选择工作区',
  'chat.workspace.pick': '选择工作目录',
  'chat.context.detail': '点击查看详情',
  'chat.context.collapse': '收起详情',
  'chat.context.system': '系统提示词',
  'chat.context.history': '对话历史',
  'chat.context.toolDefs': '工具定义',
  'chat.context.toolResults': '工具结果',
  'chat.context.output': '当前输出',
  'chat.context.apiCache': 'API Prompt 缓存',
  'chat.context.toolCache': '本地工具缓存',
  'chat.context.cacheHit': '命中率',
  'chat.context.hits': '命中',
  'chat.context.misses': '未命中',
  'chat.context.cacheSuffix': '缓存',
  'chat.rollback.title': '确认回退',
  'chat.rollback.body1': '回退操作将：',
  'chat.rollback.li1': '恢复 Agent 修改过的文件',
  'chat.rollback.li2': '删除此轮及之后的消息',
  'chat.rollback.warn': '此操作不可撤销，确定要继续吗？',
  'chat.rollback.ok': '回退成功：恢复 {files} 个文件，删除 {msgs} 条消息',
  'chat.rollback.fail': '回退失败：找不到该会话',
  'chat.copy': '复制',
  'chat.copied': '已复制',
  'chat.thinking': '思考中…',
  'chat.thinkingProcess': '思考过程',
  'chat.thinkingProcessN': '思考过程 {n}',
  'chat.error': '错误',
  'chat.errorUnknown': '未知错误',
  'chat.cancel': '取消',
  'chat.confirmRollback': '确认回退',

  'sidebar.deleteSession': '删除会话',

  'slash.cmd': 'Cmd',
  'slash.skill': 'Skill',
  'slash.skills.desc': '列出所有可用 Skills',
  'slash.help.desc': 'Slash 命令帮助',

  'common.close': '关闭',
};

const en: Messages = {
  'app.name': 'Koder',
  'app.subtitle': 'AI coding assistant',

  'sidebar.newChat': 'New chat',
  'sidebar.noSessions': 'No sessions yet',
  'sidebar.group.today': 'Today',
  'sidebar.group.yesterday': 'Yesterday',
  'sidebar.group.older': 'Older',
  'sidebar.fileBrowser': 'Files',
  'sidebar.settings': 'Settings',
  'sidebar.skillsStore': 'Skills Store',
  'sidebar.theme.light': 'Light',
  'sidebar.theme.dark': 'Dark',
  'sidebar.env.agent': 'Agent',
  'sidebar.env.electron': 'Electron',
  'sidebar.env.node': 'Node',
  'sidebar.env.notConfigured': 'Not configured',

  'settings.title': 'Settings',
  'settings.tab.general': 'General',
  'settings.tab.model': 'Model',
  'settings.tab.skills': 'Skills Store',
  'settings.cancel': 'Cancel',
  'settings.save': 'Save',
  'settings.saving': 'Saving…',
  'settings.saveModel': 'Save config',

  'settings.general.appearance': 'Appearance',
  'settings.general.language': 'Language',
  'settings.general.languageDesc': 'Applies immediately and saves to settings.json',
  'settings.general.theme': 'Theme',
  'settings.general.themeDesc': 'Color scheme',
  'settings.general.fontSize': 'Font size',
  'settings.general.fontSizeDesc': 'Chat font size in pixels',

  'settings.model.api': 'API connection',
  'settings.model.apiKey': 'API Key',
  'settings.model.apiKeyDesc': 'OpenAI or compatible API key',
  'settings.model.baseUrl': 'Base URL',
  'settings.model.baseUrlDesc': 'OpenAI-compatible endpoint',
  'settings.model.modelId': 'Model',
  'settings.model.modelIdDesc': 'Model ID',
  'settings.model.showKey': 'Show',
  'settings.model.hideKey': 'Hide',
  'settings.model.generation': 'Generation',
  'settings.model.reasoning': 'Reasoning effort',
  'settings.model.reasoningDesc': 'reasoning_effort (if supported)',
  'settings.model.maxTokens': 'Max tokens',
  'settings.model.maxTokensDesc': 'Per completion',
  'settings.model.temperature': 'Temperature',
  'settings.model.temperatureDesc': 'Randomness 0–2',
  'settings.model.maxContext': 'Max context',
  'settings.model.maxContextDesc': 'Context window (tokens)',
  'settings.model.reasoning.off': 'Off',
  'settings.model.cache': 'Cache',
  'settings.model.promptCache': 'API prompt cache',
  'settings.model.promptCacheDesc': 'Improves provider cache hit rate',
  'settings.model.toolCache': 'Local tool cache',
  'settings.model.toolCacheDesc': 'Caches read/grep/glob/list_dir',
  'settings.model.toolCacheMax': 'Tool cache size',
  'settings.model.toolCacheMaxDesc': 'LRU max entries',
  'settings.model.enabled': 'On',
  'settings.model.disabled': 'Off',
  'settings.model.systemPrompt': 'System prompt',

  'skills.title': 'Skills Store',
  'skills.intro': 'Skills are instruction packs. Use /skills or /<id> in chat to activate.',
  'skills.builtin': 'Built-in Skills',
  'skills.user': 'User Skills',
  'skills.userPath': 'Custom: ~/.koder/skills/<id>/SKILL.md',
  'skills.reload': 'Refresh',
  'skills.useHint': 'In chat, type',
  'skills.viewDetail': 'Details',
  'skills.noUser': 'No user skills yet. Install from SkillHub or add manually.',
  'skills.source.builtin': 'Built-in',
  'skills.source.user': 'User',
  'skills.search.placeholder': 'Search SkillHub…',
  'skills.search.button': 'Search',
  'skills.install': 'Install',
  'skills.installing': 'Installing…',
  'skills.installOk': 'Installed /{id} — slash commands updated',
  'skills.installFail': 'Install failed',
  'skills.remote': 'SkillHub community',
  'skills.total': '{count} skills',
  'skills.pagePrev': 'Previous',
  'skills.pageNext': 'Next',
  'skills.openSkillHub': 'Open SkillHub',
  'skills.installFromUrl': 'Paste URL or slug, e.g. https://www.skillhub.cn/skills/xxx',
  'skills.alreadyInstalled': 'Installed',
  'skills.invalidUrl': 'Unrecognized skill URL or slug',

  'chat.empty.title': 'Start a conversation',
  'chat.empty.desc': 'Describe your task — Koder will read code, run commands, and help you ship.',
  'chat.placeholder': 'Ask anything… type / for commands (Ctrl/⌘ + Enter to send)',
  'chat.send': 'Send',
  'chat.stop': 'Stop',
  'chat.hint': 'Ctrl/⌘ + Enter to send',
  'chat.you': 'You',
  'chat.assistant': 'Koder',
  'chat.rollback': 'Rollback',
  'chat.workspace.select': 'Select workspace',
  'chat.workspace.pick': 'Choose folder',
  'chat.context.detail': 'Click for details',
  'chat.context.collapse': 'Collapse',
  'chat.context.system': 'System prompt',
  'chat.context.history': 'History',
  'chat.context.toolDefs': 'Tool defs',
  'chat.context.toolResults': 'Tool results',
  'chat.context.output': 'Output',
  'chat.context.apiCache': 'API prompt cache',
  'chat.context.toolCache': 'Local tool cache',
  'chat.context.cacheHit': 'hit rate',
  'chat.context.hits': 'hits',
  'chat.context.misses': 'misses',
  'chat.context.cacheSuffix': 'cache',
  'chat.rollback.title': 'Confirm rollback',
  'chat.rollback.body1': 'This will:',
  'chat.rollback.li1': 'Restore files changed by the agent',
  'chat.rollback.li2': 'Remove this turn and all later messages',
  'chat.rollback.warn': 'This cannot be undone. Continue?',
  'chat.rollback.ok': 'Rolled back: {files} file(s), {msgs} message(s) removed',
  'chat.rollback.fail': 'Rollback failed: session not found',
  'chat.copy': 'Copy',
  'chat.copied': 'Copied',
  'chat.thinking': 'Thinking…',
  'chat.thinkingProcess': 'Thinking',
  'chat.thinkingProcessN': 'Thinking {n}',
  'chat.error': 'Error',
  'chat.errorUnknown': 'Unknown error',
  'chat.cancel': 'Cancel',
  'chat.confirmRollback': 'Confirm rollback',

  'sidebar.deleteSession': 'Delete session',

  'slash.cmd': 'Cmd',
  'slash.skill': 'Skill',
  'slash.skills.desc': 'List all skills',
  'slash.help.desc': 'Slash command help',

  'common.close': 'Close',
};

const catalogs: Record<Locale, Messages> = { zh, en };

export function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const table = catalogs[locale] ?? catalogs.zh;
  let text = table[key] ?? catalogs.zh[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

/** 本地化 Skills 列表消息（/skills 命令） */
export function formatSkillsListLocalized(locale: Locale, skills: Array<{ id: string; description: string; source: string }>): string {
  if (skills.length === 0) {
    return locale === 'en'
      ? 'No skills available. Built-in: `skills/builtin/`'
      : '当前没有可用的 Skills。内置目录：`skills/builtin/`';
  }

  const builtin = skills.filter(s => s.source === 'builtin');
  const user = skills.filter(s => s.source === 'user');

  if (locale === 'en') {
    let md = '## Available Skills\n\n';
    md += '- `/skills` — this list\n';
    md += '- `/<skill-id> <message>` — e.g. `/vibe-coding refactor this`\n';
    md += '- `/skill <skill-id> <message>` — same\n\n';
    if (builtin.length) {
      md += '### Built-in\n\n';
      for (const s of builtin) md += `- **\`/${s.id}\`** — ${s.description}\n`;
      md += '\n';
    }
    if (user.length) {
      md += '### User (~/.koder/skills/)\n\n';
      for (const s of user) md += `- **\`/${s.id}\`** — ${s.description}\n`;
    }
    return md;
  }

  let md = '## 可用 Skills\n\n';
  md += '- `/skills` — 本列表\n';
  md += '- `/<skill-id> 消息` — 如 `/vibe-coding 优化代码`\n';
  md += '- `/skill <skill-id> 消息` — 同上\n\n';
  if (builtin.length) {
    md += '### 内置\n\n';
    for (const s of builtin) md += `- **\`/${s.id}\`** — ${s.description}\n`;
    md += '\n';
  }
  if (user.length) {
    md += '### 用户 (~/.koder/skills/)\n\n';
    for (const s of user) md += `- **\`/${s.id}\`** — ${s.description}\n`;
  }
  return md;
}

export function formatHelpLocalized(locale: Locale): string {
  if (locale === 'en') {
    return `## Slash commands

| Command | Description |
| --- | --- |
| \`/skills\` | List skills |
| \`/help\` | This help |
| \`/<skill-id> <msg>\` | Run with skill |
| \`/skill <id> <msg>\` | Same |`;
  }
  return `## Slash 命令

| 命令 | 说明 |
| --- | --- |
| \`/skills\` | 列出 Skills |
| \`/help\` | 本帮助 |
| \`/<skill-id> 消息\` | 使用 Skill |
| \`/skill <id> 消息\` | 同上 |`;
}
