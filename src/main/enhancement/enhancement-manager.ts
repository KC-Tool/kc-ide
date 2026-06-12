// 增强管理器
// 负责整合所有优化策略，提供统一的接口给Agent引擎使用

import { ContextEnhancement, type ContextEnhancementConfig } from './context-enhancement.js';
import { ReasoningEnhancement, type ReasoningEnhancementConfig } from './reasoning-enhancement.js';
import { InstructionOptimizer, type InstructionOptimizationConfig } from './instruction-optimization.js';
import { ConstraintManager, type ConstraintManagementConfig } from './constraint-management.js';
import { FeedbackMechanism, type FeedbackMechanismConfig } from './feedback-mechanism.js';
import { CachingStrategy, type CachingStrategyConfig } from './caching-strategy.js';
import { EnhancedSystemPrompt, type SystemPromptConfig } from './enhanced-system-prompt.js';
import { CodeInsertionStrategy, type CodeInsertionStrategyConfig } from './code-insertion-strategy.js';

export interface EnhancementManagerConfig {
  contextEnhancement: ContextEnhancementConfig;
  reasoningEnhancement: ReasoningEnhancementConfig;
  instructionOptimization: InstructionOptimizationConfig;
  constraintManagement: ConstraintManagementConfig;
  feedbackMechanism: FeedbackMechanismConfig;
  cachingStrategy: CachingStrategyConfig;
  codeInsertion: CodeInsertionStrategyConfig;
  systemPrompt: SystemPromptConfig;
}

export interface EnhancementResult {
  enhancedPrompt: string;
  optimizedInstruction: string;
  constraints: string;
  feedback: string;
  cacheInfo: string;
}

export class EnhancementManager {
  private contextEnhancement: ContextEnhancement;
  private reasoningEnhancement: ReasoningEnhancement;
  private instructionOptimizer: InstructionOptimizer;
  private constraintManager: ConstraintManager;
  private feedbackMechanism: FeedbackMechanism;
  private cachingStrategy: CachingStrategy;
  private codeInsertionStrategy: CodeInsertionStrategy;
  private systemPromptGenerator: EnhancedSystemPrompt;

  constructor(config: EnhancementManagerConfig) {
    this.contextEnhancement = new ContextEnhancement(config.contextEnhancement);
    this.reasoningEnhancement = new ReasoningEnhancement(config.reasoningEnhancement);
    this.instructionOptimizer = new InstructionOptimizer(config.instructionOptimization);
    this.constraintManager = new ConstraintManager(config.constraintManagement);
    this.feedbackMechanism = new FeedbackMechanism(config.feedbackMechanism);
    this.cachingStrategy = new CachingStrategy(config.cachingStrategy);
    this.codeInsertionStrategy = new CodeInsertionStrategy(config.codeInsertion);
    this.systemPromptGenerator = new EnhancedSystemPrompt(config.systemPrompt);
  }

  async initialize(rootPath: string): Promise<void> {
    await this.contextEnhancement.initialize(rootPath);
  }

  // 生成增强的系统提示词
  generateEnhancedSystemPrompt(basePrompt: string): string {
    return this.systemPromptGenerator.generateEnhancedPrompt(basePrompt);
  }

  // 处理用户指令
  processUserInstruction(instruction: string, context: string): EnhancementResult {
    // 指令优化
    const optimizationResult = this.instructionOptimizer.optimizeInstruction(instruction);

    // 推理增强
    const enhancedPrompt = this.reasoningEnhancement.generateEnhancedPrompt(
      optimizationResult.optimizedInstruction,
      context
    );

    // 上下文增强
    const enhancedContext = this.contextEnhancement.generateEnhancedContext(context, instruction);

    // 约束管理
    const constraints = this.constraintManager.generateConstraintPrompt();

    // 反馈机制
    const feedback = this.feedbackMechanism.generateFeedbackPrompt();

    // 缓存策略
    const cacheInfo = this.cachingStrategy.generateCachePrompt();

    return {
      enhancedPrompt,
      optimizedInstruction: optimizationResult.optimizedInstruction,
      constraints,
      feedback,
      cacheInfo,
    };
  }

