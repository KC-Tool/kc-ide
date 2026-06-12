// 代码插入策略
// 负责指导模型如何使用代码插入工具，而不是总是重写整个文件

export interface CodeInsertionStrategyConfig {
  preferInsertOverWrite: boolean;
  maxFileSizeForInsert: number;
  requireAnchor: boolean;
  anchorValidation: boolean;
  conflictResolution: 'ask' | 'overwrite' | 'merge';
}

export interface AnchorSuggestion {
  type: 'function' | 'class' | 'variable' | 'import' | 'comment' | 'line';
  text: string;
  line: number;
  confidence: number;
}

export interface InsertionPlan {
  tool: 'insert_code' | 'write_file';
  reason: string;
  anchor?: string;
  action?: 'insert_before' | 'insert_after' | 'replace';
  confidence: number;
}

export class CodeInsertionStrategy {
  constructor(private config: CodeInsertionStrategyConfig) {}

  analyzeCodeModification(
    filePath: string,
    existingContent: string,
    newContent: string
  ): InsertionPlan {
    // 如果文件不存在，必须使用write_file
    if (!existingContent || existingContent.trim().length === 0) {
      return {
        tool: 'write_file',
        reason: 'File does not exist, must create it',
        confidence: 1.0,
      };
    }

    // 如果文件太大，使用write_file
    if (existingContent.length > this.config.maxFileSizeForInsert) {
      return {
        tool: 'write_file',
        reason: `File is too large (${existingContent.length} bytes) for insert_code`,
        confidence: 0.9,
      };
    }

    // 如果新内容是完整文件替换，使用write_file
    if (this.isCompleteFileReplacement(existingContent, newContent)) {
      return {
        tool: 'write_file',
        reason: 'New content appears to be a complete file replacement',
        confidence: 0.85,
      };
    }

    // 尝试找到合适的锚点进行插入
    const anchor = this.findBestAnchor(existingContent, newContent);
    if (anchor && this.config.preferInsertOverWrite) {
      const action = this.determineInsertionAction(existingContent, newContent, anchor);
      return {
        tool: 'insert_code',
        reason: `Found suitable anchor for code insertion: "${anchor.text}"`,
        anchor: anchor.text,
        action,
        confidence: anchor.confidence,
      };
    }

    // 默认使用write_file
    return {
      tool: 'write_file',
      reason: 'No suitable anchor found, using write_file for safety',
      confidence: 0.7,
    };
  }

  private isCompleteFileReplacement(existing: string, newContent: string): string {
    // 检查新内容是否包含完整的文件结构
    const existingLines = existing.split('\n');
    const newLines = newContent.split('\n');

    // 如果新内容行数差异很大，可能是完整替换
    const lineDiff = Math.abs(newLines.length - existingLines.length);
    if (lineDiff > existingLines.length * 0.5) {
      return newContent;
    }

    // 检查新内容是否包含文件头部的关键结构
    const existingHeader = existingLines.slice(0, 10).join('\n');
    const newHeader = newLines.slice(0, 10).join('\n');
    
    if (existingHeader !== newHeader) {
      // 如果头部完全不同，可能是完整替换
      return newContent;
    }

    return '';
  }

  private findBestAnchor(existingContent: string, newContent: string): AnchorSuggestion | null {
    const existingLines = existingContent.split('\n');
    const newLines = newContent.split('\n');

    const candidates: AnchorSuggestion[] = [];

    // 寻找函数定义作为锚点
    const functionPattern = /(?:function|const|let|var|def|class)\s+(\w+)/;
    for (let i = 0; i < existingLines.length; i++) {
      const match = existingLines[i].match(functionPattern);
      if (match) {
        const funcName = match[1];
        // 检查新内容中是否也包含这个函数
        if (newContent.includes(funcName)) {
          candidates.push({
            type: 'function',
            text: existingLines[i].trim(),
            line: i + 1,
            confidence: 0.9,
          });
        }
      }
    }

    // 寻找import语句作为锚点
    const importPattern = /(?:import|require|from)/;
    for (let i = 0; i < existingLines.length; i++) {
      if (importPattern.test(existingLines[i])) {
        candidates.push({
          type: 'import',
          text: existingLines[i].trim(),
          line: i + 1,
          confidence: 0.8,
        });
      }
    }

    // 寻找类定义作为锚点
    const classPattern = /class\s+(\w+)/;
    for (let i = 0; i < existingLines.length; i++) {
      const match = existingLines[i].match(classPattern);
      if (match) {
        const className = match[1];
        if (newContent.includes(className)) {
          candidates.push({
            type: 'class',
            text: existingLines[i].trim(),
            line: i + 1,
            confidence: 0.85,
          });
        }
      }
    }

    // 寻找注释作为锚点
    const commentPattern = /\/\/.*|\/\*[\s\S]*?\*\/|#.*/;
    for (let i = 0; i < existingLines.length; i++) {
      const match = existingLines[i].match(commentPattern);
      if (match && match[0].length > 10) {
        candidates.push({
          type: 'comment',
          text: existingLines[i].trim(),
          line: i + 1,
          confidence: 0.7,
        });
      }
    }

    // 选择最佳锚点
    if (candidates.length === 0) {
      return null;
    }

    return candidates.sort((a, b) => b.confidence - a.confidence)[0];
  }

