import type { TodoItem } from '../../shared/ipc';
import { useI18n } from '../contexts/I18nContext';

interface Props {
  todos: TodoItem[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function TodoPanel({ todos, collapsed, onToggleCollapse }: Props) {
  const { t } = useI18n();
  const pending = todos.filter(item => !item.done);
  const done = todos.filter(item => item.done);

  if (todos.length === 0) return null;

  return (
    <div className="todo-panel">
      <button type="button" className="todo-panel-header" onClick={onToggleCollapse}>
        <span className="todo-panel-title">
          Created Todo List {todos.length} tasks
        </span>
        <span className={`todo-panel-chevron ${collapsed ? '' : 'open'}`} aria-hidden>›</span>
      </button>
      {!collapsed && (
        <>
          <ul className="todo-list">
            {done.map(item => (
              <li key={item.id} className="todo-item todo-item-done">
                <span className="todo-check todo-check-done" aria-hidden />
                <span className="todo-text">{item.text}</span>
              </li>
            ))}
            {pending.map(item => (
              <li key={item.id} className="todo-item">
                <span className="todo-check" aria-hidden />
                <span className="todo-text">{item.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