  // 验证工具调用
  validateToolCall(toolName: string, parameters: any): {
    valid: boolean;
    violations: string[];
  } {
    const result = this.constraintManager.validateToolUsage(toolName, parameters);
    this.constraintManager.recordToolUsage(toolName);

    return {
      valid: result.valid,
      violations: result.violations,
    };
  }

  // 验证输出
  validateOutput(content: string): {
    valid: boolean;
    violations: string[];
    warnings: string[];
    suggestions: string[];
  } {
    return this.constraintManager.validateOutput(content);
  }

  // 应用输出约束
  applyOutputConstraints(content: string): string {
    return this.constraintManager.applyOutputConstraints(content);
  }

  // 验证结果
  validateResult(result: any): {
    valid: boolean;
    confidence: number;
    errors: string[];
    warnings: string[];
  } {
    const validation = this.feedbackMechanism.validateResult(result);
    return {
      valid: validation.valid,
      confidence: validation.confidence,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  // 检查是否需要用户确认
  checkConfirmationRequired(action: string): boolean {
    return this.constraintManager.checkConfirmationRequired(action) ||
           this.feedbackMechanism.checkConfirmationRequired(action);
  }

  // 缓存API响应
  cacheApiResponse(key: string, response: string): void {
    this.cachingStrategy.cacheApiResponse(key, response);
  }

  // 获取缓存的API响应
  getCachedApiResponse(key: string): string | null {
    return this.cachingStrategy.getCachedApiResponse(key);
  }

  // 缓存工具结果
  cacheToolResult(toolName: string, parameters: any, result: any): void {
    this.cachingStrategy.cacheToolResult(toolName, parameters, result);
  }

  // 获取缓存的工具结果
  getCachedToolResult(toolName: string, parameters: any): any | null {
    return this.cachingStrategy.getCachedToolResult(toolName, parameters);
  }

  // 获取相关代码
  getRelevantCode(query: string, maxFiles?: number): string[] {
    return this.contextEnhancement.getRelevantCode(query, maxFiles);
  }

  // 压缩上下文
  compressContext(context: string, targetTokens: number): string {
    return this.contextEnhancement.compressContext(context, targetTokens);
  }

  // 获取上下文统计
  getContextStatistics(): {
    totalFiles: number;
    totalFunctions: number;
    totalClasses: number;
    totalDependencies: number;
  } {
    return this.contextEnhancement.getContextStatistics();
  }

  // 获取缓存统计
  getCacheStats(): {
    apiCache: any;
    toolCache: any;
    contextCache: any;
  } {
    return this.cachingStrategy.getCacheStats();
  }

  // 获取验证历史
  getValidationHistory(): any[] {
    return this.feedbackMechanism.getValidationHistory();
  }

  // 清理资源
  cleanup(): void {
    this.constraintManager.resetOperationHistory();
    this.feedbackMechanism.clearValidationHistory();
    this.cachingStrategy.clearAllCaches();
  }

  // 获取默认配置
  static getDefaultConfig(): EnhancementManagerConfig {
    return {
      contextEnhancement: {
        maxContextTokens: 200000,
        targetUsageRate: 0.8,
        includeProjectStructure: true,
        includeDependencies: true,
        includeKeyFiles: true,
        includeCodeIndex: true,
      },
      reasoningEnhancement: {
        chainOfThought: {
          enabled: true,
          template: '{task}\n\nContext: {context}\n\nPlease think through this step by step:\n1. First, understand the problem\n2. Then, identify the key requirements\n3. Next, consider possible approaches\n4. Evaluate each approach\n5. Choose the best approach\n6. Implement the solution\n7. Verify the result',
          steps: 7,
        },
        multiPerspective: {
          enabled: true,
          perspectives: [
            'Technical feasibility',
            'Performance implications',
            'Security considerations',
            'User experience',
            'Maintainability',
          ],
          synthesis: true,
        },
        reasoningEffort: {
          level: 'medium',
          maxTokens: 8000,
        },
        hypothesisVerification: {
          enabled: true,
          maxHypotheses: 3,
        },
        analogicalReasoning: {
          enabled: true,
          similarityThreshold: 0.7,
        },
      },
      instructionOptimization: {
        instructionTemplates: {
          codeGeneration: '{instruction}\n\nPlease follow these steps:\n1. Understand the requirements clearly\n2. Design a clean, maintainable solution\n3. Write well-documented code\n4. Include error handling\n5. Add appropriate tests\n6. Follow the project\'s coding conventions',
          codeReview: '{instruction}\n\nPlease review the code focusing on:\n1. Code quality and readability\n2. Potential bugs or issues\n3. Performance considerations\n4. Security vulnerabilities\n5. Adherence to best practices\n6. Suggestions for improvement',
          debugging: '{instruction}\n\nPlease help debug by:\n1. Analyzing the error or issue\n2. Identifying the root cause\n3. Proposing a solution\n4. Implementing the fix\n5. Verifying the fix works',
          refactoring: '{instruction}\n\nPlease refactor the code to:\n1. Improve readability\n2. Enhance maintainability\n3. Optimize performance where appropriate\n4. Follow best practices\n5. Preserve existing functionality',
          documentation: '{instruction}\n\nPlease provide documentation that:\n1. Clearly explains the purpose\n2. Describes the usage\n3. Includes examples\n4. Notes any important considerations\n5. Follows standard documentation format',
        },
        intentRecognition: {
          enabled: true,
          confidenceThreshold: 0.3,
          fallbackStrategy: 'general',
        },
        taskDecomposition: {
          enabled: true,
          maxSubtasks: 5,
          dependencyAnalysis: true,
        },
        instructionClarification: {
          enabled: true,
          askForClarification: false,
          maxQuestions: 3,
        },
      },
      constraintManagement: {
        outputConstraints: {
          maxLength: 100000,
          format: 'markdown',
          includeExplanation: true,
          includeComments: true,
        },
        behaviorConstraints: {
          allowedTools: ['read_file', 'write_file', 'list_dir', 'grep', 'glob'],
          forbiddenPaths: ['/etc', '/sys', '/proc', '~/.ssh', '~/.aws'],
          maxFileOperations: 100,
          requireConfirmation: true,
          allowedOperations: ['read', 'write', 'list', 'search'],
          forbiddenOperations: ['delete', 'format', 'wipe'],
        },
        securityConstraints: {
          sandbox: true,
          networkAccess: false,
          fileSystemAccess: 'read-write',
          maxExecutionTime: 30000,
          maxMemoryUsage: 512,
        },
        validationEnabled: true,
        autoCorrection: true,
      },
      feedbackMechanism: {
        realTimeFeedback: {
          progressUpdates: true,
          intermediateResults: true,
          thinkingProcess: true,
          toolExecution: true,
          contextUsage: true,
        },
        resultValidation: {
          enabled: true,
          validators: [],
          autoCorrection: true,
          validationThreshold: 0.8,
        },
        userConfirmation: {
          requiredActions: ['delete', 'remove', 'overwrite', 'format', 'wipe'],
          confirmationThreshold: 'medium',
          timeout: 30000,
          fallbackAction: 'abort',
        },
      },
      cachingStrategy: {
        apiCache: {
          enabled: true,
          strategy: 'prefix',
          ttl: 300000,
          maxSize: 1000,
          compression: true,
        },
        toolCache: {
          enabled: true,
          strategy: 'lru',
          ttl: 600000,
          maxSize: 500,
          compression: true,
        },
        contextCache: {
          enabled: true,
          strategy: 'semantic',
          maxSize: 200,
          ttl: 120000,
        },
      },
      codeInsertion: {
        preferInsertOverWrite: true,
        maxFileSizeForInsert: 100000,
        requireAnchor: true,
        anchorValidation: true,
        conflictResolution: 'ask',
      },
      systemPrompt: {
        includeContextEnhancement: true,
        includeReasoningEnhancement: true,
        includeInstructionOptimization: true,
        includeConstraintManagement: true,
        includeFeedbackMechanism: true,
        includeCachingStrategy: true,
        includeCodeInsertionStrategy: true,
      },
    };
  }
}
