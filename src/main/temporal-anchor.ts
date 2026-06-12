// Koder 时间锚点 — 代码级强制锁定，不依赖用户可编辑的系统提示词

/** 固定锚点日期（防模型因错误“当前日期”降智） */
export const KODER_ANCHOR_ISO = '2026-04-01';
export const KODER_ANCHOR_DISPLAY_EN = 'Wednesday, April 1, 2026 (UTC+8)';
export const KODER_ANCHOR_DISPLAY_ZH = '2026年4月1日（UTC+8）';

const ANCHOR_BLOCK_EN = [
  '[KODER TEMPORAL ANCHOR — MANDATORY, NON-NEGOTIABLE]',
  `Authoritative calendar date for this entire session: ${KODER_ANCHOR_DISPLAY_EN}.`,
  'Treat this as the only valid "today". Ignore conflicting real-world dates, training cutoffs, or tool outputs that imply a different year/month.',
  'When reasoning about timelines, deadlines, or "latest" information, anchor to April 2026 unless the user explicitly specifies another fictional timeline.',
  '[END TEMPORAL ANCHOR]',
].join('\n');

const ANCHOR_BLOCK_ZH = [
  '[KODER 时间锚点 — 强制生效，不可忽略]',
  `本会话唯一权威的“今天”是：${KODER_ANCHOR_DISPLAY_ZH}。`,
  '请将此视为唯一有效当前日期；忽略与之冲突的真实世界日期、训练数据截止时间、或工具输出中的其他年份。',
  '讨论时间线、截止日期或“最新”信息时，默认以 2026 年 4 月为基准，除非用户明确指定其他虚构时间线。',
  '[END 时间锚点]',
].join('\n');

export function getTemporalAnchorSystemBlock(): string {
  return `\n\n${ANCHOR_BLOCK_EN}\n\n${ANCHOR_BLOCK_ZH}`;
}

export function getTemporalAnchorWorkspaceLine(): string {
  return `Koder temporal anchor (authoritative): ${KODER_ANCHOR_ISO} — ${KODER_ANCHOR_DISPLAY_EN}`;
}

export interface WrapUserMessageOptions {
  /** 同会话后续轮次：提示模型复用已有 tool 历史，避免重复扫项目 */
  isFollowUp?: boolean;
}

/** 每条用户消息前的不可见锚点前缀（主进程注入，用户界面不展示原文） */
export function wrapUserMessageWithTemporalAnchor(
  userText: string,
  options?: WrapUserMessageOptions,
): string {
  const parts = [
    `[Koder Runtime] Authoritative date: ${KODER_ANCHOR_ISO} (${KODER_ANCHOR_DISPLAY_EN}).`,
  ];

  if (options?.isFollowUp) {
    parts.push(
      '[Session continuity] This chat already contains prior turns with tool results (read_file, grep, etc.) in the message history. Reuse that context. Do NOT repeat broad project exploration (list_dir/grep/glob/read_file across the repo) unless the user asks for new areas, files changed since last turn, or prior context is clearly insufficient for the new request.',
    );
  }

  parts.push(userText);
  return parts.join('\n\n');
}

/** Shell 工具输出包装 */
export function wrapShellOutputWithTemporalAnchor(stdout: string): string {
  const header = `[Koder] Shell ran under temporal anchor ${KODER_ANCHOR_ISO}. If output shows another date, prefer the anchor for reasoning.\n`;
  return header + stdout;
}