  private determineInsertionAction(
    existingContent: string,
    newContent: string,
    anchor: AnchorSuggestion
  ): 'insert_before' | 'insert_after' | 'replace' {
    // 根据锚点类型和内容确定插入动作
    switch (anchor.type) {
      case 'function':
        return 'insert_after';
      case 'class':
        return 'insert_after';
      case 'import':
        return 'insert_after';
      case 'comment':
        return 'insert_after';
      default:
        return 'insert_after';
    }
  }

  generateInsertionInstructions(): string {
    const sections = [];
    
    sections.push('## Code Insertion Strategy');
    sections.push('');
    sections.push('Prefer code insertion over complete file rewriting when possible:');
    sections.push('');
    sections.push('### When to Use insert_code');
    sections.push('- Modifying existing functions or methods');
    sections.push('- Adding new functions to existing files');
    sections.push('- Adding imports to existing files');
    sections.push('- Adding class methods or properties');
    sections.push('- Making small, targeted changes');
    sections.push('');
    sections.push('### When to Use write_file');
    sections.push('- Creating new files');
    sections.push('- Completely replacing file contents');
    sections.push('- Files larger than ' + this.config.maxFileSizeForInsert + ' bytes');
    sections.push('- When no suitable anchor can be found');
    sections.push('');
    sections.push('### How to Use insert_code Effectively');
    sections.push('1. Choose a unique anchor: Use a function signature, class name, import statement, or distinctive comment');
    sections.push('2. Select the right action:');
    sections.push('   - insert_before: Insert code before the anchor line');
    sections.push('   - insert_after: Insert code after the anchor line');
    sections.push('   - replace: Replace the anchor line (and optionally additional lines)');
    sections.push('3. Be specific: The anchor must match exactly one line in the file');
    sections.push('4. Test the anchor: Ensure the anchor text is unique and stable');
    sections.push('');
    sections.push('### Anchor Selection Best Practices');
    sections.push('- Function signatures: function myFunction(param: type) or const myFunction = (param) => {');
    sections.push('- Class definitions: class MyClass { or export class MyClass extends Parent {');
    sections.push('- Import statements: import { something } from \'module\'');
    sections.push('- Variable declarations: const myVariable = value');
    sections.push('- Comments: // TODO: Add feature or /* Section header */');
    sections.push('');
    sections.push('### Example Usage');
    sections.push('To add a new function after an existing one:');
    sections.push('- anchor: "function existingFunction() {"');
    sections.push('- action: "insert_after"');
    sections.push('- content: "function newFunction() { ... }"');
    sections.push('');
    sections.push('To add an import at the top:');
    sections.push('- anchor: "import React from \'react\';"');
    sections.push('- action: "insert_after"');
    sections.push('- content: "import { useState } from \'react\';"');
    sections.push('');
    sections.push('To replace a function:');
    sections.push('- anchor: "function oldFunction() {"');
    sections.push('- action: "replace"');
    sections.push('- replaceLines: 5');
    sections.push('- content: "function newFunction() { ... }"');
    sections.push('');
    sections.push('### Benefits of Code Insertion');
    sections.push('- Reduces token usage by not rewriting entire files');
    sections.push('- Prevents content truncation errors');
    sections.push('- Preserves file structure and formatting');
    sections.push('- More precise and safer modifications');
    sections.push('- Better for collaborative editing');
    sections.push('');
    sections.push('### Conflict Resolution');
    sections.push('When conflicts are detected:');
    if (this.config.conflictResolution === 'ask') {
      sections.push('- Ask for user guidance on how to resolve');
    } else if (this.config.conflictResolution === 'overwrite') {
      sections.push('- Overwrite existing content');
    } else if (this.config.conflictResolution === 'merge') {
      sections.push('- Attempt to merge changes');
    }
    
    return sections.join('\n');
  }

  getDefaultConfig(): CodeInsertionStrategyConfig {
    return {
      preferInsertOverWrite: true,
      maxFileSizeForInsert: 100000, // 100KB
      requireAnchor: true,
      anchorValidation: true,
      conflictResolution: 'ask',
    };
  }
}
