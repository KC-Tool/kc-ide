# KC-IDE

> 桌面端 AI 编程助手 — **Electron + React + TypeScript**，内置 Agent 引擎与本地工具调用。

KC-IDE 是一个轻量的 Electron 桌面应用：连接 **OpenAI 兼容 API**，在本地以 Agent
模式帮你读代码、写文件、执行命令、搜索代码库。支持流式对话、思考过程展示、文件写入实时预览与 diff 对比、多会话管理与一键回退。

## 技术栈

| 层    | 技术                             |
|------|--------------------------------|
| 包管理  | **pnpm**                       |
| 运行时  | Node.js >= 20（推荐 22+）          |
| 主进程  | TypeScript + **tsx**（零编译，源码直跑） |
| 预加载  | CJS + `contextBridge` 暴露受限 API |
| 渲染进程 | React 19 + Vite 8              |
| 桌面框架 | Electron 42                    |
| 打包   | electron-builder               |

## 快速开始

### 前置依赖

- Node.js 20+
- pnpm 9+
- OpenAI 或兼容服务的 **API Key**

### 安装与运行

```bash
pnpm install
pnpm dev
```

开发模式会并行启动 Vite（http://localhost:5173）与 Electron。

### 首次配置

1. 启动后点击侧边栏 **设置** -> **模型** 标签
2. 填写 **API Key**、**Base URL**、**模型 ID**
3. 可选调整 **思考等级**（`reasoning_effort`，需模型支持）

Agent 配置保存在 `~/.koder/config.json`；界面偏好（主题、字号、语言）保存在 Electron `userData/settings.json`。

### 类型检查与打包

```bash
pnpm build:check    # TypeScript 检查
pnpm package        # 构建并生成安装包到 release/
pnpm package:dir    # 仅生成解压目录
```

## 功能概览

### 已实现

| 功能        | 说明                                                                                  |
|-----------|-------------------------------------------------------------------------------------|
| Agent 对话  | OpenAI 兼容 API，流式输出，最多 50 轮 tool loop                                                |
| 内置工具      | `read_file` / `write_file` / `insert_code` / `list_dir` / `shell` / `grep` / `glob` |
| 思考过程      | 支持 `reasoning_content` / thinking 流式展示                                              |
| 文件写入预览    | `write_file` / `insert_code` streaming 时实时显示写入内容                                    |
| 代码对比      | 写入完成后自动展示 diff（统一视图 / 分栏视图），含 +/- 行数统计                                              |
| 多会话       | 侧边栏 CRUD，按工作区分组，持久化到 userData                                                       |
| 工作目录      | 每个会话可绑定 CWD，Agent 工具在此目录下执行                                                         |
| 一键回退      | 恢复 Agent 修改过的文件 + 删除后续消息                                                            |
| 上下文占用     | 实时显示 token 占用百分比与分段明细                                                               |
| 双层缓存      | API Prompt 缓存优化 + 本地工具结果 LRU 缓存                                                     |
| Skills 系统 | 内置 `skills/builtin/`，slash 命令激活，注入 Agent 上下文                                        |
| 代码高亮      | highlight.js，明暗主题，聊天/工具卡片/思考块                                                       |
| 统一设置中心    | 通用：主题、字号、中/英界面；模型：API、思考等级、缓存、系统提示词                                                 |
| Skills 商店 | 浏览 SkillHub、一键安装到 `~/.koder/skills/`                                                |
| 国际化       | 中文 / English，写入 `settings.json`，切换后即时生效                                             |

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

### Skills 与 Slash 命令

| 命令                 | 说明             |
|--------------------|----------------|
| `/skills`          | 列出内置与用户 Skills |
| `/help`            | 显示命令帮助         |
| `/<skill-id> <消息>` | 加载 Skill 并发送   |

内置 Skills（`skills/builtin/`）：`vibe-coding`、`code-review`、`debug`、`refactor`、`git-commit`

## 项目结构

```
koder/
├── electron-shim.cjs          # Electron 主进程 CJS 启动 shim
├── electron-builder.cjs       # 打包配置
├── vite.config.ts             # 渲染进程构建
├── src/
│   ├── main/
│   │   ├── index.ts           # 入口、IPC 注册
│   │   ├── agent-engine.ts    # Agent 核心（API streaming + tool loop）
│   │   ├── tools.ts           # 内置工具
│   │   ├── session-manager.ts # 会话持久化 + 文件回退
│   │   ├── config-manager.ts  # ~/.koder/config.json
│   │   └── settings-manager.ts
│   ├── preload/index.cjs      # window.koder API
│   ├── shared/
│   │   ├── ipc.ts             # 跨进程类型契约
│   │   ├── diff.ts            # 行级 diff 算法
│   │   └── tool-args.ts       # streaming JSON 解析
│   └── renderer/
│       ├── App.tsx
│       └── components/
│           ├── Chat.tsx           # 聊天、流式渲染、回退
│           ├── ToolCallCard.tsx   # 工具卡片、实时预览、diff
│           ├── Sidebar.tsx        # 会话列表
│           └── SettingsHub.tsx    # 统一设置
```

## 使用说明

1. 选择或新建会话，设置 **工作目录**
2. 在输入框描述需求，`Ctrl/Enter` 发送
3. 观察流式输出：思考块 -> 模型回复 -> 工具卡片
4. 写入完成后查看 diff 与行数统计
5. 不满意可点消息下方 **回退**，恢复文件并撤销该轮对话

## 许可

[MIT](LICENSE)
