// 指令优化策略
// 负责优化用户指令，提升模型的理解和执行能力

export interface IntentClassification {
  intent: string;
  confidence: number;
  entities: Map<string, string>;
}

export interface SubTask {
  id: string;
  description: string;
  dependencies: string[];
  estimatedComplexity: number;
}

export interface InstructionOptimizationConfig {
  instructionTemplates: {
    codeGeneration: string;
    codeReview: string;
    debugging: string;
    refactoring: string;
    documentation: string;
  };
  intentRecognition: {
    enabled: boolean;
    confidenceThreshold: number;
    fallbackStrategy: string;
  };
  taskDecomposition: {
    enabled: boolean;
    maxSubtasks: number;
    dependencyAnalysis: boolean;
  };
  instructionClarification: {
    enabled: boolean;
    askForClarification: boolean;
    maxQuestions: number;
  };
}

export class InstructionOptimizer {
  private intentPatterns: Map<string, RegExp[]> = new Map();

  constructor(private config: InstructionOptimizationConfig) {
    this.initializeIntentPatterns();
  }

  private initializeIntentPatterns(): void {
    this.intentPatterns.set('codeGeneration', [
      /write|create|generate|implement|add|build/i,
      /function|class|component|module|feature/i,
      /code|program|script/i,
    ]);

    this.intentPatterns.set('codeReview', [
      /review|analyze|check|examine|audit/i,
      /quality|best.?practice|improvement/i,
      /bug|issue|problem/i,
    ]);

    this.intentPatterns.set('debugging', [
      /debug|fix|repair|solve|resolve/i,
      /error|issue|problem|bug/i,
      /not working|broken|failing/i,
    ]);

    this.intentPatterns.set('refactoring', [
      /refactor|restructure|reorganize|improve/i,
      /clean.?up|optimize|simplify/i,
      /maintainability|readability/i,
    ]);

    this.intentPatterns.set('documentation', [
      /document|explain|describe|comment/i,
      /readme|guide|tutorial/i,
      /how.?to|usage/i,
    ]);
  }

