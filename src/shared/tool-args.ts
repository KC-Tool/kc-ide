// 从 streaming 中不完整的 tool call JSON 里提取字段（用于实时文件预览）

export interface PartialWriteArgs {
  path?: string;
  content?: string;
  anchor?: string;
  action?: string;
}

function unescapePartialJsonString(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '\\' && i + 1 < raw.length) {
      const esc = raw[i + 1];
      if (esc === 'n') out += '\n';
      else if (esc === 't') out += '\t';
      else if (esc === 'r') out += '\r';
      else if (esc === '"') out += '"';
      else if (esc === '\\') out += '\\';
      else if (esc === '/') out += '/';
      else out += esc;
      i++;
    } else if (raw[i] === '"') {
      break;
    } else {
      out += raw[i];
    }
  }
  return out;
}

function extractJsonStringField(input: string, field: string): string | undefined {
  const re = new RegExp(`"${field}"\\s*:\\s*"`);
  const match = re.exec(input);
  if (!match || match.index === undefined) return undefined;
  const start = match.index + match[0].length;
  return unescapePartialJsonString(input.slice(start));
}

/** 从不完整的 tool call arguments JSON 中提取 write_file / insert_code 字段 */
export function extractPartialFileArgs(input: string): PartialWriteArgs {
  const result: PartialWriteArgs = {};
  result.path = extractJsonStringField(input, 'path');
  result.content = extractJsonStringField(input, 'content');
  result.anchor = extractJsonStringField(input, 'anchor');
  result.action = extractJsonStringField(input, 'action');
  return result;
}
