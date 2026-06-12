import type { AppSettings } from '../../shared/ipc';
import { getVisualEffectsCssVars } from '../../shared/visual-effects';

export function applyVisualEffectsSettings(
  root: HTMLElement,
  settings: Pick<AppSettings, 'dynamicBlurLevel' | 'liquidGlassEnabled'>,
): void {
  const { blurLevel, liquidGlass, cssVars } = getVisualEffectsCssVars(settings);

  root.setAttribute('data-blur-level', String(blurLevel));
  root.setAttribute('data-liquid-glass', liquidGlass ? 'on' : 'off');

  for (const [key, value] of Object.entries(cssVars)) {
    root.style.setProperty(key, value);
  }
}
