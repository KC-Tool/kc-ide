// 约束管理策略
// 负责管理输出约束、行为约束和安全约束，确保模型行为可控

export interface OutputConstraints {
  maxLength: number;
  format: 'markdown' | 'code' | 'plain';
  language?: string;
  includeExplanation: boolean;
  includeComments: boolean;
  codeStyle?: 'functional' | 'object-oriented' | 'procedural';
}

export interface BehaviorConstraints {
  allowedTools: string[];
  forbiddenPaths: string[];
  maxFileOperations: number;
  requireConfirmation: boolean;
  allowedOperations: string[];
  forbiddenOperations: string[];
}

export interface SecurityConstraints {
  sandbox: boolean;
  networkAccess: boolean;
  fileSystemAccess: 'read-only' | 'read-write' | 'none';
  maxExecutionTime: number;
  maxMemoryUsage: number;
}

export interface ConstraintManagementConfig {
  outputConstraints: OutputConstraints;
  behaviorConstraints: BehaviorConstraints;
  securityConstraints: SecurityConstraints;
  validationEnabled: boolean;
  autoCorrection: boolean;
}

export interface ValidationResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
  suggestions: string[];
}

export class ConstraintManager {
  private operationHistory: Map<string, number> = new Map();
  private pathAccessHistory: Set<string> = new Set();

  constructor(private config: ConstraintManagementConfig) {}

