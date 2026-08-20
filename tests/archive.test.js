import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { extractImportText } from '../src/archive.js';
import { parseChatRecord } from '../src/parser.js';

async function zipFile(entries) {
  const zip = new JSZip();
  Object.entries(entries).forEach(([name, content]) => zip.file(name, content));
  const data = await zip.generateAsync({ type: 'uint8array' });
  return { name: '聊天导出.zip', size: data.byteLength, arrayBuffer: async () => data.buffer };
}

test('extracts supported chat files from a zip and ignores media', async () => {
  const file = await zipFile({
    'chat/a.txt': '小雨: 早呀',
    'chat/b.csv': 'sender,message\n小雨,吃饭了吗',
    'media/photo.jpg': 'not really an image',
  });
  const result = await extractImportText(file);
  assert.equal(result.files.length, 2);
  assert.equal(result.skipped, 1);
  assert.deepEqual(parseChatRecord(result.text, '小雨').map((item) => item.text), ['早呀', '吃饭了吗']);
});

test('normalizes common JSON chat exports inside a zip', async () => {
  const file = await zipFile({ 'messages.json': JSON.stringify({ messages: [{ sender: 'Alex', content: 'hello' }] }) });
  const result = await extractImportText(file);
  assert.equal(parseChatRecord(result.text, 'Alex')[0].text, 'hello');
});

test('rejects zip archives without chat text files', async () => {
  const file = await zipFile({ 'photo.png': 'binary' });
  await assert.rejects(() => extractImportText(file), /没有找到/);
});
