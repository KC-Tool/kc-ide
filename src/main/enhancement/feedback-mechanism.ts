// 反馈机制策略
// 负责提供实时反馈、结果验证、错误纠正和用户确认机制

export interface RealTimeFeedbackConfig {
  progressUpdates: boolean;
  intermediateResults: boolean;
  thinkingProcess: boolean;
  toolExecution: boolean;
  contextUsage: boolean;
}

export interface ResultValidationConfig {
  enabled: boolean;
  validators: Validator[];
  autoCorrection: boolean;
  validationThreshold: number;
}

export interface UserConfirmationConfig {
  requiredActions: string[];
  confirmationThreshold: 'low' | 'medium' | 'high';
  timeout: number;
  fallbackAction: 'proceed' | 'abort' | 'retry';
}

export interface FeedbackMechanismConfig {
  realTimeFeedback: RealTimeFeedbackConfig;
  resultValidation: ResultValidationConfig;
  userConfirmation: UserConfirmationConfig;
}

export interface Validator {
  name: string;
  validate: (result: any) => ValidationResult;
  priority: number;
}

export interface ValidationResult {
  valid: boolean;
  confidence: number;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface ProgressUpdate {
  step: number;
  totalSteps: number;
  message: string;
  percentage: number;
}

export interface IntermediateResult {
  stage: string;
  result: any;
  timestamp: number;
}

export class FeedbackMechanism {
  private progressCallbacks: Map<string, (update: ProgressUpdate) => void> = new Map();
  private resultCallbacks: Map<string, (result: IntermediateResult) => void> = new Map();
  private validationHistory: ValidationResult[] = [];

  constructor(private config: FeedbackMechanismConfig) {
    this.initializeDefaultValidators();
  }

  private initializeDefaultValidators(): void {
    const defaultValidators: Validator[] = [
      {
        name: 'syntax',
        priority: 1,
        validate: (result: any) => this.validateSyntax(result),
      },
      {
        name: 'completeness',
        priority: 2,
        validate: (result: any) => this.validateCompleteness(result),
      },
      {
        name: 'safety',
        priority: 3,
        validate: (result: any) => this.validateSafety(result),
      },
    ];

    this.config.resultValidation.validators = defaultValidators;
  }

  private validateSyntax(result: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (typeof result === 'string') {
      // 检查语法错误
      if (result.includes('```') && !result.includes('```')) {
        errors.push('Unclosed code block');
      }

      // 检查常见的语法模式
      if (result.match(/\b(function|class|if|for|while)\s*$/)) {
        warnings.push('Possible incomplete code block');
      }
    }

    return {
      valid: errors.length === 0,
      confidence: errors.length === 0 ? 1 : 0.5,
      errors,
      warnings,
      suggestions,
    };
  }

  private validateCompleteness(result: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (typeof result === 'string') {
      // 检查是否为空
      if (result.trim().length === 0) {
        errors.push('Result is empty');
      }

      // 检查是否过短
      if (result.length < 50) {
        warnings.push('Result may be incomplete or too brief');
      }

      // 检查是否有截断迹象
      if (result.endsWith('...') || result.endsWith('…')) {
        warnings.push('Result may be truncated');
      }
    }

    return {
      valid: errors.length === 0,
      confidence: errors.length === 0 ? 1 : 0.7,
      errors,
      warnings,
      suggestions,
    };
  }

  private validateSafety(result: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (typeof result === 'string') {
      // 检查危险操作
      const dangerousPatterns = [
        /rm\s+-rf/,
        /del\s+\/s/,
        /format\s+c:/,
        /DROP\s+TABLE/,
        /DELETE\s+FROM/,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(result)) {
          errors.push(`Dangerous operation detected: ${pattern}`);
        }
      }

      // 检查敏感信息
      const sensitivePatterns = [
        /password\s*[:=]\s*\S+/i,
        /api[_-]?key\s*[:=]\s*\S+/i,
        /secret\s*[:=]\s*\S+/i,
      ];

      for (const pattern of sensitivePatterns) {
        if (pattern.test(result)) {
          warnings.push('Possible sensitive information detected');
        }
      }
    }

    return {
      valid: errors.length === 0,
      confidence: errors.length === 0 ? 1 : 0.3,
      errors,
      warnings,
      suggestions,
    };
  }

  registerProgressCallback(id: string, callback: (update: ProgressUpdate) => void): void {
    this.progressCallbacks.set(id, callback);
  }

  registerResultCallback(id: string, callback: (result: IntermediateResult) => void): void {
    this.resultCallbacks.set(id, callback);
  }

  sendProgressUpdate(update: ProgressUpdate): void {
    if (this.config.realTimeFeedback.progressUpdates) {
      for (const callback of this.progressCallbacks.values()) {
        callback(update);
      }
    }
  }

