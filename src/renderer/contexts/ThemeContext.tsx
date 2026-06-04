import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AppSettings, ThemeMode } from '../../shared/ipc';
import githubLight from 'highlight.js/styles/github.min.css?url';
import githubDark from 'highlight.js/styles/github-dark.min.css?url';

interface ThemeCtx {
  theme: ThemeMode;
  toggle: () => void;
  settings: AppSettings | null;
  refreshSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: 'light',
  toggle: () => {},
  settings: null,
  refreshSettings: async () => {},
  updateSettings: async () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // 初始加载设置
  useEffect(() => {
    window.koder.getSettings().then((s) => {
      setSettings(s);
      setTheme(s.theme);
    });
  }, []);

  // 同步 data-theme 到 document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 切换 highlight.js 主题
  useEffect(() => {
    const id = 'koder-hljs-theme';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = theme === 'dark' ? githubDark : githubLight;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      window.koder.updateSettings({ theme: next }).then(setSettings);
      return next;
    });
  }, []);

  const refreshSettings = useCallback(async () => {
    const s = await window.koder.getSettings();
    setSettings(s);
    setTheme(s.theme);
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const s = await window.koder.updateSettings(patch);
    setSettings(s);
    if (patch.theme) {
      setTheme(patch.theme);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle, settings, refreshSettings, updateSettings }}>
      {children}
    </ThemeContext.Provider>
  );
}
