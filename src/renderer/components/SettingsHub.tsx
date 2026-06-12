import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentConfig, AppSettings } from '../../shared/ipc';
import { LOCALE_LABELS } from '../../shared/i18n';
import type { Locale } from '../../shared/ipc';
import { DEFAULT_SYSTEM_PROMPT } from '../../shared/system-prompt';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  DYNAMIC_BLUR_LEVEL_KEYS,
  DYNAMIC_BLUR_LEVEL_MAX,
  clampDynamicBlurLevel,
} from '../../shared/visual-effects';
import TeamsSettingsPanel from './TeamsSettingsPanel';
import Modal, { useModalClose } from './Modal';

export type SettingsTab = 'general' | 'model' | 'teams';

const TAB_ORDER: SettingsTab[] = ['general', 'model', 'teams'];

interface Props {
  initialTab: SettingsTab;
  onClose: () => void;
  onModelSaved?: () => void;
}

const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function SettingsHub(props: Props) {
  return (
    <Modal onClose={props.onClose} panelClassName="modal-lg settings-hub">
      <SettingsHubContent {...props} />
    </Modal>
  );
}

function SettingsHubContent({ initialTab, onModelSaved }: Props) {
  const requestClose = useModalClose();
  const { t, locale, setLocale, refreshSettings: refreshI18n } = useI18n();
  const { settings, updateSettings, refreshSettings: refreshTheme } = useTheme();

  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [generalDraft, setGeneralDraft] = useState<AppSettings | null>(null);
  const [generalSaving, setGeneralSaving] = useState(false);

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [modelSaving, setModelSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [animDirection, setAnimDirection] = useState<'forward' | 'back'>('forward');
  const tabRef = useRef(initialTab === 'model' ? 1 : 0);

  useEffect(() => {
    if (TAB_ORDER.includes(initialTab)) {
      setTab(initialTab);
      tabRef.current = TAB_ORDER.indexOf(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (settings) setGeneralDraft({ ...settings });
  }, [settings]);

  useEffect(() => {
    if (!config) {
      void window.koder.getAgentConfig().then(setConfig);
    }
  }, [config]);

  const switchTab = useCallback((next: SettingsTab) => {
    const nextIdx = TAB_ORDER.indexOf(next);
    const prevIdx = tabRef.current;
    setAnimDirection(nextIdx >= prevIdx ? 'forward' : 'back');
    tabRef.current = nextIdx;
    setTab(next);
  }, []);

  const handleSaveGeneral = useCallback(async () => {
    if (!generalDraft) return;
    setGeneralSaving(true);
    await updateSettings({
      theme: generalDraft.theme,
      fontSize: generalDraft.fontSize,
      locale: generalDraft.locale,
      defaultTeamId: generalDraft.defaultTeamId,
      dynamicBlurLevel: generalDraft.dynamicBlurLevel,
      liquidGlassEnabled: generalDraft.liquidGlassEnabled,
    });
    if (generalDraft.locale !== locale) {
      await setLocale(generalDraft.locale);
    }
    await refreshI18n();
    await refreshTheme();
    setGeneralSaving(false);
    requestClose();
  }, [generalDraft, updateSettings, locale, setLocale, refreshI18n, refreshTheme, requestClose]);

  const handleSaveModel = useCallback(async () => {
    if (!config) return;
    setModelSaving(true);
    const customized = config.systemPrompt.trim() !== DEFAULT_SYSTEM_PROMPT.trim();
    await window.koder.updateAgentConfig({
      ...config,
      systemPromptCustomized: customized,
    });
    setModelSaving(false);
    onModelSaved?.();
    requestClose();
  }, [config, onModelSaved, requestClose]);

  const handleResetSystemPrompt = useCallback(() => {
    if (!config) return;
    setConfig({
      ...config,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      systemPromptCustomized: false,
    });
  }, [config]);

  const handleDefaultTeamChange = useCallback((id: string | undefined) => {
    setGeneralDraft((d) => (d ? { ...d, defaultTeamId: id } : d));
    void updateSettings({ defaultTeamId: id });
  }, [updateSettings]);

  const handleDynamicBlurChange = useCallback((level: number) => {
    const next = clampDynamicBlurLevel(level);
    setGeneralDraft((d) => (d ? { ...d, dynamicBlurLevel: next } : d));
    void updateSettings({ dynamicBlurLevel: next });
  }, [updateSettings]);

  const handleLiquidGlassChange = useCallback((enabled: boolean) => {
    setGeneralDraft((d) => (d ? { ...d, liquidGlassEnabled: enabled } : d));
    void updateSettings({ liquidGlassEnabled: enabled });
  }, [updateSettings]);

  const handleFrameRateChange = useCallback((fps: number) => {
    const next = Math.min(240, Math.max(1, Math.round(fps) || 60));
    setConfig((c) => (c ? { ...c, appFrameRate: next } : c));
    void window.koder.updateAgentConfig({ appFrameRate: next });
  }, []);

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: t('settings.tab.general') },
    { id: 'model', label: t('settings.tab.model') },
    { id: 'teams', label: t('settings.tab.teams') },
  ];

  return (
    <>
        <div className="modal-header">
          <h2>{t('settings.title')}</h2>
          <button className="icon-btn" onClick={requestClose} aria-label={t('common.close')}>
            <IconX />
          </button>
        </div>

        <div className="settings-hub-layout">
          <nav className="settings-hub-tabs" role="tablist">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`settings-hub-tab ${tab === item.id ? 'active' : ''}`}
                onClick={() => switchTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="settings-hub-main">
          <div className="settings-hub-panel settings-hub-panel-animated">
            <div key={tab} className={`settings-hub-panel-content settings-hub-panel-${animDirection}`}>
            {tab === 'general' && generalDraft && (
              <div className="settings-section">
                <div className="settings-section-title">{t('settings.general.appearance')}</div>

                <div className="settings-row">
                  <div>
                    <div className="settings-label">{t('settings.general.language')}</div>
                    <div className="settings-label-desc">{t('settings.general.languageDesc')}</div>
                  </div>
                  <select
                    className="settings-input"
                    value={generalDraft.locale}
                    onChange={(e) => {
                      const next = e.target.value as Locale;
                      setGeneralDraft({ ...generalDraft, locale: next });
                      void setLocale(next);
                    }}
                    style={{ width: 140 }}
                  >
                    {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
                      <option key={loc} value={loc}>{LOCALE_LABELS[loc]}</option>
                    ))}
                  </select>
                </div>

                <div className="settings-row">
                  <div>
                    <div className="settings-label">{t('settings.general.theme')}</div>
                    <div className="settings-label-desc">{t('settings.general.themeDesc')}</div>
                  </div>
                  <div className="theme-toggle">
                    <span className="theme-toggle-label">{t('sidebar.theme.light')}</span>
                    <button
                      type="button"
                      className={`theme-toggle-switch ${generalDraft.theme === 'dark' ? 'active' : ''}`}
                      onClick={() => setGeneralDraft({
                        ...generalDraft,
                        theme: generalDraft.theme === 'light' ? 'dark' : 'light',
                      })}
                    />
                    <span className="theme-toggle-label">{t('sidebar.theme.dark')}</span>
                  </div>
                </div>

                <div className="settings-row">
                  <div>
                    <div className="settings-label">{t('settings.general.fontSize')}</div>
                    <div className="settings-label-desc">{t('settings.general.fontSizeDesc')}</div>
                  </div>
                  <input
                    className="settings-input"
                    type="number"
                    min={11}
                    max={20}
                    value={generalDraft.fontSize}
                    onChange={(e) => setGeneralDraft({
                      ...generalDraft,
                      fontSize: Number(e.target.value) || 13,
                    })}
                    style={{ width: 80, textAlign: 'center' }}
                  />
                </div>

                <div className="settings-row settings-row-stack">
                  <div>
                    <div className="settings-label">{t('settings.general.dynamicBlur')}</div>
                    <div className="settings-label-desc">{t('settings.general.dynamicBlurDesc')}</div>
                  </div>
                  <div className="settings-blur-control">
                    <input
                      className="settings-range"
                      type="range"
                      min={0}
                      max={DYNAMIC_BLUR_LEVEL_MAX}
                      step={1}
                      value={clampDynamicBlurLevel(generalDraft.dynamicBlurLevel ?? 0)}
                      onChange={(e) => handleDynamicBlurChange(Number(e.target.value))}
                    />
                    <span className="settings-blur-level-label">
                      {t(DYNAMIC_BLUR_LEVEL_KEYS[clampDynamicBlurLevel(generalDraft.dynamicBlurLevel ?? 0)])}
                    </span>
                  </div>
                </div>

                <div className="settings-row">
                  <div>
                    <div className="settings-label">{t('settings.general.liquidGlass')}</div>
                    <div className="settings-label-desc">{t('settings.general.liquidGlassDesc')}</div>
                  </div>
                  <button
                    type="button"
                    className={`theme-toggle-switch ${generalDraft.liquidGlassEnabled ? 'active' : ''}`}
                    aria-pressed={!!generalDraft.liquidGlassEnabled}
                    onClick={() => handleLiquidGlassChange(!generalDraft.liquidGlassEnabled)}
                  />
                </div>

                {config && (
                  <div className="settings-row">
                    <div>
                      <div className="settings-label">{t('settings.general.frameRate')}</div>
                      <div className="settings-label-desc">{t('settings.general.frameRateDesc')}</div>
                    </div>
                    <input
                      className="settings-input"
                      type="number"
                      min={1}
                      max={240}
                      step={1}
                      value={config.appFrameRate ?? 60}
                      onChange={(e) => handleFrameRateChange(Number(e.target.value))}
                      style={{ width: 100, textAlign: 'center' }}
                    />
                  </div>
                )}
              </div>
            )}

            {tab === 'teams' && generalDraft && (
              <TeamsSettingsPanel
                defaultTeamId={generalDraft.defaultTeamId}
                onDefaultTeamChange={handleDefaultTeamChange}
              />
            )}

            {tab === 'model' && config && (
              <>
                <div className="settings-section">
                  <div className="settings-section-title">{t('settings.model.api')}</div>
                  <div className="settings-row">
                    <div>
                      <div className="settings-label">{t('settings.model.apiKey')}</div>
                      <div className="settings-label-desc">{t('settings.model.apiKeyDesc')}</div>
                    </div>
                    <div className="settings-row-browse">
                      <input
                        className="settings-input"
                        type={showKey ? 'text' : 'password'}
                        placeholder="sk-..."
                        value={config.apiKey}
                        onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                        style={{ minWidth: 220 }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setShowKey(!showKey)}
                        style={{ padding: '6px 8px', fontSize: 11 }}
                      >
                        {showKey ? t('settings.model.hideKey') : t('settings.model.showKey')}
                      </button>
                    </div>
                  </div>
                  <div className="settings-row">
                    <div>
                      <div className="settings-label">{t('settings.model.baseUrl')}</div>
                      <div className="settings-label-desc">{t('settings.model.baseUrlDesc')}</div>
                    </div>
                    <input
                      className="settings-input"
                      type="text"
                      placeholder="https://api.openai.com/v1"
                      value={config.baseUrl}
                      onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                      style={{ minWidth: 260 }}
                    />
                  </div>
                  <div className="settings-row">
                    <div>
                      <div className="settings-label">{t('settings.model.modelId')}</div>
                      <div className="settings-label-desc">{t('settings.model.modelIdDesc')}</div>
                    </div>
                    <input
                      className="settings-input"
                      type="text"
                      placeholder="gpt-4o"
                      value={config.model}
                      onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    />
                  </div>
                </div>

                <div className="settings-section">
                  <div className="settings-section-title">{t('settings.model.generation')}</div>
                  <div className="settings-row">
                    <div>
                      <div className="settings-label">{t('settings.model.reasoning')}</div>
                      <div className="settings-label-desc">{t('settings.model.reasoningDesc')}</div>
                    </div>
                    <select
                      className="settings-input"
                      value={config.reasoningEffort ?? 'medium'}
                      onChange={(e) => setConfig({
                        ...config,
                        reasoningEffort: e.target.value as AgentConfig['reasoningEffort'],
                      })}
                      style={{ width: 140 }}
                    >
                      <option value="off">{t('settings.model.reasoning.off')}</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="xhigh">XHigh</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <div>
                      <div className="settings-label">{t('settings.model.maxTokens')}</div>
                      <div className="settings-label-desc">{t('settings.model.maxTokensDesc')}</div>
                    </div>
                    <input
                      className="settings-input"
                      type="number"
                      min={256}
                      max={128000}
                      value={config.maxTokens}
                      onChange={(e) => setConfig({ ...config, maxTokens: Number(e.target.value) || 4096 })}
                      style={{ width: 100, textAlign: 'center' }}
                    />
                  </div>
                  <div className="settings-row">
                    <div>
                      <div className="settings-label">{t('settings.model.temperature')}</div>
                      <div className="settings-label-desc">{t('settings.model.temperatureDesc')}</div>
                    </div>
                    <input
                      className="settings-input"
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={config.temperature}
                      onChange={(e) => setConfig({ ...config, temperature: Number(e.target.value) || 0.3 })}
                      style={{ width: 80, textAlign: 'center' }}
                    />
                  </div>
                  <div className="settings-row">
                    <div>
                      <div className="settings-label">{t('settings.model.maxContext')}</div>
                      <div className="settings-label-desc">{t('settings.model.maxContextDesc')}</div>
                    </div>
                    <input
                      className="settings-input"
                      type="number"
                      min={4096}
                      max={1000000}
                      step={1000}
                      value={config.maxContextTokens}
                      onChange={(e) => setConfig({
                        ...config,
                        maxContextTokens: Number(e.target.value) || 200000,
                      })}
                      style={{ width: 120, textAlign: 'center' }}
                    />
                  </div>
                </div>

                <div className="settings-section">
                  <div className="settings-section-title">{t('settings.model.cache')}</div>
                  <div className="settings-row">
                    <div>
                      <div className="settings-label">{t('settings.model.promptCache')}</div>
                      <div className="settings-label-desc">{t('settings.model.promptCacheDesc')}</div>
                    </div>
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        checked={config.promptCacheEnabled ?? true}
                        onChange={(e) => setConfig({ ...config, promptCacheEnabled: e.target.checked })}
                      />
                      <span>
                        {config.promptCacheEnabled ? t('settings.model.enabled') : t('settings.model.disabled')}
                      </span>
                    </label>
                  </div>
                  <div className="settings-row">
                    <div>
                      <div className="settings-label">{t('settings.model.toolCache')}</div>
                      <div className="settings-label-desc">{t('settings.model.toolCacheDesc')}</div>
                    </div>
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        checked={config.toolCacheEnabled ?? true}
                        onChange={(e) => setConfig({ ...config, toolCacheEnabled: e.target.checked })}
                      />
                      <span>
                        {config.toolCacheEnabled ? t('settings.model.enabled') : t('settings.model.disabled')}
                      </span>
                    </label>
                  </div>
                  <div className="settings-row">
                    <div>
                      <div className="settings-label">{t('settings.model.toolCacheMax')}</div>
                      <div className="settings-label-desc">{t('settings.model.toolCacheMaxDesc')}</div>
                    </div>
                    <input
                      className="settings-input"
                      type="number"
                      min={50}
                      max={2000}
                      value={config.toolCacheMaxEntries ?? 300}
                      onChange={(e) => setConfig({
                        ...config,
                        toolCacheMaxEntries: Number(e.target.value) || 300,
                      })}
                      style={{ width: 100, textAlign: 'center' }}
                      disabled={!config.toolCacheEnabled}
                    />
                  </div>
                </div>

                <div className="settings-section">
                  <div className="settings-section-title">{t('settings.model.systemPrompt')}</div>
                  <p className="settings-label-desc" style={{ marginBottom: 8 }}>
                    {config.systemPromptCustomized
                      ? t('settings.model.systemPromptCustom')
                      : t('settings.model.systemPromptBuiltin')}
                  </p>
                  <textarea
                    className="composer-textarea"
                    rows={5}
                    value={config.systemPrompt}
                    onChange={(e) => setConfig({
                      ...config,
                      systemPrompt: e.target.value,
                      systemPromptCustomized: e.target.value.trim() !== DEFAULT_SYSTEM_PROMPT.trim(),
                    })}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
                  />
                  <div className="settings-system-prompt-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={handleResetSystemPrompt}
                      disabled={!config.systemPromptCustomized}
                    >
                      {t('settings.model.systemPromptReset')}
                    </button>
                  </div>
                </div>
              </>
            )}

            </div>
          </div>

          <div className="settings-hub-footer">
            <button type="button" className="btn btn-ghost" onClick={requestClose}>{t('settings.cancel')}</button>
            {tab === 'general' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleSaveGeneral()}
                disabled={generalSaving || !generalDraft}
              >
                {generalSaving ? t('settings.saving') : t('settings.save')}
              </button>
            )}
            {tab === 'model' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleSaveModel()}
                disabled={modelSaving || !config}
              >
                {modelSaving ? t('settings.saving') : t('settings.saveModel')}
              </button>
            )}
          </div>
          </div>
        </div>
    </>
  );
}
