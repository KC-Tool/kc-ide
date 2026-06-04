import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppSettings, Locale } from '../../shared/ipc';
import { translate } from '../../shared/i18n';

interface I18nCtx {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  settings: AppSettings | null;
  refreshSettings: () => Promise<void>;
}

const I18nContext = createContext<I18nCtx>({
  locale: 'zh',
  setLocale: async () => {},
  t: (key) => key,
  settings: null,
  refreshSettings: async () => {},
});

export function useI18n() {
  return useContext(I18nContext);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const load = useCallback(async () => {
    const s = await window.koder.getSettings();
    setSettings(s);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const locale: Locale = settings?.locale ?? 'zh';

  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
  }, [locale]);

  useEffect(() => {
    if (settings?.fontSize) {
      document.documentElement.style.setProperty('--chat-font-size', `${settings.fontSize}px`);
    }
  }, [settings?.fontSize]);

  const setLocale = useCallback(async (next: Locale) => {
    const s = await window.koder.updateSettings({ locale: next });
    setSettings(s);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, settings, refreshSettings: load }),
    [locale, setLocale, t, settings, load],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
