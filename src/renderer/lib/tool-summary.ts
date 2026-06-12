/** Cursor 风格工具行摘要文案 */

function tryParseInput(input: string): Record<string, unknown> {
  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function basename(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

export function getToolSummary(name: string, input: string, locale: 'zh' | 'en'): { verb: string; target?: string } {
  const args = tryParseInput(input);
  const path = typeof args.path === 'string' ? basename(args.path) : '';
  const pattern = typeof args.pattern === 'string' ? args.pattern : '';
  const command = typeof args.command === 'string' ? args.command.split('\n')[0].slice(0, 48) : '';
  const member = typeof args.member_id === 'string' ? args.member_id : '';

  const zh: Record<string, { verb: string; target?: string }> = {
    read_file: { verb: 'Read', target: path || '…' },
    write_file: { verb: 'Edited', target: path || '…' },
    insert_code: { verb: 'Edited', target: path || '…' },
    list_dir: { verb: 'Listed', target: path || '.' },
    shell: { verb: 'Ran command', target: command || undefined },
    grep: { verb: 'Grepped', target: pattern || '…' },
    glob: { verb: 'Searched files', target: pattern || '…' },
    delegate_agent: { verb: 'Delegated', target: member || 'agent' },
    delegate_agents_parallel: { verb: 'Parallel delegate', target: undefined },
    spawn_agent: { verb: 'Spawned agent', target: typeof args.name === 'string' ? args.name : undefined },
    todo_add: { verb: 'Added todos', target: undefined },
    todo_complete: { verb: 'Completed todos', target: undefined },
    todo_list: { verb: 'Listed todos', target: undefined },
  };

  const en = zh;

  const table = locale === 'en' ? en : zh;
  return table[name] ?? { verb: name.replace(/_/g, ' '), target: path || pattern || undefined };
}
