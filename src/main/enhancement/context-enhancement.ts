// 上下文增强策略
// 负责智能管理上下文窗口，优化token使用，提升模型理解能力

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'node:fs/promises';

export interface ProjectStructure {
  rootPath: string;
  files: string[];
  directories: string[];
  keyFiles: string[];
}

export interface DependencyGraph {
  dependencies: Map<string, string[]>;
  dependents: Map<string, string[]>;
}

export interface CodingConvention {
  name: string;
  pattern: RegExp;
  description: string;
}

export interface CodeIndex {
  functions: Map<string, FunctionInfo>;
  classes: Map<string, ClassInfo>;
  patterns: Map<string, PatternInfo>;
}

export interface FunctionInfo {
  name: string;
  file: string;
  line: number;
  parameters: string[];
  returnType?: string;
  docstring?: string;
}

export interface ClassInfo {
  name: string;
  file: string;
  line: number;
  methods: string[];
  properties: string[];
  extends?: string;
}

export interface PatternInfo {
  type: string;
  file: string;
  line: number;
  description: string;
}

export interface ContextEnhancementConfig {
  maxContextTokens: number;
  targetUsageRate: number;
  includeProjectStructure: boolean;
  includeDependencies: boolean;
  includeKeyFiles: boolean;
  includeCodeIndex: boolean;
}

export class ContextEnhancement {
  private projectStructure: ProjectStructure | null = null;
  private dependencyGraph: DependencyGraph | null = null;
  private codeIndex: CodeIndex | null = null;
  private codingConventions: CodingConvention[] = [];

  constructor(private config: ContextEnhancementConfig) {}

  async initialize(rootPath: string): Promise<void> {
    await this.buildProjectStructure(rootPath);
    await this.buildDependencyGraph(rootPath);
    await this.buildCodeIndex(rootPath);
    this.detectCodingConventions();
  }

  private async buildProjectStructure(rootPath: string): Promise<void> {
    const files: string[] = [];
    const directories: string[] = [];

    try {
      const entries = await glob('**/*', { cwd: rootPath, withFileTypes: true });
      
      for (const entry of entries) {
        const relativePath = entry.relative();
        if (entry.isDirectory()) {
          directories.push(relativePath);
        } else if (entry.isFile()) {
          files.push(relativePath);
        }
      }

      // 识别关键文件
      const keyFiles = this.identifyKeyFiles(files);

      this.projectStructure = {
        rootPath,
        files,
        directories,
        keyFiles,
      };
    } catch (error) {
      console.error('Failed to build project structure:', error);
    }
  }

  private identifyKeyFiles(files: string[]): string[] {
    const keyPatterns = [
      /package\.json$/,
      /tsconfig\.json$/,
      /README\.md$/,
      /\.gitignore$/,
      /src\/index\.(ts|js|tsx|jsx)$/,
      /src\/main\.(ts|js|tsx|jsx)$/,
      /src\/App\.(ts|js|tsx|jsx)$/,
      /\.env(\.example)?$/,
      /vite\.config\.(ts|js)$/,
      /webpack\.config\.(ts|js)$/,
    ];

    return files.filter(file => 
      keyPatterns.some(pattern => pattern.test(file))
    );
  }

  private async buildDependencyGraph(rootPath: string): Promise<void> {
    this.dependencyGraph = {
      dependencies: new Map(),
      dependents: new Map(),
    };

    try {
      const packageJsonPath = join(rootPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      
      const dependencies = packageJson.dependencies || {};
      const devDependencies = packageJson.devDependencies || {};

      for (const [dep, version] of Object.entries({ ...dependencies, ...devDependencies })) {
        this.dependencyGraph.dependencies.set(dep, [version as string]);
      }
    } catch (error) {
      console.error('Failed to build dependency graph:', error);
    }
  }

  private async buildCodeIndex(rootPath: string): Promise<void> {
    this.codeIndex = {
      functions: new Map(),
      classes: new Map(),
      patterns: new Map(),
    };

    // 简化实现：只索引关键文件
    if (this.projectStructure) {
      for (const file of this.projectStructure.keyFiles) {
        try {
          const filePath = join(rootPath, file);
          const content = await readFile(filePath, 'utf-8');
          this.indexFileContent(file, content);
        } catch (error) {
          // 跳过无法读取的文件
        }
      }
    }
  }

  private indexFileContent(file: string, content: string): void {
    // 简化的函数和类识别
    const functionPattern = /(?:function|const|let|var)\s+(\w+)\s*(?:=\s*(?:async\s*)?\([^)]*\)|\([^)]*\))/g;
    const classPattern = /class\s+(\w+)/g;

    let match;
    while ((match = functionPattern.exec(content)) !== null) {
      const [_, name] = match;
      this.codeIndex!.functions.set(name, {
        name,
        file,
        line: content.substring(0, match.index).split('\n').length,
        parameters: [],
      });
    }

