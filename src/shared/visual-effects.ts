// 动态背景模糊与液态玻璃 — 等级映射（主进程 / 渲染进程共享）

import type { AppSettings } from './ipc.js';

export type DynamicBlurLevel = 0 | 1 | 2 | 3 | 4;

export const DYNAMIC_BLUR_LEVEL_MAX = 4;

export const DYNAMIC_BLUR_LEVEL_KEYS = [
  'settings.general.dynamicBlur.off',
  'settings.general.dynamicBlur.low',
  'settings.general.dynamicBlur.medium',
  'settings.general.dynamicBlur.high',
  'settings.general.dynamicBlur.ultra',
] as const;

const LEVEL_CONFIG: Record<
  DynamicBlurLevel,
  { orbBlur: number; orbOpacity: number; animDuration: number; glassBlur: number }
> = {
  0: { orbBlur: 0, orbOpacity: 0, animDuration: 0, glassBlur: 12 },
  1: { orbBlur: 56, orbOpacity: 0.28, animDuration: 28, glassBlur: 14 },
  2: { orbBlur: 80, orbOpacity: 0.4, animDuration: 22, glassBlur: 18 },
  3: { orbBlur: 108, orbOpacity: 0.52, animDuration: 18, glassBlur: 22 },
  4: { orbBlur: 140, orbOpacity: 0.62, animDuration: 14, glassBlur: 28 },
};

export function clampDynamicBlurLevel(value: unknown): DynamicBlurLevel {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 4) return 4;
  return Math.round(n) as DynamicBlurLevel;
}

export function getVisualEffectsCssVars(
  settings: Pick<AppSettings, 'dynamicBlurLevel' | 'liquidGlassEnabled'>,
): {
  blurLevel: DynamicBlurLevel;
  liquidGlass: boolean;
  cssVars: Record<string, string>;
} {
  const blurLevel = clampDynamicBlurLevel(settings.dynamicBlurLevel ?? 0);
  const liquidGlass = settings.liquidGlassEnabled ?? false;
  const cfg = LEVEL_CONFIG[blurLevel];

  return {
    blurLevel,
    liquidGlass,
    cssVars: {
      '--dynamic-orb-blur': `${cfg.orbBlur}px`,
      '--dynamic-orb-opacity': String(cfg.orbOpacity),
      '--dynamic-anim-duration': `${cfg.animDuration}s`,
      '--glass-blur': liquidGlass ? `${Math.max(cfg.glassBlur, 14)}px` : '0px',
    },
  };
}
