# Koder Skills

内置 Skills 随应用打包在 `skills/builtin/`。用户自定义 Skills 放在 `~/.koder/skills/`。

## 目录结构

```
skills/
├── README.md
└── builtin/
    ├── vibe-coding/
    │   └── SKILL.md
    ├── code-review/
    │   └── SKILL.md
    └── ...
```

## SKILL.md 格式

```markdown
---
id: vibe-coding
name: VibeCoding
description: 简短描述，显示在 /skills 列表中
---

# Skill 正文

模型激活该 Skill 时会收到完整正文，请按此执行。
```

## 使用方式

在 Koder 聊天框输入：

- `/skills` — 列出所有 Skills
- `/help` — Slash 命令帮助
- `/vibe-coding 优化这段代码` — 激活 skill 并发送消息
- `/skill code-review 审查 src/main` — 显式指定 skill

输入 `/` 可打开补全菜单。
