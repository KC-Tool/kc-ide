// 行级 diff（用于 write_file / insert_code 变更预览）

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldNum?: number;
  newNum?: number;
}

export interface DiffSummary {
  added: number;
  removed: number;
  unchanged: number;
  oldLines: number;
  newLines: number;
}

/** 最长公共子序列（行级） */
function lcs(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

function backtrack(a: string[], b: string[], dp: number[][]): DiffLine[] {
  const result: DiffLine[] = [];
  let i = a.length;
  let j = b.length;
  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      stack.push({ type: 'context', content: a[i - 1], oldNum: i, newNum: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'add', content: b[j - 1], newNum: j });
      j--;
    } else if (i > 0) {
      stack.push({ type: 'remove', content: a[i - 1], oldNum: i });
      i--;
    }
  }

  while (stack.length) result.push(stack.pop()!);
  return result;
}

export function computeLineDiff(oldText: string, newText: string): { lines: DiffLine[]; summary: DiffSummary } {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const dp = lcs(oldLines, newLines);
  const lines = backtrack(oldLines, newLines, dp);

  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const line of lines) {
    if (line.type === 'add') added++;
    else if (line.type === 'remove') removed++;
    else unchanged++;
  }

  return {
    lines,
    summary: {
      added,
      removed,
      unchanged,
      oldLines: oldLines.length,
      newLines: newLines.length,
    },
  };
}

export function countLines(text: string): number {
  if (!text) return 0;
  return text.split('\n').length;
}
