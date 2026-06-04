// 会话待办（Todo）— 与 Session.todos 同步

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  completedAt?: number;
}

export function formatTodosForAgent(todos: TodoItem[]): string {
  if (todos.length === 0) return 'No todos yet.';
  return todos
    .map(t => `- [${t.done ? 'x' : ' '}] ${t.id}: ${t.text}`)
    .join('\n');
}
