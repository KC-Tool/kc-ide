/** 贴底滚动 — 合并到同一帧，避免 smooth 动画叠加导致界面抽搐 */

export function isNearBottom(el: HTMLElement, thresholdPx = 96): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < thresholdPx;
}

export function scrollToBottomInstant(el: HTMLElement): void {
  el.scrollTop = el.scrollHeight;
}

export function scrollToBottomSmooth(el: HTMLElement): void {
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
}

/** 同一帧内多次调用只滚动一次（用于流式/分块更新） */
export function createStickToBottomScheduler(getEl: () => HTMLElement | null) {
  let rafId = 0;

  const cancel = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  const schedule = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      const el = getEl();
      if (!el) return;
      scrollToBottomInstant(el);
      // 延迟高亮/占位替换可能在下一帧改变高度
      requestAnimationFrame(() => {
        const next = getEl();
        if (next) scrollToBottomInstant(next);
      });
    });
  };

  return { schedule, cancel };
}
