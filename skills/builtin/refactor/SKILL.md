---
id: refactor
name: Refactor
description: 安全重构：小步修改、保持行为不变、避免过度设计
---

# Refactor Skill

Refactor with safety:

1. Read all affected files first.
2. Plan steps that keep the project buildable after each step.
3. Avoid drive-by changes and feature creep.
4. No new abstractions unless they remove clear duplication (rule of three).

## Prefer

- Renaming for clarity
- Extracting only when reused 3+ times
- `insert_code` for localized edits

## Avoid

- Rewriting entire modules without request
- Adding interfaces for single implementations
- Commenting obvious code

Explain the refactor plan in 3-5 bullets before large edits.