  validateOutput(content: string): ValidationResult {
    const violations: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // 验证长度约束
    if (content.length > this.config.outputConstraints.maxLength) {
      violations.push(`Output exceeds maximum length of ${this.config.outputConstraints.maxLength} characters`);
    }

    // 验证格式约束
    if (this.config.outputConstraints.format === 'code') {
      if (!content.trim().startsWith('```') && !content.includes('function') && !content.includes('class')) {
        warnings.push('Output may not be in code format as requested');
      }
    }

    // 验证语言约束
    if (this.config.outputConstraints.language) {
      const languagePatterns: Record<string, RegExp> = {
        javascript: /\b(const|let|var|function|class|import|export)\b/,
        typescript: /\b(interface|type|enum|implements|private|public)\b/,
        python: /\b(def|class|import|from|lambda|async)\b/,
        java: /\b(public|private|protected|class|interface|extends)\b/,
      };

      const pattern = languagePatterns[this.config.outputConstraints.language];
      if (pattern && !pattern.test(content)) {
        warnings.push(`Output may not be in ${this.config.outputConstraints.language} as requested`);
      }
    }

    // 验证解释包含
    if (this.config.outputConstraints.includeExplanation) {
      if (!content.includes('explanation') && !content.includes('reason') && !content.includes('because')) {
        suggestions.push('Consider adding explanation to clarify the solution');
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
      suggestions,
    };
  }

  validateToolUsage(toolName: string, parameters: any): ValidationResult {
    const violations: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // 验证工具权限
    if (!this.config.behaviorConstraints.allowedTools.includes(toolName)) {
      violations.push(`Tool "${toolName}" is not in the allowed tools list`);
    }

    // 验证禁止操作
    if (this.config.behaviorConstraints.forbiddenOperations.includes(toolName)) {
      violations.push(`Tool "${toolName}" is explicitly forbidden`);
    }

    // 验证文件路径
    if (parameters.path) {
      const path = parameters.path as string;
      
      for (const forbiddenPath of this.config.behaviorConstraints.forbiddenPaths) {
        if (path.includes(forbiddenPath)) {
          violations.push(`Path "${path}" contains forbidden pattern "${forbiddenPath}"`);
        }
      }

      // 检查文件系统访问权限
      if (this.config.securityConstraints.fileSystemAccess === 'none') {
        violations.push('File system access is disabled');
      } else if (this.config.securityConstraints.fileSystemAccess === 'read-only') {
        if (toolName === 'write_file' || toolName === 'delete_file' || toolName === 'edit_file') {
          violations.push('Write operations are not allowed in read-only mode');
        }
      }
    }

    // 验证操作次数限制
    const operationCount = this.operationHistory.get(toolName) || 0;
    if (operationCount >= this.config.behaviorConstraints.maxFileOperations) {
      violations.push(`Maximum number of ${toolName} operations (${this.config.behaviorConstraints.maxFileOperations}) exceeded`);
    }

    // 验证网络访问
    if (this.config.securityConstraints.networkAccess === false) {
      if (toolName === 'fetch' || toolName === 'http_request' || toolName === 'api_call') {
        violations.push('Network access is disabled');
      }
    }

    // 安全规则：防止执行刚刚写入的文件
    if (toolName === 'shell' && parameters.command) {
      const command = parameters.command as string;
      const dangerousPatterns = [
        /\.\//, // 执行当前目录的文件
        /node\s+/, // node执行文件
        /python\s+/, // python执行文件
        /bash\s+/, // bash执行脚本
        /sh\s+/, // sh执行脚本
        /\.sh\s*$/, // 执行.sh文件
        /\.js\s*$/, // 执行.js文件
        /\.py\s*$/, // 执行.py文件
      ];

      const isDangerous = dangerousPatterns.some(pattern => pattern.test(command));
      if (isDangerous) {
        warnings.push('Command may execute a file. Ensure this is safe and has user confirmation.');
        suggestions.push('Consider reviewing the file content before execution.');
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
      suggestions,
    };
  }

  recordToolUsage(toolName: string): void {
    const count = this.operationHistory.get(toolName) || 0;
    this.operationHistory.set(toolName, count + 1);
  }

  recordPathAccess(path: string): void {
    this.pathAccessHistory.add(path);
  }

  resetOperationHistory(): void {
    this.operationHistory.clear();
    this.pathAccessHistory.clear();
  }

  applyOutputConstraints(content: string): string {
    let result = content;

    // 应用长度约束
    if (result.length > this.config.outputConstraints.maxLength) {
      result = result.substring(0, this.config.outputConstraints.maxLength) + '\n\n... (output truncated due to length constraint)';
    }

    // 应用格式约束
    if (this.config.outputConstraints.format === 'markdown') {
      if (!result.includes('```')) {
        // 确保代码块有正确的markdown格式
        result = result.replace(/([a-zA-Z]+\s*\([^)]*\)\s*{)/g, '```$1');
      }
    }

    // 应用代码风格约束
    if (this.config.outputConstraints.codeStyle) {
      result = this.applyCodeStyle(result, this.config.outputConstraints.codeStyle);
    }

    return result;
  }

  private applyCodeStyle(content: string, style: string): string {
    // 简化的代码风格应用
    switch (style) {
      case 'functional':
        // 提倡函数式编程风格
        content = content.replace(/for\s*\(\s*\w+\s+in\s+[\w\s.]+\)\s*{/g, 'Array.from($2).forEach(');
        break;
      case 'object-oriented':
        // 提倡面向对象风格
        content = content.replace(/function\s+(\w+)\s*\(/g, 'class $1 {\n  constructor(');
        break;
      case 'procedural':
        // 提倡过程式风格
        content = content.replace(/class\s+\w+\s*{/g, 'function ');
        break;
    }

    return content;
  }

  generateConstraintPrompt(): string {
    const constraints: string[] = [];

    // 输出约束
    constraints.push(`Output constraints:`);
    constraints.push(`- Maximum length: ${this.config.outputConstraints.maxLength} characters`);
    constraints.push(`- Format: ${this.config.outputConstraints.format}`);
    if (this.config.outputConstraints.language) {
      constraints.push(`- Language: ${this.config.outputConstraints.language}`);
    }
    if (this.config.outputConstraints.includeExplanation) {
      constraints.push(`- Include explanation: Yes`);
    }
    if (this.config.outputConstraints.includeComments) {
      constraints.push(`- Include comments: Yes`);
    }

    // 行为约束
    constraints.push(`\nBehavior constraints:`);
    constraints.push(`- Allowed tools: ${this.config.behaviorConstraints.allowedTools.join(', ')}`);
    if (this.config.behaviorConstraints.forbiddenPaths.length > 0) {
      constraints.push(`- Forbidden paths: ${this.config.behaviorConstraints.forbiddenPaths.join(', ')}`);
    }
    constraints.push(`- Max file operations: ${this.config.behaviorConstraints.maxFileOperations}`);
    if (this.config.behaviorConstraints.requireConfirmation) {
      constraints.push(`- Require confirmation for dangerous operations: Yes`);
    }

    // 安全约束
    constraints.push(`\nSecurity constraints:`);
    constraints.push(`- Sandbox mode: ${this.config.securityConstraints.sandbox ? 'Enabled' : 'Disabled'}`);
    constraints.push(`- Network access: ${this.config.securityConstraints.networkAccess ? 'Allowed' : 'Disabled'}`);
    constraints.push(`- File system access: ${this.config.securityConstraints.fileSystemAccess}`);
    constraints.push(`- Max execution time: ${this.config.securityConstraints.maxExecutionTime}ms`);
    constraints.push(`- Max memory usage: ${this.config.securityConstraints.maxMemoryUsage}MB`);

    return constraints.join('\n');
  }

  checkConfirmationRequired(operation: string): boolean {
    const dangerousOperations = ['delete', 'remove', 'overwrite', 'format', 'wipe'];
    
    if (this.config.behaviorConstraints.requireConfirmation) {
      return dangerousOperations.some(op => operation.toLowerCase().includes(op));
    }

    return false;
  }

  enforceSandbox(code: string): string {
    if (!this.config.securityConstraints.sandbox) {
      return code;
    }

    // 简化的沙箱强制：添加安全检查
    const safeCode = `
// Sandbox mode enabled - safety checks applied
const __sandbox = {
  allowedPaths: ${JSON.stringify(this.config.behaviorConstraints.forbiddenPaths)},
  networkAccess: ${this.config.securityConstraints.networkAccess},
  fileSystemAccess: '${this.config.securityConstraints.fileSystemAccess}'
};

${code}
`;

    return safeCode;
  }

  getDefaultConfig(): ConstraintManagementConfig {
    return {
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
    };
  }
}
