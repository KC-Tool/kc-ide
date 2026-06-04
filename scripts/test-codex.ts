// 临时调试脚本：跑一次 codex，看完整输出
import { CodexRunner } from '../src/main/codex-runner';

const r = new CodexRunner();
const runId = r.nextRunId();

let exitCode: number | null = null;
let stdout = '';
let stderr = '';

r.run({ prompt: 'Reply with the single word: PONG' }, runId, (e) => {
  if (e.type === 'stdout') {
    stdout += e.data ?? '';
  } else if (e.type === 'stderr') {
    stderr += e.data ?? '';
  } else if (e.type === 'exit') {
    exitCode = e.code ?? -1;
  } else if (e.type === 'error') {
    console.error('[error]', e.message);
  } else if (e.type === 'start') {
    console.log('[start]', e.data);
  }
});

// 最多等 30s
const start = Date.now();
const interval = setInterval(() => {
  if (exitCode !== null) {
    clearInterval(interval);
    console.log('--- STDOUT ---');
    console.log(stdout);
    console.log('--- STDERR ---');
    console.log(stderr);
    console.log('--- EXIT ---', exitCode);
    process.exit(0);
  }
  if (Date.now() - start > 90_000) {
    clearInterval(interval);
    console.log('TIMEOUT, partial:');
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
    process.exit(2);
  }
}, 100);
