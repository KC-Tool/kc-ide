# Koder

本地 AI 编程助手。Electron 桌面端，连接 OpenAI 兼容 API，Agent 模式自动读代码、写文件、执行命令。

## 跑起来

```bash
pnpm install
pnpm dev
```

Vite 在 `localhost:5173`，Electron 自动连接。首次启动去 **设置 → 模型** 填 API Key、Base URL、模型 ID。

配置存两处：Agent 参数在 `~/.koder/config.json`，界面偏好在 Electron `userData/settings.json`。

## 它能干什么

<table>
<thead>
<tr><th>功能</th><th>描述</th></tr>
</thead>
<tbody>
<tr><td><strong>流式对话</strong></td><td>SSE 输出，思考过程实时展示，最多 50 轮 tool loop</td></tr>
<tr><td><strong>12 个内置工具</strong></td><td>文件读写、目录浏览、shell、grep、glob、web 搜索/抓取、待办管理</td></tr>
<tr><td><code>insert_code</code></td><td>锚点定位精准插入/替换，比整文件写入省 token</td></tr>
<tr><td><strong>文件快照与回退</strong></td><td>Agent 改了文件？一键恢复，消息也撤销</td></tr>
<tr><td><strong>实时 diff</strong></td><td>写入时展示变更预览，完成后支持统一/分栏对比</td></tr>
<tr><td><strong>上下文监控</strong></td><td>token 占用百分比 + 分段明细 + 缓存命中率</td></tr>
<tr><td><strong>双层缓存</strong></td><td>API Prompt 缓存 + 本地工具结果 LRU</td></tr>
<tr><td><strong>多会话</strong></td><td>按工作区分组，侧边栏管理</td></tr>
<tr><td><strong>Skills 系统</strong></td><td>内置 5 个 Skill，支持商店安装自定义</td></tr>
<tr><td><strong>Agent Teams</strong></td><td>多 Agent 协作，委派任务并行执行</td></tr>
<tr><td><strong>Plan 模式</strong></td><td>先规划再执行，适合复杂任务</td></tr>
<tr><td><strong>国际化</strong></td><td>中文/English 切换即时生效</td></tr>
</tbody>
</table>

## 内置工具

<table>
<thead>
<tr><th>工具</th><th>用途</th></tr>
</thead>
<tbody>
<tr><td><code>read_file</code></td><td>读文件，上限 500KB</td></tr>
<tr><td><code>write_file</code></td><td>写入/覆盖，自动创建父目录</td></tr>
<tr><td><code>insert_code</code></td><td>锚点插入/替换（<code>insert_before</code>、<code>insert_after</code>、<code>replace</code>）</td></tr>
<tr><td><code>list_dir</code></td><td>列目录，过滤隐藏文件</td></tr>
<tr><td><code>shell</code></td><td>执行命令，白名单安全检查</td></tr>
<tr><td><code>grep</code></td><td>正则搜索，支持文件过滤</td></tr>
<tr><td><code>glob</code></td><td>glob 匹配找文件</td></tr>
<tr><td><code>web_search</code></td><td>DuckDuckGo 搜索</td></tr>
<tr><td><code>web_fetch</code></td><td>抓取网页正文</td></tr>
<tr><td><code>todo_add</code></td><td>添加待办</td></tr>
<tr><td><code>todo_complete</code></td><td>完成待办</td></tr>
<tr><td><code>todo_list</code></td><td>列出待办</td></tr>
</tbody>
</table>

## Slash 命令

<table>
<thead>
<tr><th>命令</th><th>作用</th></tr>
</thead>
<tbody>
<tr><td><code>/skills</code></td><td>列出可用 Skill</td></tr>
<tr><td><code>/help</code></td><td>显示帮助</td></tr>
<tr><td><code>/&lt;skill-id&gt; &lt;消息&gt;</code></td><td>激活 Skill 并发送</td></tr>
</tbody>
</table>

