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
  'settings.tab.teams': 'Agent Team',
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
  'settings.general.dynamicBlur': '动态模糊',
  'settings.general.dynamicBlurDesc': '背景光斑流动与模糊强度，写入 settings.json',
  'settings.general.dynamicBlur.off': '关闭',
  'settings.general.dynamicBlur.low': '低',
  'settings.general.dynamicBlur.medium': '中',
  'settings.general.dynamicBlur.high': '高',
  'settings.general.dynamicBlur.ultra': '极高',
  'settings.general.liquidGlass': '液态玻璃',
  'settings.general.liquidGlassDesc': '侧边栏、顶栏与输入区毛玻璃效果',
  'settings.general.frameRate': '应用帧率',
  'settings.general.frameRateDesc': '目标 FPS，写入 ~/.koder/config.json，影响窗口刷新与背景动画',

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
  'settings.model.systemPromptBuiltin': '使用应用内置默认（随版本自动更新）',
  'settings.model.systemPromptCustom': '已自定义；应用升级不会自动覆盖',
  'settings.model.systemPromptReset': '恢复为内置默认',

  'skills.title': 'Skills 商店',
  'skills.intro': 'Skills 是专项能力包，在聊天中用 /skills 或 /<id> 激活。',
  'skills.builtin': '内置 Skills',
  'skills.user': '用户 Skills',
  'skills.userPath': '所有技能统一目录：~/.koder/skills/<id>/（内置首次启动会复制到此）',
  'skills.reload': '刷新列表',
  'skills.useHint': '在聊天输入',
  'skills.viewDetail': '查看',
  'skills.noUser': '暂无用户 Skills，可从 SkillHub 安装或按路径手动添加。',
  'skills.source.builtin': '内置',
  'skills.source.user': '用户',
  'skills.source.skillhub': 'SkillHub',
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
  'chat.hint': 'Ctrl/⌘ + Enter 发送 · / 与 @ 打开命令菜单',
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

  'tool.output.write': '写入结果',
  'tool.output.exec': '命令输出',
  'tool.output.result': '工具返回',
  'tool.input.raw': '原始输入',

  'agent.newChat': '新对话',
  'agent.running': '运行中',
  'agent.mode.agent': 'Agent',
  'agent.mode.plan': 'Plan',
  'agent.mode.ask': 'Ask',
  'agent.mode.label': '交互模式',
  'agent.mode.agentHint': '自动读写代码、执行命令',
  'agent.mode.planHint': '先调研再输出可审阅的实施计划，不直接改代码',
  'agent.mode.askHint': '只读问答，不修改文件',
  'agent.modelNotConfigured': '未配置模型',
  'agent.planning': 'Planning next moves…',
  'agent.thought': 'Thought',
  'agent.thoughtFor': 'Thought for {s}s',
  'agent.scrollBottom': '回到底部',
  'agent.placeholder': 'Plan, @ for context, / for commands…',
  'agent.placeholderAsk': 'Ask a question about your codebase…',
  'agent.placeholderPlan': 'Describe a feature or task to plan before building…',
  'agent.workspace': '工作区',
  'agent.askHint': 'Ask：只读，不会修改文件',
  'agent.planHint': 'Plan：仅调研与规划，点击 Build 后再执行',
  'agent.plan.ready': '计划已就绪，审阅后点击 Build 执行',
  'agent.plan.build': 'Build',
  'agent.plan.dismiss': '关闭',
  'agent.plan.buildUser': '▶ 执行计划',
  'agent.plan.modalTitle': '实施计划',
  'agent.plan.savedTo': '已保存至',
  'agent.plan.view': '查看计划',
  'agent.context.empty': '发送消息后显示上下文占用',

  'sidebar.deleteSession': '删除会话',
  'sidebar.repositories': '工作区',
  'sidebar.addWorkspace': '添加工作区',
  'sidebar.workspaceNone': '未绑定工作区',
  'sidebar.newSessionInRepo': '新建会话',
  'sidebar.expandRepo': '展开',
  'sidebar.collapseRepo': '收起',

  'skills.delete': '删除',
  'skills.deleteConfirm': '确定删除 /{id} ？此操作不可恢复。',
  'skills.deleteBuiltin': '内置 Skill 不可删除',
  'teams.title': 'Agent Team（子代理组）',
  'teams.intro': '多角色协作：主代理（LEAD）通过 delegate_agent 启动真实子 Agent（独立 API 会话）。在聊天输入 @team <id> 激活，或在下方设置默认 Team。',
  'teams.storagePath': '存储：~/.koder/team/<id>.team.md（格式 koder-team v1）',
  'teams.defaultTeam': '默认 Team',
  'teams.defaultTeamDesc': '新会话未指定时自动注入',
  'teams.none': '无',
  'teams.create': '新建 Team',
  'teams.edit': '编辑',
  'teams.delete': '删除',
  'teams.reload': '刷新',
  'teams.saveTeam': '保存 Team',
  'teams.saved': '已保存',
  'teams.saveFail': '保存失败',
  'teams.deleted': '已删除',
  'teams.deleteFail': '删除失败',
  'teams.invalidId': '请填写有效的 Team ID（小写字母、数字、连字符）',
  'teams.empty': '暂无 Team，可新建或使用 @create-team',
  'teams.formatHint': '保存为 Koder 专用 .team.md，勿与 SKILL.md 混用。',
  'teams.field.id': 'ID',
  'teams.field.name': '名称',
  'teams.field.description': '描述',
  'teams.field.orchestration': '编排说明',
  'teams.field.role': '角色',
  'teams.field.prompt': '子代理提示词',
  'teams.members': '成员',
  'teams.member': '成员',
  'teams.addMember': '添加成员',
  'teams.removeMember': '移除',
  'teams.membersCount': '名成员',
  'skills.deleted': '已删除 /{id}',

  'temporal.title': '时间锚点说明',
  'temporal.lead': '为防止部分模型因错误的“当前日期”认知而表现异常（俗称降智），Koder 已在运行时强制锁定系统时间为：',
  'temporal.li1': '该日期由程序注入每条对话与工具上下文，不依赖你手动修改系统提示词。',
  'temporal.li2': '模型应始终以 2026 年 4 月 1 日为“今天”进行推理。',
  'temporal.li3': '若 shell 输出显示其他日期，请以时间锚点为准。',
  'temporal.foot': '这是 Koder 的防护机制，有助于在长时间编码任务中保持稳定的时序判断。',
  'temporal.dontShowAgain': '不再显示此说明',
  'temporal.understand': '我知道了',

  'slash.cmd': 'Cmd',
  'slash.skill': 'Skill',
  'slash.skills.desc': '列出所有可用 Skills',
  'slash.help.desc': 'Slash 命令帮助',

  'at.teams.desc': '列出 Agent Team',
  'at.help.desc': '@ 命令帮助',
  'at.createTeam.desc': '让模型创建 Team 文件',
  'at.team': 'Team',

  'todo.title': '待办',
  'todo.agentOnly': '仅 Agent 可通过 todo_complete 勾选，用户不可手动勾选',

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
  'settings.tab.teams': 'Agent Team',
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
  'settings.general.dynamicBlur': 'Dynamic blur',
  'settings.general.dynamicBlurDesc': 'Animated background blur intensity; saved to settings.json',
  'settings.general.dynamicBlur.off': 'Off',
  'settings.general.dynamicBlur.low': 'Low',
  'settings.general.dynamicBlur.medium': 'Medium',
  'settings.general.dynamicBlur.high': 'High',
  'settings.general.dynamicBlur.ultra': 'Ultra',
  'settings.general.liquidGlass': 'Liquid glass',
  'settings.general.liquidGlassDesc': 'Frosted glass on sidebar, header, and composer',
  'settings.general.frameRate': 'App frame rate',
  'settings.general.frameRateDesc': 'Target FPS (saved to ~/.koder/config.json); affects window refresh and animations',

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
  'settings.model.systemPromptBuiltin': 'Using built-in default (auto-updates with app unless customized)',
  'settings.model.systemPromptCustom': 'Customized; app upgrades will not overwrite',
  'settings.model.systemPromptReset': 'Reset to built-in default',

  'skills.title': 'Skills Store',
  'skills.intro': 'Skills are instruction packs. Use /skills or /<id> in chat to activate.',
  'skills.builtin': 'Built-in Skills',
  'skills.user': 'User Skills',
  'skills.userPath': 'All skills live in ~/.koder/skills/<id>/ (built-ins copied on first launch)',
  'skills.reload': 'Refresh',
  'skills.useHint': 'In chat, type',
  'skills.viewDetail': 'Details',
  'skills.noUser': 'No user skills yet. Install from SkillHub or add manually.',
  'skills.source.builtin': 'Built-in',
  'skills.source.user': 'User',
  'skills.source.skillhub': 'SkillHub',
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
  'chat.hint': 'Ctrl/⌘ + Enter to send · type / or @ for commands',
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

  'tool.output.write': 'Write result',
  'tool.output.exec': 'Command output',
  'tool.output.result': 'Tool output',
  'tool.input.raw': 'Raw input',

  'agent.newChat': 'New Agent',
  'agent.running': 'Running',
  'agent.mode.agent': 'Agent',
  'agent.mode.plan': 'Plan',
  'agent.mode.ask': 'Ask',
  'agent.mode.label': 'Interaction mode',
  'agent.mode.agentHint': 'Read, write, and run commands autonomously',
  'agent.mode.planHint': 'Research and produce a reviewable plan — no file edits until Build',
  'agent.mode.askHint': 'Read-only Q&A, no file changes',
  'agent.modelNotConfigured': 'Model not configured',
  'agent.planning': 'Planning next moves…',
  'agent.thought': 'Thought',
  'agent.thoughtFor': 'Thought for {s}s',
  'agent.scrollBottom': 'Scroll to bottom',
  'agent.placeholder': 'Plan, @ for context, / for commands…',
  'agent.placeholderAsk': 'Ask a question about your codebase…',
  'agent.placeholderPlan': 'Describe a feature or task to plan before building…',
  'agent.workspace': 'Workspace',
  'agent.askHint': 'Ask: read-only, no edits',
  'agent.planHint': 'Plan: research only — click Build to execute',
  'agent.plan.ready': 'Plan ready — review and click Build to execute',
  'agent.plan.build': 'Build',
  'agent.plan.dismiss': 'Dismiss',
  'agent.plan.buildUser': '▶ Build plan',
  'agent.plan.modalTitle': 'Implementation plan',
  'agent.plan.savedTo': 'Saved to',
  'agent.plan.view': 'View plan',
  'agent.context.empty': 'Context usage appears after you send a message',

  'sidebar.deleteSession': 'Delete session',
  'sidebar.repositories': 'Repositories',
  'sidebar.addWorkspace': 'Add workspace',
  'sidebar.workspaceNone': 'Unassigned',
  'sidebar.newSessionInRepo': 'New chat',
  'sidebar.expandRepo': 'Expand',
  'sidebar.collapseRepo': 'Collapse',

  'skills.delete': 'Delete',
  'skills.deleteConfirm': 'Delete /{id}? This cannot be undone.',
  'skills.deleteBuiltin': 'Built-in skills cannot be deleted',
  'teams.title': 'Agent Teams',
  'teams.intro': 'Multi-agent: the LEAD spawns real sub-agents (separate API sessions) via delegate_agent. Activate with @team <id> in chat or set a default team below.',
  'teams.storagePath': 'Storage: ~/.koder/team/<id>.team.md (koder-team v1)',
  'teams.defaultTeam': 'Default team',
  'teams.defaultTeamDesc': 'Injected for new sessions when none is selected',
  'teams.none': 'None',
  'teams.create': 'New team',
  'teams.edit': 'Edit',
  'teams.delete': 'Delete',
  'teams.reload': 'Reload',
  'teams.saveTeam': 'Save team',
  'teams.saved': 'Saved',
  'teams.saveFail': 'Save failed',
  'teams.deleted': 'Deleted',
  'teams.deleteFail': 'Delete failed',
  'teams.invalidId': 'Enter a valid team ID (lowercase letters, digits, hyphens)',
  'teams.empty': 'No teams yet. Create one or use @create-team',
  'teams.formatHint': 'Saved as Koder .team.md — not SKILL.md.',
  'teams.field.id': 'ID',
  'teams.field.name': 'Name',
  'teams.field.description': 'Description',
  'teams.field.orchestration': 'Orchestration',
  'teams.field.role': 'Role',
  'teams.field.prompt': 'Sub-agent prompt',
  'teams.members': 'Members',
  'teams.member': 'Member',
  'teams.addMember': 'Add member',
  'teams.removeMember': 'Remove',
  'teams.membersCount': 'members',
  'skills.deleted': 'Deleted /{id}',

  'temporal.title': 'Temporal anchor',
  'temporal.lead': 'To reduce degraded reasoning from wrong “current date” assumptions, Koder locks runtime time to:',
  'temporal.li1': 'This date is injected into every turn and tool context automatically—not via your editable system prompt.',
  'temporal.li2': 'The model must treat April 1, 2026 as authoritative “today”.',
  'temporal.li3': 'If shell output shows another date, prefer the anchor.',
  'temporal.foot': 'This is a protective mechanism for long coding sessions.',
  'temporal.dontShowAgain': "Don't show again",
  'temporal.understand': 'Got it',

  'slash.cmd': 'Cmd',
  'slash.skill': 'Skill',
  'slash.skills.desc': 'List all skills',
  'slash.help.desc': 'Slash command help',

  'at.teams.desc': 'List agent teams',
  'at.help.desc': '@ command help',
  'at.createTeam.desc': 'Model creates a team file',
  'at.team': 'Team',

  'todo.title': 'Todos',
  'todo.agentOnly': 'Only the agent can check items via todo_complete — not editable here',

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
  const at = formatAtHelpLocalized(locale);
  if (locale === 'en') {
    return `## Slash commands

| Command | Description |
| --- | --- |
| \`/skills\` | List skills |
| \`/help\` | This help |
| \`/<skill-id> <msg>\` | Run with skill |
| \`/skill <id> <msg>\` | Same |

${at}`;
  }
  return `## Slash 命令

| 命令 | 说明 |
| --- | --- |
| \`/skills\` | 列出 Skills |
| \`/help\` | 本帮助 |
| \`/<skill-id> 消息\` | 使用 Skill |
| \`/skill <id> 消息\` | 同上 |

${at}`;
}

