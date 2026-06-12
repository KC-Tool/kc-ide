/** 让出主线程，避免长任务阻塞输入 */
export function idleYield(timeoutMs = 16): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: timeoutMs });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export function deferNonCritical(task: () => void, delayMs = 0): void {
  const run = () => {
    try {
      task();
    } catch (err) {
      console.error('[koder] deferred task error', err);
    }
  };
  if (delayMs > 0) {
    setTimeout(run, delayMs);
    return;
  }
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 0);
  }
}
