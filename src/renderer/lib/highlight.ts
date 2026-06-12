// 语法高亮 — 注册常用语言，支持路径推断

import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import bash from 'highlight.js/lib/languages/bash';
import shell from 'highlight.js/lib/languages/shell';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import ini from 'highlight.js/lib/languages/ini';

const LANG_MAP: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  cs: 'csharp',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  html: 'xml',
  htm: 'xml',
  vue: 'xml',
  dockerfile: 'dockerfile',
};

function registerLanguages(): void {
  const pairs: Array<[string, Parameters<typeof hljs.registerLanguage>[1]]> = [
    ['javascript', javascript],
    ['typescript', typescript],
    ['python', python],
    ['java', java],
    ['cpp', cpp],
    ['csharp', csharp],
    ['go', go],
    ['rust', rust],
    ['ruby', ruby],
    ['php', php],
    ['swift', swift],
    ['kotlin', kotlin],
    ['sql', sql],
    ['json', json],
    ['yaml', yaml],
    ['xml', xml],
    ['html', xml],
    ['css', css],
    ['scss', scss],
    ['bash', bash],
    ['shell', shell],
    ['markdown', markdown],
    ['dockerfile', dockerfile],
    ['ini', ini],
  ];
  for (const [name, mod] of pairs) {
    if (!hljs.getLanguage(name)) {
      hljs.registerLanguage(name, mod);
    }
  }
}

registerLanguages();

export function normalizeLanguage(lang: string | undefined): string {
  if (!lang) return '';
  const lower = lang.toLowerCase().replace(/^language-/, '');
  if (hljs.getLanguage(lower)) return lower;
  return LANG_MAP[lower] ?? lower;
}

export function detectLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'dockerfile') return 'dockerfile';
  return LANG_MAP[ext] ?? ext;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function highlightCode(code: string, language?: string): { html: string; language: string } {
  const lang = normalizeLanguage(language);
  if (lang === 'plaintext' || lang === 'text') {
    return { html: escapeHtml(code), language: 'plaintext' };
  }
  if (lang && hljs.getLanguage(lang)) {
    try {
      const result = hljs.highlight(code, { language: lang });
      return { html: result.value, language: lang };
    } catch {
      // fall through
    }
  }
  const auto = hljs.highlightAuto(code);
  return { html: auto.value, language: auto.language ?? 'plaintext' };
}

export { hljs };