export function formatTeamsListLocalized(locale: Locale, teams: import('./team-types.js').TeamListItem[]): string {
  if (teams.length === 0) {
    return locale === 'en'
      ? 'No Agent Teams. Create one under **Settings → Agent Team**, or use `@create-team`.'
      : '暂无 Agent Team。在 **设置 → Agent Team** 中创建，或使用 `@create-team`。';
  }
  const rows = teams.map(
    t => `- **${t.id}** — ${t.name} (${t.memberCount}, ${t.source})${t.description ? `: ${t.description}` : ''}`,
  );
  const footer = locale === 'en'
    ? '\n\nActivate: `@team <id>` or `@<id>`'
    : '\n\n激活：\`@team <id>\` 或 \`@<id>\`';
  return (locale === 'en' ? '## Agent Teams\n\n' : '## Agent Teams\n\n') + rows.join('\n') + footer;
}

export function formatAtHelpLocalized(locale: Locale): string {
  if (locale === 'en') {
    return `## @ commands (Agent Team)

| Command | Description |
| --- | --- |
| \`@teams\` | List teams |
| \`@team <id>\` | Activate team for session |
| \`@<id>\` | Same shorthand |
| \`@create-team <desc>\` | Model writes ~/.koder/team/<id>.team.md |
| \`@help\` | This help |`;
  }
  return `## @ 命令（Agent Team）

| 命令 | 说明 |
| --- | --- |
| \`@teams\` | 列出 Team |
| \`@team <id>\` | 为当前会话激活 |
| \`@<id>\` | 简写 |
| \`@create-team <描述>\` | 模型写入 ~/.koder/team/<id>.team.md |
| \`@help\` | 本帮助 |`;
}
