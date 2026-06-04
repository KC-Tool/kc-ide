# Koder

> 桌面端 AI 编程助手 — **Electron + React + TypeScript**，内置 Agent 引擎与本地工具调用。

Koder 是一个轻量的 Electron 桌面应用：连接 **OpenAI 兼容 API**，在本地以 Agent 模式帮你读代码、写文件、执行命令、搜索代码库。支持流式对话、思考过程展示、文件写入实时预览与 diff 对比、多会话管理与一键回退。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 包管理 | **pnpm** |
| 运行时 | Node.js ≥ 20（推荐 22+） |
| 主进程 | TypeScript + **tsx**（零编译，源码直跑） |
| 预加载 | CJS + `contextBridge` 暴露受限 API |
| 渲染进程 | React 19 + Vite 8 |
| 桌面框架 | Electron 42 |
| 打包 | electron-builder |

## 项目结构

```
koder/
├─ electron-shim.cjs          # Electron 主进程 CJS 启动 shim
├─ electron-builder.cjs       # 打包配置
├─ vite.config.ts             # 渲染进程构建
├─ src/
│  ├─ main/
│  │  ├─ index.ts             # 入口、IPC 注册
│  │  ├─ agent-engine.ts      # Agent 核心（API streaming + tool loop）
│  │  ├─ tools.ts             # 7 个内置工具
│  │  ├─ session-manager.ts   # 会话持久化 + 文件回退
│  │  ├─ config-manager.ts    # ~/.koder/config.json
│  │  └─ settings-manager.ts  # 主题、字号、界面语言
│  ├─ preload/index.cjs       # window.koder API
│  ├─ shared/
│  │  ├─ ipc.ts               # 跨进程类型契约
│  │  ├─ diff.ts              # 行级 diff 算法
│  │  └─ tool-args.ts         # streaming JSON 解析
│  └─ renderer/
│     ├─ App.tsx
│     └─ components/
│        ├─ Chat.tsx           # 聊天、流式渲染、回退
│        ├─ ToolCallCard.tsx   # 工具卡片、实时预览、diff
│        ├─ FileDiffView.tsx   # 代码对比视图
│        ├─ Sidebar.tsx        # 会话列表
│        └─ SettingsHub.tsx    # 统一设置（通用 / 模型 / Skills 商店）
```

## 快速开始

### 1. 前置依赖

- Node.js 20+
- pnpm 9+
- OpenAI 或兼容服务的 **API Key**

### 2. 安装与运行

```bash
pnpm install
pnpm dev
```

开发模式会并行启动 Vite（http://localhost:5173）与 Electron。

### 3. 首次配置

1. 启动后点击侧边栏 **设置** → **模型** 标签
2. 填写 **API Key**、**Base URL**、**模型 ID**
3. 可选调整 **思考等级**（`reasoning_effort`，需模型支持）

Agent 配置保存在 `~/.koder/config.json`；界面偏好（主题、字号、语言）保存在 Electron `userData/settings.json`。

### 4. 类型检查与打包

```bash
pnpm build:check    # TypeScript 检查
pnpm package        # 构建并生成安装包到 release/
pnpm package:dir    # 仅生成解压目录
```

## 功能概览

### 已实现

