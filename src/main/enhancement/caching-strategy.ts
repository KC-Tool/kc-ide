// 缓存策略
// 负责多层缓存管理，优化API调用和工具执行性能

export interface ApiCacheConfig {
  enabled: boolean;
  strategy: 'prefix' | 'full';
  ttl: number;
  maxSize: number;
  compression: boolean;
}

export interface ToolCacheConfig {
  enabled: boolean;
  strategy: 'lru' | 'lfu' | 'ttl';
  maxSize: number;
  ttl: number;
  compression: boolean;
}

export interface ContextCacheConfig {
  enabled: boolean;
  strategy: 'semantic' | 'exact';
  maxSize: number;
  ttl: number;
}

export interface CachingStrategyConfig {
  apiCache: ApiCacheConfig;
  toolCache: ToolCacheConfig;
  contextCache: ContextCacheConfig;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
}

export class CacheManager<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];
  private frequency: Map<string, number> = new Map();

  constructor(
    private maxSize: number,
    private ttl: number,
    private strategy: 'lru' | 'lfu' | 'ttl'
  ) {}

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // 检查TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.removeAccessOrder(key);
      return null;
    }

    // 更新访问统计
    entry.hits++;
    this.updateAccessOrder(key);
    this.frequency.set(key, (this.frequency.get(key) || 0) + 1);

    return entry.value;
  }

  set(key: string, value: T, size: number = 1): void {
    // 检查是否超过最大大小
    if (this.cache.size >= this.maxSize) {
      this.evict();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: this.ttl,
      hits: 0,
      size,
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  has(key: string): boolean {
    return this.cache.has(key) && this.get(key) !== null;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.removeAccessOrder(key);
    this.frequency.delete(key);
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.frequency.clear();
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private removeAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private evict(): void {
    switch (this.strategy) {
      case 'lru':
        this.evictLRU();
        break;
      case 'lfu':
        this.evictLFU();
        break;
      case 'ttl':
        this.evictTTL();
        break;
    }
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    
    const lruKey = this.accessOrder[0];
    this.delete(lruKey);
  }

  private evictLFU(): void {
    let lfuKey: string | null = null;
    let minFrequency = Infinity;

    for (const [key, freq] of this.frequency.entries()) {
      if (freq < minFrequency) {
        minFrequency = freq;
        lfuKey = key;
      }
    }

    if (lfuKey) {
      this.delete(lfuKey);
    }
  }

  private evictTTL(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
    }

    const totalAccesses = totalHits + (this.cache.size * 2); // 简化计算
    const hitRate = totalAccesses > 0 ? totalHits / totalAccesses : 0;

    return {
      size: this.cache.size,
      hits: totalHits,
      misses: this.cache.size * 2, // 简化计算
      hitRate,
    };
  }
}

export class CachingStrategy {
  private apiCache: CacheManager<string>;
  private toolCache: CacheManager<any>;
  private contextCache: CacheManager<string>;

  constructor(private config: CachingStrategyConfig) {
    this.apiCache = new CacheManager(
      config.apiCache.maxSize,
      config.apiCache.ttl,
      'lru'
    );

    this.toolCache = new CacheManager(
      config.toolCache.maxSize,
      config.toolCache.ttl,
      config.toolCache.strategy
    );

    this.contextCache = new CacheManager(
      config.contextCache.maxSize,
      config.contextCache.ttl,
      'lru'
    );
  }

  // API缓存
  cacheApiResponse(key: string, response: string): void {
    if (!this.config.apiCache.enabled) return;

    const cacheKey = this.generateApiCacheKey(key);
    this.apiCache.set(cacheKey, response);
  }

  getCachedApiResponse(key: string): string | null {
    if (!this.config.apiCache.enabled) return null;

    const cacheKey = this.generateApiCacheKey(key);
    return this.apiCache.get(cacheKey);
  }

  private generateApiCacheKey(key: string): string {
    if (this.config.apiCache.strategy === 'prefix') {
      // 使用前缀策略：只缓存请求的前缀部分
      const parts = key.split('\n');
      return parts.slice(0, 3).join('\n');
    }
    return key;
  }

  // 工具缓存
  cacheToolResult(toolName: string, parameters: any, result: any): void {
    if (!this.config.toolCache.enabled) return;

    const cacheKey = this.generateToolCacheKey(toolName, parameters);
    const size = JSON.stringify(result).length;
    this.toolCache.set(cacheKey, result, size);
  }

  getCachedToolResult(toolName: string, parameters: any): any | null {
    if (!this.config.toolCache.enabled) return null;

    const cacheKey = this.generateToolCacheKey(toolName, parameters);
    return this.toolCache.get(cacheKey);
  }

  private generateToolCacheKey(toolName: string, parameters: any): string {
    const paramsStr = JSON.stringify(parameters);
    return `${toolName}:${paramsStr}`;
  }

  // 上下文缓存
  cacheContext(context: string, compressed: string): void {
    if (!this.config.contextCache.enabled) return;

    const cacheKey = this.generateContextCacheKey(context);
    this.contextCache.set(cacheKey, compressed);
  }

  getCachedContext(context: string): string | null {
    if (!this.config.contextCache.enabled) return null;

    const cacheKey = this.generateContextCacheKey(context);
    return this.contextCache.get(cacheKey);
  }

  private generateContextCacheKey(context: string): string {
    if (this.config.contextCache.strategy === 'semantic') {
      // 语义策略：使用上下文的语义哈希
      return this.semanticHash(context);
    }
    return context;
  }

  private semanticHash(text: string): string {
    // 简化的语义哈希：提取关键词
    const words = text.toLowerCase().split(/\s+/);
    const keywords = words.filter(word => word.length > 3);
    const uniqueKeywords = [...new Set(keywords)];
    return uniqueKeywords.slice(0, 10).join(':');
  }

  // 缓存统计
  getCacheStats(): {
    apiCache: ReturnType<CacheManager<string>['getStats']>;
    toolCache: ReturnType<CacheManager<any>['getStats']>;
    contextCache: ReturnType<CacheManager<string>['getStats']>;
  } {
    return {
      apiCache: this.apiCache.getStats(),
      toolCache: this.toolCache.getStats(),
      contextCache: this.contextCache.getStats(),
    };
  }

  // 缓存清理
  clearApiCache(): void {
    this.apiCache.clear();
  }

  clearToolCache(): void {
    this.toolCache.clear();
  }

  clearContextCache(): void {
    this.contextCache.clear();
  }

  clearAllCaches(): void {
    this.clearApiCache();
    this.clearToolCache();
    this.clearContextCache();
  }

  // 缓存预热
  async warmUpApiCache(keys: string[], fetchFn: (key: string) => Promise<string>): Promise<void> {
    if (!this.config.apiCache.enabled) return;

    for (const key of keys) {
      if (!this.apiCache.has(key)) {
        try {
          const response = await fetchFn(key);
          this.cacheApiResponse(key, response);
        } catch (error) {
          console.error(`Failed to warm up cache for key: ${key}`, error);
        }
      }
    }
  }

  // 缓存失效
  invalidateApiCache(pattern: string): void {
    for (const key of this.apiCache['cache'].keys()) {
      if (key.includes(pattern)) {
        this.apiCache.delete(key);
      }
    }
  }

  invalidateToolCache(toolName: string): void {
    for (const key of this.toolCache['cache'].keys()) {
      if (key.startsWith(toolName + ':')) {
        this.toolCache.delete(key);
      }
    }
  }

  // 缓存压缩
  compressData(data: string): string {
    if (!this.config.apiCache.compression) return data;

    // 简化的压缩：移除重复空白
    return data.replace(/\s+/g, ' ').trim();
  }

  decompressData(data: string): string {
    // 简化的解压：恢复基本格式
    return data.replace(/([{};])/g, '$1\n').replace(/;/g, ';\n');
  }

  generateCachePrompt(): string {
    const instructions: string[] = [];

    instructions.push('Caching and Performance Optimization:');

    if (this.config.apiCache.enabled) {
      instructions.push('- API responses are cached to reduce redundant calls');
      instructions.push(`- Cache strategy: ${this.config.apiCache.strategy}`);
      instructions.push(`- Cache TTL: ${this.config.apiCache.ttl}ms`);
    }

    if (this.config.toolCache.enabled) {
      instructions.push('- Tool execution results are cached');
      instructions.push(`- Cache strategy: ${this.config.toolCache.strategy}`);
      instructions.push(`- Cache TTL: ${this.config.toolCache.ttl}ms`);
    }

    if (this.config.contextCache.enabled) {
      instructions.push('- Context is cached and compressed for efficiency');
      instructions.push(`- Cache strategy: ${this.config.contextCache.strategy}`);
    }

    instructions.push('- Leverage caching to improve response times');
    instructions.push('- Cache invalidation occurs automatically based on TTL and size limits');

    return instructions.join('\n');
  }

  getDefaultConfig(): CachingStrategyConfig {
    return {
      apiCache: {
        enabled: true,
        strategy: 'prefix',
        ttl: 300000, // 5 minutes
        maxSize: 1000,
        compression: true,
      },
      toolCache: {
        enabled: true,
        strategy: 'lru',
        ttl: 600000, // 10 minutes
        maxSize: 500,
        compression: true,
      },
      contextCache: {
        enabled: true,
        strategy: 'semantic',
        ttl: 120000, // 2 minutes
        maxSize: 200,
        ttl: 120000,
      },
    };
  }
}
