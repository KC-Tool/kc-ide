// Agent / Plan 交互模式 — 与 Cursor 对齐的工具与提示词策略

export type InteractionMode = 'agent' | 'plan';

export const INTERACTION_MODES: InteractionMode[] = ['agent', 'plan'];

export const READONLY_TOOL_NAMES = ['read_file', 'list_dir', 'grep', 'glob'] as const;

export const PLAN_TOOL_NAMES = [
  ...READONLY_TOOL_NAMES,
  'todo_add',
  'todo_list',
] as const;

export function nextInteractionMode(current: InteractionMode): InteractionMode {
  const i = INTERACTION_MODES.indexOf(current);
  return INTERACTION_MODES[(i + 1) % INTERACTION_MODES.length];
}

export function getAllowedToolNames(mode: InteractionMode): readonly string[] | null {
  if (mode === 'agent') return null;
  return PLAN_TOOL_NAMES;
}

export function filterToolDefinitions<T extends { function: { name: string } }>(
  tools: T[],
  mode: InteractionMode,
): T[] {
  const allowed = getAllowedToolNames(mode);
  if (!allowed) return tools;
  const set = new Set<string>(allowed);
  return tools.filter((t) => set.has(t.function.name));
}

export const PLAN_MODE_SYSTEM_APPEND = `
PLAN MODE (active — match Cursor Plan behavior):
- Research only: use read_file, grep, glob, list_dir, todo_add, todo_list.
- NEVER write or edit files, NEVER run shell, NEVER delegate sub-agents (no write_file, insert_code, shell, delegate_*, spawn_agent).
- Produce a detailed, reviewable implementation plan in Markdown before any code changes.
- Structure the plan with: ## Overview, ## Approach, ## Implementation steps (numbered, cite file paths), ## Risks / open questions.
- Ask clarifying questions when requirements are ambiguous.
- Use todo_add to list implementation steps the user can execute later in Agent mode.
- The user will review this plan and click Build to execute in Agent mode — make the plan self-contained and actionable.
`.trim();

export const PLAN_BUILD_USER_PREFIX = `Execute the following implementation plan. Follow the steps in order. Use tools as needed.

---

`;
