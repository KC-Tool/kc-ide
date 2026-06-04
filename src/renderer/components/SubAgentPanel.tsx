interface SubAgentRun {
  key: string;
  memberId: string;
  memberName: string;
  task: string;
  output: string;
  running: boolean;
}

interface Props {
  runs: SubAgentRun[];
}

export default function SubAgentPanel({ runs }: Props) {
  if (runs.length === 0) return null;

  return (
    <div className="subagent-panel">
      {runs.map((run) => (
        <div key={run.key} className={`subagent-card ${run.running ? 'subagent-card-running' : ''}`}>
          <div className="subagent-card-header">
            <span className="subagent-badge">Sub-agent</span>
            <strong>{run.memberName}</strong>
            <span className="subagent-id">{run.memberId}</span>
            {run.running && <span className="subagent-status">运行中…</span>}
          </div>
          {run.task && <div className="subagent-task">{run.task}</div>}
          {run.output && (
            <pre className="subagent-output">{run.output.length > 2000 ? `${run.output.slice(0, 2000)}…` : run.output}</pre>
          )}
        </div>
      ))}
    </div>
  );
}

export type { SubAgentRun };