| 功能 | 说明 |
| --- | --- |
| Agent 对话 | OpenAI 兼容 API，流式输出，最多 20 轮 tool loop |
| 内置工具 | `read_file` / `write_file` / `insert_code` / `list_dir` / `shell` / `grep` / `glob` |
| 思考过程 | 支持 `reasoning_content` / thinking 流式展示，按时间顺序交错渲染 |
| 工具调用 UI | 思考 → 文本 → 工具调用按实际顺序显示，非分组堆叠 |
| 文件写入预览 | `write_file` / `insert_code` streaming 时实时显示写入内容 |
| 代码对比 | 写入完成后自动展示 diff（统一视图 / 分栏视图），含 +/- 行数统计 |
| 行数统计 | 卡片标题与执行结果中显示写入行数、字符数 |
| 多会话 | 侧边栏 CRUD，按今天/昨天/更早分组，持久化到 userData |
| 工作目录 | 每个会话可绑定 CWD，Agent 工具在此目录下执行 |
| 一键回退 | 恢复 Agent 修改过的文件 + 删除后续消息 |
| 上下文占用 | 实时显示 token 占用百分比与分段明细 |
| **双层缓存** | API Prompt 缓存优化 + 本地工具结果 LRU 缓存 |
| **Skills 系统** | 内置 `skills/builtin/`，slash 命令激活，注入 Agent 上下文 |
| **代码高亮** | highlight.js，明暗主题，聊天/工具卡片/思考块 |
| 统一设置中心 | **通用**：主题、字号、中/英界面；**模型**：API、思考等级、缓存、系统提示词（标签切换带动画） |
| Skills 商店 | 独立弹窗：浏览 [SkillHub.cn](https://www.skillhub.cn/skills)、一键安装到 `~/.koder/skills/`，安装后 `/` 命令实时更新 |
| 国际化 | 中文 / English，写入 `settings.json`，切换后即时生效 |

### 内置 Agent 工具

| 工具 | 作用 |
| --- | --- |
| `read_file` | 读取文件（最大 500KB） |
| `write_file` | 写入/覆盖文件，支持 diff 预览 |
| `insert_code` | 锚点插入/替换，比整文件写入更省 token |
| `list_dir` | 列出目录 |
| `shell` | 执行 shell 命令 |
| `grep` | 正则搜索代码 |
| `glob` | glob 匹配找文件 |

### 代码对比（Diff）

文件写入或修改完成后：

- 工具卡片标题显示 **总行数** 及 **+新增 / -删除** 统计
- 默认切换到 **对比** 面板，支持 **统一** / **分栏** 两种视图
- 新文件显示为全量新增（绿色）
- 修改文件对比修改前快照与写入后内容

回退功能会利用写入前快照恢复文件。

### 缓存机制

Koder 采用 **双层缓存** 降低延迟与 API 成本：

#### 1. API Prompt 缓存（提高 provider 命中率）

- **静态前缀分离**：系统提示词与动态 cwd 拆成独立消息，保持前缀稳定
- **cache_control 断点**：对 system 和历史 assistant/tool 消息标记 `ephemeral` 缓存（Anthropic / 部分 OpenAI 兼容）
- **prompt_cache_key**：同模型 + 同 system prompt + 同工作区生成稳定 cache key
- **stream_options.include_usage**：解析 `cached_tokens` 并在 UI 显示命中率

适用：OpenAI GPT-4o+、Anthropic、DeepSeek 等支持 prefix caching 的服务。

#### 2. 本地工具缓存（LRU）

| 可缓存 | 不可缓存 |
| --- | --- |
| `read_file` | `write_file` / `insert_code` |
| `list_dir` | `shell` |
| `grep` / `glob` | |

- 缓存键含文件 **mtime**，内容变化自动失效
- 写入文件 / 执行 shell 后自动失效相关条目
- 可在 **设置 → 模型 → 缓存** 中开关与调整上限

上下文占用条点击展开可查看 **API 缓存命中率** 与 **本地工具缓存命中/未命中** 统计。

### Skills 与 Slash 命令

| 命令 | 说明 |
| --- | --- |
| `/skills` | 列出内置与用户 Skills |
| `/help` | 显示命令帮助 |
| `/<skill-id> <消息>` | 加载 Skill 并发送，如 `/debug 分析这个报错` |
| `/skill <id> <消息>` | 同上 |

内置 Skills（`skills/builtin/`）：`vibe-coding`、`code-review`、`debug`、`refactor`、`git-commit`

用户可在 `~/.koder/skills/<id>/SKILL.md` 添加自定义 Skill，或在 **Skills 商店** 从 SkillHub 安装（调用 `https://api.skillhub.cn` 下载 zip 包）。格式见 [skills/README.md](skills/README.md)。

## 使用说明

1. 选择或新建会话，设置 **工作目录**（Agent 的操作根路径）
2. 在输入框描述需求，`Ctrl/⌘ + Enter` 发送
3. 观察流式输出：思考块 → 模型回复 → 工具卡片（写入时可实时看内容）
4. 写入完成后查看 diff 与行数统计
5. 不满意可点消息下方 **回退**，恢复文件并撤销该轮对话
6. 运行中可点 **停止** 中断 Agent

## 关键设计

### IPC 契约

所有跨进程类型集中在 `src/shared/ipc.ts`。渲染进程通过 `window.koder.*` 调用（preload 注入）。

主要通道：`config:*`、`agent:run/cancel`、`session:*`、`settings:*`、`fs:*`

### Agent 引擎

- 调用 `/chat/completions`（streaming + tools）
- 解析 `text_delta`、`thinking_delta`、`tool_call_delta`
- 本地执行工具，结果回填后继续多轮对话
- 写入文件前捕获快照，供 diff 与回退使用

### 持久化

| 文件 | 位置 | 内容 |
| --- | --- | --- |
| `config.json` | `~/.koder/` | API 配置、系统提示词 |
| `sessions.json` | Electron userData | 会话、消息、segments、文件快照 |
| `settings.json` | Electron userData | 主题、字号、`locale`（`zh` / `en`） |

### tsx 零编译

`electron-shim.cjs` → `require('tsx/cjs')` → `src/main/index.ts`，开发时改 TS 即生效。

## 路线图

- [x] 多会话管理
- [x] 内置 diff 预览（写入后对比 + 行数统计）
- [x] 流式思考 / 工具调用按序渲染
- [x] 文件写入实时预览
- [x] 思考等级配置（reasoning_effort）
- [x] 双层缓存（API Prompt + 本地工具 LRU）
- [x] 内置 Skills + Slash 命令（/skills、/skill-id）
- [x] 代码语法高亮（多语言 + 明暗主题）
- [ ] MCP 工具面板
- [ ] 写入前确认（apply diff 前人工审核）
- [x] 国际化（中/英切换，设置中心保存）
- [x] 统一设置入口（通用 + 模型分栏）
- [x] Skills 商店 UI
- [ ] 自动更新（electron-updater）
- [ ] 生产打包完善（主进程资源纳入 asar）

## 许可

MIT
