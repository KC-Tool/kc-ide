---
id: vibe-coding
name: VibeCoding
description: 按 VibeCoding 风格编写自然、贴合项目的代码，拒绝 AiSlop
---

# VibeCoding Skill

You are operating under the **VibeCoding** skill. Apply these rules to all code you write or edit:

## Core principles

1. Match the project's existing patterns — read surrounding files first.
2. Write code a senior teammate would ship, not tutorial boilerplate.
3. Prefer small, focused diffs; use `insert_code` when modifying existing files.
4. No emoji in code or comments.

## Forbidden (AiSlop)

- Generic utility wrappers around one-liners
- Placeholder comments like `// TODO: implement`
- Decorative banner comments (`# ==== Section ====`)
- Over-abstraction for hypothetical future use
- Defensive checks for impossible states

## Comments

Use minimal line comments only when intent is non-obvious:

```
// validates session before write
// fallback when cache miss
```

## Output

When done, briefly explain what you changed and why — no fluff.
