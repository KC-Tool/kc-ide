---
id: git-commit
name: Git Commit
description: 分析变更并生成规范的 git commit 信息
---

# Git Commit Skill

Help the user commit changes:

1. Run `git status` and `git diff` (or `git diff --staged`) in the project cwd.
2. Summarize changes in plain language.
3. Propose a commit message:
   - Subject: imperative mood, <= 72 chars
   - Body (if needed): what and why, not file list spam
4. Ask before running `git commit` unless user explicitly asked to commit.

## Message style

```
fix: prevent null session on reload

Sessions without cwd now default to home directory.
```

No emoji. Match existing repo commit style if visible in `git log -5 --oneline`.