    while ((match = classPattern.exec(content)) !== null) {
      const [_, name] = match;
      this.codeIndex!.classes.set(name, {
        name,
        file,
        line: content.substring(0, match.index).split('\n').length,
        methods: [],
        properties: [],
      });
    }
  }

  private detectCodingConventions(): void {
    // 常见的编码约定检测
    this.codingConventions = [
      {
        name: 'CamelCase variables',
        pattern: /\b[a-z][a-zA-Z0-9]*\b/g,
        description: 'Variables use camelCase naming convention',
      },
      {
        name: 'PascalCase classes',
        pattern: /\b[A-Z][a-zA-Z0-9]*\b/g,
        description: 'Classes use PascalCase naming convention',
      },
    ];
  }

  generateEnhancedContext(currentContext: string, userQuery: string): string {
    const sections: string[] = [];

    // 添加项目结构信息
    if (this.config.includeProjectStructure && this.projectStructure) {
      sections.push(this.formatProjectStructure());
    }

    // 添加依赖信息
    if (this.config.includeDependencies && this.dependencyGraph) {
      sections.push(this.formatDependencies());
    }

    // 添加关键文件摘要
    if (this.config.includeKeyFiles && this.projectStructure) {
      sections.push(this.formatKeyFiles());
    }

    // 添加代码索引
    if (this.config.includeCodeIndex && this.codeIndex) {
      sections.push(this.formatCodeIndex());
    }

    // 添加编码约定
    if (this.codingConventions.length > 0) {
      sections.push(this.formatCodingConventions());
    }

    // 添加原始上下文
    sections.push(currentContext);

    // 添加用户查询上下文
    sections.push(`User Query: ${userQuery}`);

    return sections.join('\n\n');
  }

  private formatProjectStructure(): string {
    if (!this.projectStructure) return '';

    const { files, directories, keyFiles } = this.projectStructure;
    
    return `## Project Structure
- Total files: ${files.length}
- Total directories: ${directories.length}
- Key files: ${keyFiles.length}

Key files:
${keyFiles.map(f => `- ${f}`).join('\n')}`;
  }

  private formatDependencies(): string {
    if (!this.dependencyGraph) return '';

    const deps = Array.from(this.dependencyGraph.dependencies.entries());
    
    return `## Dependencies
Total dependencies: ${deps.length}

Main dependencies:
${deps.slice(0, 20).map(([dep, versions]) => `- ${dep}: ${versions.join(', ')}`).join('\n')}`;
  }

  private formatKeyFiles(): string {
    if (!this.projectStructure) return '';

    return `## Key Files Summary
${this.projectStructure.keyFiles.map(f => `- ${f}`).join('\n')}`;
  }

  private formatCodeIndex(): string {
    if (!this.codeIndex) return '';

    const functions = Array.from(this.codeIndex.functions.values());
    const classes = Array.from(this.codeIndex.classes.values());

    return `## Code Index
Functions (${functions.length}):
${functions.slice(0, 20).map(f => `- ${f.name} (${f.file}:${f.line})`).join('\n')}

Classes (${classes.length}):
${classes.slice(0, 20).map(c => `- ${c.name} (${c.file}:${c.line})`).join('\n')}`;
  }

  private formatCodingConventions(): string {
    return `## Coding Conventions
${this.codingConventions.map(c => `- ${c.name}: ${c.description}`).join('\n')}`;
  }

  compressContext(context: string, targetTokens: number): string {
    // 简化的上下文压缩：基于token估算
    const estimatedTokens = context.length / 4;
    
    if (estimatedTokens <= targetTokens) {
      return context;
    }

    // 按比例压缩
    const compressionRatio = targetTokens / estimatedTokens;
    const targetLength = Math.floor(context.length * compressionRatio);
    
    return context.substring(0, targetLength) + '\n\n... (context compressed)';
  }

  getRelevantCode(query: string, maxFiles: number = 5): string[] {
    // 简化的相关性搜索
    const relevantFiles: string[] = [];

    if (this.projectStructure) {
      const queryLower = query.toLowerCase();
      
      for (const file of this.projectStructure.files) {
        if (file.toLowerCase().includes(queryLower)) {
          relevantFiles.push(file);
          if (relevantFiles.length >= maxFiles) break;
        }
      }
    }

    return relevantFiles;
  }

  getContextStatistics(): {
    totalFiles: number;
    totalFunctions: number;
    totalClasses: number;
    totalDependencies: number;
  } {
    return {
      totalFiles: this.projectStructure?.files.length || 0,
      totalFunctions: this.codeIndex?.functions.size || 0,
      totalClasses: this.codeIndex?.classes.size || 0,
      totalDependencies: this.dependencyGraph?.dependencies.size || 0,
    };
  }
}