  classifyIntent(instruction: string): IntentClassification {
    if (!this.config.intentRecognition.enabled) {
      return {
        intent: 'general',
        confidence: 0.5,
        entities: new Map(),
      };
    }

    let bestMatch = 'general';
    let highestScore = 0;
    const entities = new Map<string, string>();

    for (const [intent, patterns] of this.intentPatterns.entries()) {
      let score = 0;
      for (const pattern of patterns) {
        const matches = instruction.match(pattern);
        if (matches) {
          score += matches.length;
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = intent;
      }
    }

    const confidence = Math.min(highestScore / 3, 1);

    if (confidence < this.config.intentRecognition.confidenceThreshold) {
      bestMatch = this.config.intentRecognition.fallbackStrategy;
    }

    return {
      intent: bestMatch,
      confidence,
      entities,
    };
  }

  applyInstructionTemplate(instruction: string, intent: string): string {
    const templates = this.config.instructionTemplates;
    const template = templates[intent as keyof typeof templates];

    if (!template) {
      return instruction;
    }

    return template
      .replace('{instruction}', instruction)
      .replace('{context}', this.extractContext(instruction));
  }

  private extractContext(instruction: string): string {
    // 简化的上下文提取
    const contextPatterns = [
      /in\s+(.+?)(?:\s|$)/i,
      /for\s+(.+?)(?:\s|$)/i,
      /with\s+(.+?)(?:\s|$)/i,
    ];

    for (const pattern of contextPatterns) {
      const match = instruction.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return '';
  }

  decomposeTask(instruction: string, intent: string): SubTask[] {
    if (!this.config.taskDecomposition.enabled) {
      return [{
        id: 'main',
        description: instruction,
        dependencies: [],
        estimatedComplexity: 1,
      }];
    }

    const subtasks: SubTask[] = [];

    switch (intent) {
      case 'codeGeneration':
        subtasks.push(
          { id: '1', description: 'Analyze requirements', dependencies: [], estimatedComplexity: 2 },
          { id: '2', description: 'Design solution', dependencies: ['1'], estimatedComplexity: 3 },
          { id: '3', description: 'Implement code', dependencies: ['2'], estimatedComplexity: 5 },
          { id: '4', description: 'Test implementation', dependencies: ['3'], estimatedComplexity: 3 },
        );
        break;

      case 'debugging':
        subtasks.push(
          { id: '1', description: 'Reproduce the issue', dependencies: [], estimatedComplexity: 3 },
          { id: '2', description: 'Analyze error logs', dependencies: ['1'], estimatedComplexity: 2 },
          { id: '3', description: 'Identify root cause', dependencies: ['2'], estimatedComplexity: 4 },
          { id: '4', description: 'Implement fix', dependencies: ['3'], estimatedComplexity: 3 },
          { id: '5', description: 'Verify fix', dependencies: ['4'], estimatedComplexity: 2 },
        );
        break;

      case 'refactoring':
        subtasks.push(
          { id: '1', description: 'Analyze current code', dependencies: [], estimatedComplexity: 2 },
          { id: '2', description: 'Identify improvement areas', dependencies: ['1'], estimatedComplexity: 3 },
          { id: '3', description: 'Plan refactoring', dependencies: ['2'], estimatedComplexity: 2 },
          { id: '4', description: 'Apply refactoring', dependencies: ['3'], estimatedComplexity: 4 },
          { id: '5', description: 'Test changes', dependencies: ['4'], estimatedComplexity: 3 },
        );
        break;

      default:
        subtasks.push({
          id: 'main',
          description: instruction,
          dependencies: [],
          estimatedComplexity: 1,
        });
    }

    return subtasks.slice(0, this.config.taskDecomposition.maxSubtasks);
  }

  generateClarificationQuestions(instruction: string, intent: string): string[] {
    if (!this.config.instructionClarification.enabled) {
      return [];
    }

    const questions: string[] = [];

    switch (intent) {
      case 'codeGeneration':
        questions.push(
          'What specific functionality should be implemented?',
          'Are there any specific requirements or constraints?',
          'Which file or module should this code be added to?',
        );
        break;

      case 'debugging':
        questions.push(
          'What error message or behavior are you experiencing?',
          'When did this issue start occurring?',
          'What changes were made before the issue appeared?',
        );
        break;

      case 'refactoring':
        questions.push(
          'What specific improvements are you looking for?',
          'Are there any performance concerns?',
          'Should the refactoring maintain backward compatibility?',
        );
        break;
    }

    return questions.slice(0, this.config.instructionClarification.maxQuestions);
  }

  optimizeInstruction(instruction: string): {
    optimizedInstruction: string;
    intent: IntentClassification;
    subtasks: SubTask[];
    clarificationQuestions: string[];
  } {
    const intent = this.classifyIntent(instruction);
    const optimizedInstruction = this.applyInstructionTemplate(instruction, intent.intent);
    const subtasks = this.decomposeTask(instruction, intent.intent);
    const clarificationQuestions = this.generateClarificationQuestions(instruction, intent.intent);

    return {
      optimizedInstruction,
      intent,
      subtasks,
      clarificationQuestions,
    };
  }

  getDefaultConfig(): InstructionOptimizationConfig {
    return {
      instructionTemplates: {
        codeGeneration: `{instruction}\n\nPlease follow these steps:\n1. Understand the requirements clearly\n2. Design a clean, maintainable solution\n3. Write well-documented code\n4. Include error handling\n5. Add appropriate tests\n6. Follow the project's coding conventions`,
        codeReview: `{instruction}\n\nPlease review the code focusing on:\n1. Code quality and readability\n2. Potential bugs or issues\n3. Performance considerations\n4. Security vulnerabilities\n5. Adherence to best practices\n6. Suggestions for improvement`,
        debugging: `{instruction}\n\nPlease help debug by:\n1. Analyzing the error or issue\n2. Identifying the root cause\n3. Proposing a solution\n4. Implementing the fix\n5. Verifying the fix works`,
        refactoring: `{instruction}\n\nPlease refactor the code to:\n1. Improve readability\n2. Enhance maintainability\n3. Optimize performance where appropriate\n4. Follow best practices\n5. Preserve existing functionality`,
        documentation: `{instruction}\n\nPlease provide documentation that:\n1. Clearly explains the purpose\n2. Describes the usage\n3. Includes examples\n4. Notes any important considerations\n5. Follows standard documentation format`,
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
    };
  }
}
