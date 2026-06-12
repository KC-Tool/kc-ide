/** 根据 config.json 中的目标帧率调整动画节奏 */
export function applyAppFrameRate(root: HTMLElement, fps: number): void {
  const clamped = Math.min(240, Math.max(1, Math.round(fps) || 60));
  root.style.setProperty('--app-target-fps', String(clamped));
  // 以 60fps 为基准缩放背景动画时长
  root.style.setProperty('--app-fps-scale', String(60 / clamped));
}
