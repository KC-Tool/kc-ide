// 推理增强策略
// 负责增强模型的推理能力，包括思维链、多角度分析、假设验证等

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface ReasoningEnhancementConfig {
  chainOfThought: {
    enabled: boolean;
    template: string;
    steps: number;
  };
  multiPerspective: {
    enabled: boolean;
    perspectives: string[];
    synthesis: boolean;
  };
  reasoningEffort: {
    level: ReasoningEffort;
    maxTokens: number;
  };
  hypothesisVerification: {
    enabled: boolean;
    maxHypotheses: number;
  };
  analogicalReasoning: {
    enabled: boolean;
    similarityThreshold: number;
  };
}

export interface ThinkingStep {
  step: number;
  content: string;
  reasoning: string;
}

export interface Perspective {
  name: string;
  viewpoint: string;
  analysis: string;
}

export interface Hypothesis {
  statement: string;
  likelihood: number;
  evidence: string[];
}

export class ReasoningEnhancement {
  constructor(private config: ReasoningEnhancementConfig) {}

  generateChainOfThoughtPrompt(task: string, context: string): string {
    if (!this.config.chainOfThought.enabled) {
      return task;
    }

    const template = this.config.chainOfThought.template;
    const steps = this.config.chainOfThought.steps;

    return template
      .replace('{task}', task)
      .replace('{context}', context)
      .replace('{steps}', steps.toString());
  }

  generateMultiPerspectivePrompt(task: string): string {
    if (!this.config.multiPerspective.enabled) {
      return task;
    }

    const perspectives = this.config.multiPerspective.perspectives;
    const synthesis = this.config.multiPerspective.synthesis;

    let prompt = task + '\n\n';
    prompt += 'Please analyze this task from multiple perspectives:\n';
    
    perspectives.forEach((perspective, index) => {
      prompt += `${index + 1}. ${perspective}\n`;
    });

    if (synthesis) {
      prompt += '\nAfter analyzing from each perspective, provide a synthesis that combines the insights from all viewpoints.\n';
    }

    return prompt;
  }

  generateReasoningEffortPrompt(task: string): string {
    const level = this.config.reasoningEffort.level;
    const maxTokens = this.config.reasoningEffort.maxTokens;

    let prompt = task;

    switch (level) {
      case 'low':
        prompt += '\n\nProvide a concise response focusing on the most important aspects.';
        break;
      case 'medium':
        prompt += '\n\nProvide a balanced response with reasonable detail and explanation.';
        break;
      case 'high':
        prompt += `\n\nProvide a comprehensive response with deep analysis, multiple considerations, and thorough explanation. Use up to ${maxTokens} tokens if needed for detailed reasoning.`;
        break;
    }

    return prompt;
  }

  generateHypothesisVerificationPrompt(task: string): string {
    if (!this.config.hypothesisVerification.enabled) {
      return task;
    }

    const maxHypotheses = this.config.hypothesisVerification.maxHypotheses;

    return `${task}\n\nBefore providing your final answer, please:
1. Generate ${maxHypotheses} possible hypotheses or approaches
2. Evaluate the likelihood and evidence for each hypothesis
3. Test the most promising hypothesis
4. Report your findings and conclusion`;
  }

  generateAnalogicalReasoningPrompt(task: string, context: string): string {
    if (!this.config.analogicalReasoning.enabled) {
      return task;
    }

    return `${task}\n\nWhen solving this problem, consider:
1. Similar problems you've encountered before
2. Analogous situations or patterns
3. Transferable solutions from other domains
4. How the reasoning from similar cases might apply here

Context: ${context}`;
  }

  parseThinkingSteps(content: string): ThinkingStep[] {
    const steps: ThinkingStep[] = [];
    const stepPattern = /(?:Step\s*(\d+)|(\d+)\.)\s*[:.]?\s*(.+?)(?=(?:Step\s*\d+|\d+\.|$))/gs;
    
    let match;
    while ((match = stepPattern.exec(content)) !== null) {
      const stepNum = parseInt(match[1] || match[2]);
      const content = match[3].trim();
      
      steps.push({
        step: stepNum,
        content,
        reasoning: content,
      });
    }

    return steps;
  }

  extractPerspectives(content: string): Perspective[] {
    const perspectives: Perspective[] = [];
    const perspectivePattern = /(?:Perspective|Viewpoint)\s*(\d+)[:.]?\s*(.+?)[:.]\s*(.+?)(?=(?:Perspective|Viewpoint)\s*\d+|$)/gs;
    
    let match;
    while ((match = perspectivePattern.exec(content)) !== null) {
      const index = parseInt(match[1]);
      const name = match[2].trim();
      const analysis = match[3].trim();
      
      perspectives.push({
        name,
        viewpoint: name,
        analysis,
      });
    }

    return perspectives;
  }

  extractHypotheses(content: string): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    const hypothesisPattern = /(?:Hypothesis)\s*(\d+)[:.]?\s*(.+?)(?=(?:Hypothesis)\s*\d+|$)/gs;
    
    let match;
    while ((match = hypothesisPattern.exec(content)) !== null) {
      const index = parseInt(match[1]);
      const statement = match[2].trim();
      
      hypotheses.push({
        statement,
        likelihood: 0.5, // 默认值，需要从内容中提取
        evidence: [],
      });
    }

    return hypotheses;
  }

  evaluateThinkingQuality(thinkingSteps: ThinkingStep[]): {
    completeness: number;
    logicalFlow: number;
    depth: number;
  } {
    if (thinkingSteps.length === 0) {
      return { completeness: 0, logicalFlow: 0, depth: 0 };
    }

    const completeness = Math.min(thinkingSteps.length / this.config.chainOfThought.steps, 1);
    
    let logicalFlow = 1;
    for (let i = 1; i < thinkingSteps.length; i++) {
      const prevStep = thinkingSteps[i - 1];
      const currentStep = thinkingSteps[i];
      
      // 简化的逻辑流检查
      if (currentStep.step !== prevStep.step + 1) {
        logicalFlow *= 0.9;
      }
    }

    const depth = thinkingSteps.reduce((sum, step) => {
      return sum + (step.content.length > 100 ? 1 : 0.5);
    }, 0) / thinkingSteps.length;

    return {
      completeness,
      logicalFlow,
      depth,
    };
  }

  generateEnhancedPrompt(task: string, context: string): string {
    let prompt = task;

    // 应用推理强度
    prompt = this.generateReasoningEffortPrompt(prompt);

    // 应用思维链
    prompt = this.generateChainOfThoughtPrompt(prompt, context);

    // 应用多角度分析
    prompt = this.generateMultiPerspectivePrompt(prompt);

    // 应用假设验证
    prompt = this.generateHypothesisVerificationPrompt(prompt);

    // 应用类比推理
    prompt = this.generateAnalogicalReasoningPrompt(prompt, context);

    return prompt;
  }

  getDefaultConfig(): ReasoningEnhancementConfig {
    return {
      chainOfThought: {
        enabled: true,
        template: `{task}\n\nContext: {context}\n\nPlease think through this step by step:\n1. First, understand the problem\n2. Then, identify the key requirements\n3. Next, consider possible approaches\n4. Evaluate each approach\n5. Choose the best approach\n6. Implement the solution\n7. Verify the result`,
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
    };
  }
}
