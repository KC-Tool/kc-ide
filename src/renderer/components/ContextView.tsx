import { useMemo } from 'react';
import { formatTokenCount } from '../lib/format-tokens';

interface ContextBreakdown {
  system: number;
  history: number;
  toolDefs: number;
  toolResults: number;
  currentOutput: number;
}

interface ContextUsageData {
  current: number;
  max: number;
  breakdown?: ContextBreakdown;
  cachedTokens?: number;
  cacheHitRate?: number;
  toolCacheHits?: number;
  toolCacheMisses?: number;
}

interface Props {
  contextUsage: ContextUsageData;
  onClose: () => void;
}

interface ContextItem {
  name: string;
  tokens: number;
  color: string;
}

const CONTEXT_COLORS = [
  '#6366f1', // system - indigo
  '#22c55e', // toolDefs - green
  '#f59e0b', // toolResults - amber
  '#3b82f6', // history - blue
  '#8b5cf6', // currentOutput - purple
  '#ec4899', // cached - pink
];

const formatTokens = formatTokenCount;

export default function ContextView({ contextUsage, onClose }: Props) {
  const { current, max, breakdown, cachedTokens, cacheHitRate, toolCacheHits, toolCacheMisses } = contextUsage;
  
  const percent = max > 0 ? (current / max) * 100 : 0;
  const percentDisplay = percent.toFixed(0);
  
  const contextItems = useMemo<ContextItem[]>(() => {
    if (!breakdown) return [];
    
    const items: ContextItem[] = [
      { name: 'System prompt', tokens: breakdown.system, color: CONTEXT_COLORS[0] },
      { name: 'Tool definitions', tokens: breakdown.toolDefs, color: CONTEXT_COLORS[1] },
      { name: 'Tool results', tokens: breakdown.toolResults, color: CONTEXT_COLORS[2] },
      { name: 'Conversation', tokens: breakdown.history, color: CONTEXT_COLORS[3] },
      { name: 'Current output', tokens: breakdown.currentOutput, color: CONTEXT_COLORS[4] },
    ];
    
    if (cachedTokens && cachedTokens > 0) {
      items.push({ name: 'Cached tokens', tokens: cachedTokens, color: CONTEXT_COLORS[5] });
    }
    
    return items.filter(item => item.tokens > 0).sort((a, b) => b.tokens - a.tokens);
  }, [breakdown, cachedTokens]);
  
  const totalDisplay = `${formatTokens(current)} / ${formatTokens(max)} Tokens`;
  const hasData = current > 0 || contextItems.length > 0;
  
  if (!hasData) {
    return (
      <div className="context-view-panel">
        <div className="context-view-header">
          <div className="context-view-title">
            <h3>Context</h3>
            <span className="context-view-percent">0% Full</span>
          </div>
          <button type="button" className="context-view-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="context-view-overview">
          <div className="context-view-tokens">{totalDisplay}</div>
          <div className="context-view-empty">
            No context data available. Start a conversation to see context usage.
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="context-view-panel">
      <div className="context-view-header">
        <div className="context-view-title">
          <h3>Context</h3>
          <span className="context-view-percent">{percentDisplay}% Full</span>
        </div>
        <button type="button" className="context-view-close" onClick={onClose}>
          ×
        </button>
      </div>
      
      <div className="context-view-overview">
        <div className="context-view-tokens">{totalDisplay}</div>
        <div className="context-view-progress-bar">
          {contextItems.length > 0 ? (
            contextItems.map((item, index) => {
              const itemPercent = (item.tokens / max) * 100;
              return (
                <div
                  key={item.name}
                  className="context-progress-segment"
                  style={{
                    width: `${itemPercent}%`,
                    backgroundColor: item.color,
                  }}
                  title={`${item.name}: ${formatTokens(item.tokens)} tokens`}
                />
              );
            })
          ) : (
            <div
              className="context-progress-segment"
              style={{
                width: `${percent}%`,
                backgroundColor: CONTEXT_COLORS[0],
              }}
            />
          )}
        </div>
      </div>
      
      {contextItems.length > 0 && (
        <div className="context-view-breakdown">
          {contextItems.map((item) => (
            <div key={item.name} className="context-breakdown-item">
              <div className="context-breakdown-info">
                <div 
                  className="context-breakdown-dot" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="context-breakdown-name">{item.name}</span>
              </div>
              <span className="context-breakdown-tokens">{formatTokens(item.tokens)} tokens</span>
            </div>
          ))}
        </div>
      )}
      
      {!breakdown && current > 0 && (
        <div className="context-view-breakdown">
          <div className="context-breakdown-item">
            <div className="context-breakdown-info">
              <div 
                className="context-breakdown-dot" 
                style={{ backgroundColor: CONTEXT_COLORS[0] }}
              />
              <span className="context-breakdown-name">Total tokens used</span>
            </div>
            <span className="context-breakdown-tokens">{formatTokens(current)} tokens</span>
          </div>
        </div>
      )}
      
      {(cacheHitRate !== undefined || toolCacheHits !== undefined || toolCacheMisses !== undefined) && (
        <div className="context-view-cache">
          {cacheHitRate !== undefined && (
            <div className="context-cache-item">
              <span className="context-cache-label">API Cache Hit Rate</span>
              <span className="context-cache-value">{cacheHitRate.toFixed(1)}%</span>
            </div>
          )}
          {(toolCacheHits !== undefined || toolCacheMisses !== undefined) && (
            <div className="context-cache-item">
              <span className="context-cache-label">Tool Cache</span>
              <span className="context-cache-value">
                Hits: {toolCacheHits ?? 0} · Misses: {toolCacheMisses ?? 0}
              </span>
            </div>
          )}
        </div>
      )}
      
      <div className="context-view-footer">
        <button type="button" className="context-view-followup">
          Send follow-up
        </button>
        <div className="context-view-composer">
          <span className="context-composer-text">Composer 2.5</span>
          <span className="context-composer-lock">🔒</span>
        </div>
        <div className="context-view-actions">
          <button type="button" className="context-action-btn" title="Microphone">
            🎤
          </button>
        </div>
        <div className="context-view-labels">
          <span className="context-label context-label-main">main</span>
          <span className="context-label context-label-local">Local</span>
        </div>
      </div>
    </div>
  );
}
