---
id: debug
name: Debug
description: 系统化排查 bug：复现、定位根因、最小修复
---

# Debug Skill

Debug systematically:

1. **Clarify** the symptom from the user's message.
2. **Reproduce** — run tests, grep for errors, read logs with `shell` if needed.
3. **Isolate** — narrow to file/line; read only what's needed.
4. **Root cause** — explain why it fails, not just what fails.
5. **Fix** — minimal change; verify with a command or test if possible.

## Rules

- Do not change unrelated code.
- Prefer fixing root cause over masking symptoms.
- If uncertain, state hypotheses and what evidence would confirm them.

No emoji. Show commands you ran and their relevant output.
