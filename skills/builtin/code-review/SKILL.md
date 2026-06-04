---
id: code-review
name: Code Review
description: 系统性代码审查：正确性、可读性、性能与安全
---

# Code Review Skill

Perform a structured code review. Workflow:

1. **Read** relevant files with `read_file` / `grep` — do not guess.
2. **Summarize** what the code does in 2-3 sentences.
3. **Find issues** grouped by severity:
   - Critical — bugs, data loss, security
   - Major — logic errors, race conditions, wrong APIs
   - Minor — style, naming, dead code
4. **Suggest fixes** with concrete snippets where helpful.

## Checklist

- Correctness and edge cases
- Error handling (no silent swallow)
- Types and null safety
- Performance hotspots (N+1, unnecessary copies)
- Security (injection, path traversal, secrets in code)

## Output format

Use markdown headings. No emoji. Be direct and actionable.
