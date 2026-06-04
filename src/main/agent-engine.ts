// Koder Agent 引擎
// 负责：调用 OpenAI-compatible API（streaming），执行 tool calls，多轮对话

import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { AgentConfig, AgentEvent, ToolCallInfo, ToolResult } from '../shared/ipc.js';
import { TOOL_DEFINITIONS, executeTool, normalizeToolName, resetWrittenFileTracking, configureToolCache } from './tools.js';
import {
  buildApiRequestBody,
  buildCacheOptimizedMessages,
  extractCachedTokens,
  extractPromptTokens,
} from './prompt-cache.js';
import { globalToolCache } from './tool-cache.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

interface RunningAgent {
  sessionId: string;
  cancelled: boolean;
  req?: http.ClientRequest;
}

export class AgentEngine {
  private agents = new Map<string, RunningAgent>();

  async run(
    config: AgentConfig,
    conversationHistory: ChatMessage[],
    cwd: string,
    eventCb: (e: AgentEvent) => void,
  ): Promise<void> {
    const sessionId = conversationHistory.length > 0
      ? (conversationHistory[conversationHistory.length - 1] as any).__sessionId ?? randomUUID()
      : randomUUID();

    // 新的一轮 agent run，重置文件写入跟踪
    resetWrittenFileTracking();
    configureToolCache(config);

    // 累加器：跨迭代累积上下文总消耗
    let accumulatedTotalTokens = 0;
    let accumulatedCachedTokens = 0;

    const handle: RunningAgent = { sessionId, cancelled: false };
    this.agents.set(sessionId, handle);

    const messages: ChatMessage[] = conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system' | 'tool',
      content: m.content,
      tool_calls: m.tool_calls,
      tool_call_id: m.tool_call_id,
    }));

    const MAX_ITERATIONS = 20;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      if (handle.cancelled) {
        eventCb({ type: 'error', data: 'Agent cancelled', ts: Date.now() });
        break;
      }

      try {
        const result = await this.callAPI(config, messages, cwd, handle, eventCb);

        accumulatedCachedTokens += result.cachedTokens;

        // 计算本次迭代的上下文占用（分段估算）
        const estimateTokens = (text?: string) => Math.ceil((text || '').length / 4);
        const systemEstimate = estimateTokens(config.systemPrompt) + estimateTokens(cwd) + 32;
        const breakdown = {
          system: systemEstimate,
          history: messages.filter(m => m.role !== 'tool').reduce((s, m) => s + estimateTokens(m.content as string), 0),
          toolDefs: estimateTokens(JSON.stringify(TOOL_DEFINITIONS)),
          toolResults: messages.filter(m => m.role === 'tool').reduce((s, m) => s + estimateTokens(m.content), 0),
          currentOutput: estimateTokens(result.textContent)
            + estimateTokens(result.thinkingContent)
            + result.toolCalls.reduce((s, tc) => s + estimateTokens(tc.arguments), 0),
        };
        const iterTotal = Object.values(breakdown).reduce((a, b) => a + b, 0);
        accumulatedTotalTokens += iterTotal;

        const promptTokens = result.promptTokens || (iterTotal - breakdown.currentOutput);
        const cacheHitRate = promptTokens > 0
          ? Math.min(100, (result.cachedTokens / promptTokens) * 100)
          : accumulatedCachedTokens > 0
            ? Math.min(100, (accumulatedCachedTokens / accumulatedTotalTokens) * 100)
            : 0;

        // 发送上下文使用事件（含分段明细 + 累计数 + 缓存统计）
        eventCb({
          type: 'context_usage',
          data: '',
          ts: Date.now(),
          usage: {
            promptTokens: iterTotal - breakdown.currentOutput,
            completionTokens: breakdown.currentOutput,
            totalTokens: accumulatedTotalTokens,
            maxContextTokens: config.maxContextTokens ?? 200000,
            breakdown,
            cachedTokens: result.cachedTokens,
            cacheHitRate: Math.round(cacheHitRate * 10) / 10,
            toolCacheHits: result.toolCacheHits,
            toolCacheMisses: result.toolCacheMisses,
          },
        });

        if (result.toolCalls.length === 0) {
          eventCb({ type: 'done', ts: Date.now() });
          break;
        }

        // 添加 assistant 消息（含 tool_calls 和思考内容）
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: result.textContent || undefined,
          tool_calls: result.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
        // 如果有思考内容，附加到消息中（部分 API 支持回传）
        if (result.thinkingContent) {
          (assistantMsg as any).reasoning_content = result.thinkingContent;
        }
        messages.push(assistantMsg);

        // 执行每个 tool call
        for (const tc of result.toolCalls) {
          if (handle.cancelled) break;

          // 归一化工具名（部分模型会发送非标准名称）
          tc.name = normalizeToolName(tc.name);

          eventCb({ type: 'tool_call_start', toolCall: tc, ts: Date.now() });

          const { output, isError, fileSnapshot } = await executeTool(tc.name, tc.arguments, cwd);

          const toolResult: ToolResult = {
            toolCallId: tc.id,
            name: tc.name,
            output,
            isError,
            fileSnapshot,
          };

          eventCb({ type: 'tool_result', toolResult, ts: Date.now() });

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: output,
          });
        }

        if (handle.cancelled) {
          eventCb({ type: 'done', ts: Date.now() });
          break;
        }
      } catch (err) {
        eventCb({ type: 'error', data: (err as Error).message, ts: Date.now() });
        eventCb({ type: 'done', ts: Date.now() });
        break;
      }
    }

    this.agents.delete(sessionId);
  }

  cancel(sessionId: string): boolean {
    const handle = this.agents.get(sessionId);
    if (!handle) return false;
    handle.cancelled = true;
    if (handle.req) {
      handle.req.destroy();
    }
    return true;
  }

  cancelAll(): void {
    for (const h of this.agents.values()) {
      h.cancelled = true;
      if (h.req) h.req.destroy();
    }
    this.agents.clear();
  }

  private callAPI(
    config: AgentConfig,
    messages: ChatMessage[],
    cwd: string,
    handle: RunningAgent,
    eventCb: (e: AgentEvent) => void,
  ): Promise<{
    textContent: string;
    thinkingContent: string;
    toolCalls: ToolCallInfo[];
    cachedTokens: number;
    promptTokens: number;
    toolCacheHits: number;
    toolCacheMisses: number;
  }> {
    return new Promise((resolve, reject) => {
      const baseUrl = config.baseUrl.replace(/\/+$/, '');
      const urlStr = `${baseUrl}/chat/completions`;
      let url: URL;
      try {
        url = new URL(urlStr);
      } catch {
        reject(new Error(`Invalid base URL: ${urlStr}`));
        return;
      }

      const apiMessages = buildCacheOptimizedMessages(config, messages, cwd);
      const bodyObj = buildApiRequestBody(config, apiMessages, cwd);
      const body = JSON.stringify(bodyObj);

      const isHttps = url.protocol === 'https:';
      const transport = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      };

      let textContent = '';
      let thinkingContent = '';
      const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();
      let buffer = '';
      let cachedTokens = 0;
      let promptTokens = 0;

      const req = transport.request(options, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          let errorBody = '';
          res.on('data', (chunk) => (errorBody += chunk.toString()));
          res.on('end', () => {
            let msg = `API error ${res.statusCode}`;
            try {
              const parsed = JSON.parse(errorBody);
              msg = parsed.error?.message || parsed.message || msg;
            } catch {
              if (errorBody) msg += `: ${errorBody.slice(0, 200)}`;
            }
            reject(new Error(msg));
          });
          return;
        }

        res.on('data', (chunk: Buffer) => {
          if (handle.cancelled) return;
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.slice(6);
            if (jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);

              // 流式 usage（OpenAI stream_options.include_usage）
              if (parsed.usage) {
                cachedTokens = extractCachedTokens(parsed.usage as Record<string, unknown>);
                promptTokens = extractPromptTokens(parsed.usage as Record<string, unknown>);
              }

              const delta = parsed.choices?.[0]?.delta;
              if (!delta) continue;

              // 文本增量
              if (delta.content) {
                textContent += delta.content;
                eventCb({ type: 'text_delta', data: delta.content, ts: Date.now() });
              }

              // 思考/推理增量（DeepSeek: reasoning_content, 其他: thinking）
              const reasoning = delta.reasoning_content ?? delta.thinking ?? null;
              if (reasoning) {
                thinkingContent += reasoning;
                eventCb({ type: 'thinking_delta', data: reasoning, ts: Date.now() });
              }

              // 工具调用增量
              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index;
                  if (!toolCallsMap.has(idx)) {
                    toolCallsMap.set(idx, {
                      id: tc.id ?? `tc_${randomUUID().slice(0, 8)}`,
                      name: tc.function?.name ?? '',
                      arguments: '',
                    });
                  }
                  const existing = toolCallsMap.get(idx)!;
                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) existing.name = tc.function.name;
                  if (tc.function?.arguments) existing.arguments += tc.function.arguments;

                  // 流式推送 tool call 参数（用于 write_file 实时预览）
                  if (existing.name || existing.arguments) {
                    eventCb({
                      type: 'tool_call_delta',
                      toolCall: {
                        id: existing.id,
                        name: existing.name,
                        arguments: existing.arguments,
                      },
                      ts: Date.now(),
                    });
                  }
                }
              }
            } catch {
              // 跳过解析失败的行
            }
          }
        });

        res.on('end', () => {
          const toolCalls = Array.from(toolCallsMap.values()).map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          }));
          const toolStats = globalToolCache.getStats();
          resolve({
            textContent,
            thinkingContent,
            toolCalls,
            cachedTokens,
            promptTokens,
            toolCacheHits: toolStats.hits,
            toolCacheMisses: toolStats.misses,
          });
        });
      });

      req.on('error', (err) => {
        reject(new Error(`API request failed: ${err.message}`));
      });

      handle.req = req;
      req.write(body);
      req.end();
    });
  }
}