<blockquote>
内置 Skill：<code>vibe-coding</code>、<code>code-review</code>、<code>debug</code>、<code>refactor</code>、<code>git-commit</code>
</blockquote>

## 打包

```bash
pnpm build:check    # 类型检查
pnpm package        # 构建 + 生成安装包到 release/
pnpm package:dir    # 仅解压目录
```

## 项目结构

<pre><code>koder/
├── electron-shim.cjs              # 主进程 CJS 启动
├── electron-builder.cjs           # 打包配置
├── vite.config.ts                 # 渲染进程构建
├── skills/builtin/                # 内置 Skill
└── src/
    ├── main/
    │   ├── index.ts               # IPC 注册、窗口创建
    │   ├── agent-engine.ts        # API streaming + tool loop
    │   ├── tools.ts               # 工具定义与执行器
    │   ├── session-manager.ts     # 会话持久化 + 文件回退
    │   ├── config-manager.ts      # ~/.koder/config.json
    │   ├── settings-manager.ts    # 界面设置
    │   ├── skills-manager.ts      # Skill 加载与注入
    │   ├── team-manager.ts        # Agent Teams
    │   ├── plan-manager.ts        # Plan 保存
    │   ├── tool-cache.ts          # 工具结果 LRU 缓存
    │   ├── prompt-cache.ts        # API Prompt 缓存优化
    │   └── enhancement/           # 上下文增强
    ├── preload/index.cjs          # contextBridge 暴露 API
    ├── shared/
    │   ├── ipc.ts                 # 跨进程类型契约
    │   ├── agent-modes.ts         # 交互模式（agent/plan）
    │   ├── skills-types.ts        # Skill 类型
    │   ├── team-types.ts          # Team 类型
    │   └── todo-types.ts          # Todo 类型
    └── renderer/
        ├── App.tsx                # 根组件
        ├── contexts/              # Theme、I18n
        ├── components/
        │   ├── Chat.tsx           # 聊天主界面
        │   ├── ChatComposer.tsx   # 输入框 + slash 命令
        │   ├── ChatMessageList.tsx
        │   ├── ChatHeader.tsx
        │   ├── Sidebar.tsx        # 会话列表
        │   ├── SettingsHub.tsx    # 统一设置
        │   ├── ToolCallCard.tsx   # 工具调用卡片 + diff
        │   ├── ThinkingBlock.tsx  # 思考过程
        │   ├── CodeBlock.tsx      # 代码高亮
        │   ├── FileDiffView.tsx   # diff 视图
        │   ├── SkillsStore.tsx    # Skill 商店
        │   ├── TeamsSettingsPanel.tsx
        │   ├── TodoPanel.tsx      # 待办面板
        │   ├── PlanPanel.tsx      # Plan 面板
        │   └── SubAgentPanel.tsx  # 子 Agent 面板
        └── lib/                   # 工具函数</code></pre>

## 技术选型

<table>
<thead>
<tr><th>层</th><th>选择</th><th>原因</th></tr>
</thead>
<tbody>
<tr><td>包管理</td><td><strong>pnpm</strong></td><td>硬链接节省磁盘，workspace 支持</td></tr>
<tr><td>运行时</td><td><strong>Node.js 20+</strong></td><td>原生 fetch、ESM 支持</td></tr>
<tr><td>主进程</td><td><strong>tsx 直跑</strong></td><td>省掉编译步骤，开发体验好</td></tr>
<tr><td>预加载</td><td><strong>CJS + contextBridge</strong></td><td>Electron 安全模型要求</td></tr>
<tr><td>渲染</td><td><strong>React 19 + Vite 8</strong></td><td>HMR 快，React Server Components 就绪</td></tr>
<tr><td>打包</td><td><strong>electron-builder</strong></td><td>成熟稳定，多平台支持</td></tr>
</tbody>
</table>

## License

[MIT](LICENSE)
