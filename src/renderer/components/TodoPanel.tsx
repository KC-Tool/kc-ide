import { useCallback } from 'react';
import type { TodoItem } from '../../shared/ipc';
import { useI18n } from '../contexts/I18nContext';

interface Props {
  todos: TodoItem[];
  sessionId: string | null;
  onToggle: (todoId: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function TodoPanel({ todos, sessionId, onToggle, collapsed, onToggleCollapse }: Props) {
  const { t } = useI18n();
  const pending = todos.filter(t => !t.done);
  const done = todos.filter(t => t.done);

  const handleToggle = useCallback((id: string) => {
    if (!sessionId) return;
    onToggle(id);
  }, [sessionId, onToggle]);

  if (todos.length === 0) return null;

  return (
    <div className="todo-panel">
      <button type="button" className="todo-panel-header" onClick={onToggleCollapse}>
        <span className="todo-panel-title">
          {t('todo.title')}
          {pending.length > 0 && <span className="todo-panel-count">{pending.length}</span>}
        </span>
        <span className={`todo-panel-chevron ${collapsed ? '' : 'open'}`} aria-hidden>›</span>
      </button>
      {!collapsed && (
        <ul className="todo-list">
          {pending.map(item => (
            <li key={item.id} className="todo-item">
              <button
                type="button"
                className="todo-check"
                onClick={() => handleToggle(item.id)}
                aria-label={t('todo.complete')}
              />
              <span className="todo-text">{item.text}</span>
            </li>
          ))}
          {done.map(item => (
            <li key={item.id} className="todo-item todo-item-done">
              <button
                type="button"
                className="todo-check todo-check-done"
                onClick={() => handleToggle(item.id)}
                aria-label={t('todo.uncomplete')}
              >
                ✓
              </button>
              <span className="todo-text">{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
