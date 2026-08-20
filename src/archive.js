import JSZip from 'jszip';

const MAX_ZIP_BYTES = 200 * 1024 * 1024;
const MAX_FILES = 500;
const MAX_TEXT_CHARS = 32 * 1024 * 1024;
const TEXT_EXTENSIONS = /\.(txt|log|json|csv|md)$/i;

function csvCells(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { cells.push(value.trim()); value = ''; }
    else value += char;
  }
  cells.push(value.trim());
  return cells;
}

function normalizeCsv(text) {
  const rows = text.replace(/\r/g, '').split('\n').filter(Boolean).map(csvCells);
  if (rows.length < 2) return text;
  const headers = rows[0].map((item) => item.toLowerCase());
  const speakerIndex = headers.findIndex((item) => /^(speaker|sender|from|author|name|user|说话人|发送者|昵称)$/.test(item));
  const textIndex = headers.findIndex((item) => /^(text|content|message|body|消息|内容)$/.test(item));
  if (textIndex < 0) return text;
  return rows.slice(1).map((row) => `${row[speakerIndex] || '对方'}: ${row[textIndex] || ''}`).join('\n');
}

function normalizeJson(text) {
  let value;
  try { value = JSON.parse(text); } catch { return text; }
  const lines = [];
  const visit = (node, depth = 0) => {
    if (depth > 12 || lines.length > 10000 || node == null) return;
    if (Array.isArray(node)) return node.forEach((item) => visit(item, depth + 1));
    if (typeof node !== 'object') return;
    const body = ['text', 'content', 'message', 'body', '消息', '内容'].map((key) => node[key]).find((item) => typeof item === 'string');
    if (body) {
      const speaker = ['speaker', 'sender', 'from', 'author', 'name', 'user', 'role', '说话人', '发送者'].map((key) => node[key]).find((item) => typeof item === 'string') || '对方';
      lines.push(`${speaker}: ${body}`);
      return;
    }
    Object.values(node).forEach((item) => visit(item, depth + 1));
  };
  visit(value);
  return lines.length ? lines.join('\n') : text;
}

function normalizeByName(text, name) {
  if (/\.json$/i.test(name)) return normalizeJson(text);
  if (/\.csv$/i.test(name)) return normalizeCsv(text);
  return text;
}

export async function extractImportText(file) {
  if (!file) throw new Error('请选择要导入的文件。');
  if (!/\.zip$/i.test(file.name)) {
    return { text: normalizeByName(await file.text(), file.name), files: [file.name], skipped: 0 };
  }
  if (file.size > MAX_ZIP_BYTES) throw new Error('ZIP 不能超过 200 MB。');

  let zip;
  try { zip = await JSZip.loadAsync(await file.arrayBuffer()); }
  catch { throw new Error('无法读取 ZIP；暂不支持加密或损坏的压缩包。'); }

  const candidates = Object.values(zip.files).filter((entry) =>
    !entry.dir && TEXT_EXTENSIONS.test(entry.name) && !/(^|\/)__MACOSX\//i.test(entry.name),
  );
  if (!candidates.length) throw new Error('ZIP 中没有找到 TXT、LOG、JSON、CSV 或 MD 聊天文件。');
  if (candidates.length > MAX_FILES) throw new Error(`ZIP 中可读取的聊天文件过多（最多 ${MAX_FILES} 个）。`);

  const parts = [];
  let total = 0;
  for (const entry of candidates) {
    const content = normalizeByName(await entry.async('string'), entry.name);
    total += content.length;
    if (total > MAX_TEXT_CHARS) throw new Error('ZIP 解压后的聊天文字不能超过 32 MB。');
    parts.push(`\n${content}`);
  }
  return {
    text: parts.join('\n'),
    files: candidates.map((entry) => entry.name),
    skipped: Object.values(zip.files).filter((entry) => !entry.dir).length - candidates.length,
  };
}