  sendIntermediateResult(result: IntermediateResult): void {
    if (this.config.realTimeFeedback.intermediateResults) {
      for (const callback of this.resultCallbacks.values()) {
        callback(result);
      }
    }
  }

  validateResult(result: any): ValidationResult {
    if (!this.config.resultValidation.enabled) {
      return {
        valid: true,
        confidence: 1,
        errors: [],
        warnings: [],
        suggestions: [],
      };
    }

    const sortedValidators = [...this.config.resultValidation.validators].sort((a, b) => a.priority - b.priority);
    
    let overallValid = true;
    let overallConfidence = 1;
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    const allSuggestions: string[] = [];

    for (const validator of sortedValidators) {
      const validation = validator.validate(result);
      
      if (!validation.valid) {
        overallValid = false;
      }

      overallConfidence = Math.min(overallConfidence, validation.confidence);
      allErrors.push(...validation.errors);
      allWarnings.push(...validation.warnings);
      allSuggestions.push(...validation.suggestions);
    }

    const validationResult: ValidationResult = {
      valid: overallValid,
      confidence: overallConfidence,
      errors: allErrors,
      warnings: allWarnings,
      suggestions: allSuggestions,
    };

    this.validationHistory.push(validationResult);

    // 自动纠正
    if (!overallValid && this.config.resultValidation.autoCorrection) {
      const corrected = this.autoCorrect(result, validationResult);
      if (corrected !== result) {
        allSuggestions.push('Auto-correction applied');
      }
    }

    return validationResult;
  }

  private autoCorrect(result: any, validation: ValidationResult): any {
    if (typeof result !== 'string') {
      return result;
    }

    let corrected = result;

    // 修复未闭合的代码块
    if (validation.errors.includes('Unclosed code block')) {
      corrected = corrected + '\n```';
    }

    // 移除截断标记
    if (corrected.endsWith('...') || corrected.endsWith('…')) {
      corrected = corrected.slice(0, -3);
    }

    return corrected;
  }

  checkConfirmationRequired(action: string): boolean {
    const threshold = this.config.userConfirmation.confirmationThreshold;
    const requiredActions = this.config.userConfirmation.requiredActions;

    if (threshold === 'low') {
      return false;
    }

    if (threshold === 'high') {
      return true;
    }

    // medium threshold: check against required actions
    return requiredActions.some(required => 
      action.toLowerCase().includes(required.toLowerCase())
    );
  }

  requestConfirmation(action: string, details: string): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = this.config.userConfirmation.timeout;
      
      // 在实际实现中，这里会显示一个UI对话框
      // 这里我们使用超时和fallback action
      const timer = setTimeout(() => {
        const fallback = this.config.userConfirmation.fallbackAction;
        resolve(fallback === 'proceed');
      }, timeout);

      // 模拟用户确认（实际中需要UI交互）
      setTimeout(() => {
        clearTimeout(timer);
        resolve(true); // 默认允许
      }, 100);
    });
  }

  generateFeedbackPrompt(): string {
    const feedbackInstructions: string[] = [];

    feedbackInstructions.push('Feedback and Validation Requirements:');

    if (this.config.realTimeFeedback.progressUpdates) {
      feedbackInstructions.push('- Provide progress updates for multi-step tasks');
    }

    if (this.config.realTimeFeedback.intermediateResults) {
      feedbackInstructions.push('- Show intermediate results when appropriate');
    }

    if (this.config.realTimeFeedback.thinkingProcess) {
      feedbackInstructions.push('- Explain your thinking process clearly');
    }

    if (this.config.realTimeFeedback.toolExecution) {
      feedbackInstructions.push('- Report tool execution status and results');
    }

    if (this.config.realTimeFeedback.contextUsage) {
      feedbackInstructions.push('- Monitor and report context usage');
    }

    if (this.config.resultValidation.enabled) {
      feedbackInstructions.push('- Validate your results before final submission');
      feedbackInstructions.push('- Check for syntax errors, completeness, and safety issues');
    }

    if (this.config.resultValidation.autoCorrection) {
      feedbackInstructions.push('- Apply auto-correction when validation fails');
    }

    if (this.config.userConfirmation.confirmationThreshold !== 'low') {
      feedbackInstructions.push('- Request confirmation for important operations');
    }

    return feedbackInstructions.join('\n');
  }

  getValidationHistory(): ValidationResult[] {
    return [...this.validationHistory];
  }

  clearValidationHistory(): void {
    this.validationHistory = [];
  }

  getDefaultConfig(): FeedbackMechanismConfig {
    return {
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
    };
  }
}
