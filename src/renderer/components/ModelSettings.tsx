import { useCallback, useEffect, useState } from 'react';
import type { AgentConfig } from '../../shared/ipc';

interface Props {
  onClose: () => void;
}

const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function ModelSettings({ onClose }: Props) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    window.koder.getAgentConfig().then(setConfig);
  }, []);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    await window.koder.updateAgentConfig(config);
    setSaving(false);
    onClose();
  }, [config, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!config) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <h2>模型配置</h2>
          <button className="icon-btn" onClick={onClose}><IconX /></button>
        </div>

        <div className="modal-body">
          <div className="settings-section">
            <div className="settings-section-title">API 连接</div>

            <div className="settings-row">
              <div>
                <div className="settings-label">API Key</div>
                <div className="settings-label-desc">你的 OpenAI / 兼容服务 API 密钥</div>
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
                  className="btn btn-ghost"
                  onClick={() => setShowKey(!showKey)}
                  style={{ padding: '6px 8px', fontSize: 11 }}
                >
                  {showKey ? '隐藏' : '显示'}
                </button>
              </div>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-label">Base URL</div>
                <div className="settings-label-desc">API 端点地址（兼容 OpenAI 格式）</div>
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
                <div className="settings-label">模型</div>
                <div className="settings-label-desc">使用的模型 ID</div>
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
            <div className="settings-section-title">生成参数</div>

            <div className="settings-row">
              <div>
                <div className="settings-label">思考等级</div>
                <div className="settings-label-desc">推理强度（reasoning_effort，需模型/API 支持）</div>
              </div>
              <select
                className="settings-input"
                value={config.reasoningEffort ?? 'medium'}
                onChange={(e) => setConfig({ ...config, reasoningEffort: e.target.value as AgentConfig['reasoningEffort'] })}
                style={{ width: 140 }}
              >
                <option value="off">关闭</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="xhigh">XHigh</option>
              </select>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-label">最大 Token</div>
                <div className="settings-label-desc">单次生成的最大 token 数</div>
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
                <div className="settings-label">温度</div>
                <div className="settings-label-desc">控制输出随机性（0-2）</div>
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
                <div className="settings-label">最大上下文长度</div>
                <div className="settings-label-desc">模型上下文窗口大小（token 数），每个会话独立跟踪</div>
              </div>
              <input
                className="settings-input"
                type="number"
                min={4096}
                max={1000000}
                step={1000}
                value={config.maxContextTokens}
                onChange={(e) => setConfig({ ...config, maxContextTokens: Number(e.target.value) || 200000 })}
                style={{ width: 120, textAlign: 'center' }}
              />
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">缓存</div>

            <div className="settings-row">
              <div>
                <div className="settings-label">API Prompt 缓存</div>
                <div className="settings-label-desc">静态前缀分离 + cache_control，提高 provider 端命中率</div>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={config.promptCacheEnabled ?? true}
                  onChange={(e) => setConfig({ ...config, promptCacheEnabled: e.target.checked })}
                />
                <span>{config.promptCacheEnabled ? '已启用' : '已关闭'}</span>
              </label>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-label">本地工具缓存</div>
                <div className="settings-label-desc">缓存 read/grep/glob/list_dir，减少重复 IO</div>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={config.toolCacheEnabled ?? true}
                  onChange={(e) => setConfig({ ...config, toolCacheEnabled: e.target.checked })}
                />
                <span>{config.toolCacheEnabled ? '已启用' : '已关闭'}</span>
              </label>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-label">工具缓存条目上限</div>
                <div className="settings-label-desc">LRU 淘汰，默认 300</div>
              </div>
              <input
                className="settings-input"
                type="number"
                min={50}
                max={2000}
                value={config.toolCacheMaxEntries ?? 300}
                onChange={(e) => setConfig({ ...config, toolCacheMaxEntries: Number(e.target.value) || 300 })}
                style={{ width: 100, textAlign: 'center' }}
                disabled={!config.toolCacheEnabled}
              />
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">系统提示词</div>
            <textarea
              className="composer-textarea"
              rows={5}
              value={config.systemPrompt}
              onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
}
