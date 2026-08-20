const patterns = [
  /^\s*\[?\d{2,4}[\/-]\d{1,2}[\/-]\d{1,2}(?:[,\s]+\d{1,2}:\d{2}(?::\d{2})?)?\]?\s*[-–]?\s*([^:：]+)[:：]\s*(.+)$/,
  /^\s*\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*([^:：]+)[:：]\s*(.+)$/,
  /^\s*([^:：\n]{1,40})[:：]\s*(.+)$/,
];

export function parseChatRecord(text, targetName = '') {
  const results = [];
  let current = null;
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const match = patterns.map((pattern) => line.match(pattern)).find(Boolean);
    if (match) {
      current = { speaker: match[1].trim(), text: match[2].trim() };
      results.push(current);
    } else if (current) {
      current.text += `\n${line}`;
    }
  }
  const filtered = targetName
    ? results.filter((item) => item.speaker.toLowerCase().includes(targetName.trim().toLowerCase()))
    : results;
  return filtered.map((item, index) => ({ id: `sample-${Date.now()}-${index}`, ...item }));
}

export function makeDemoReply(message, samples, name) {
  const recent = samples.filter((item) => item.text?.length > 1).slice(-20);
  const ending = recent.find((item) => /[！!。~～…]$/.test(item.text))?.text.match(/[！!。~～…]+$/)?.[0] ?? '。';
  const short = recent.length ? Math.round(recent.reduce((sum, item) => sum + item.text.length, 0) / recent.length) < 18 : true;
  const prefix = /[?？]/.test(message) ? '我想想，' : '';
  return `${prefix}${message.includes('图片') ? '我看到你发的图片啦。' : short ? '嗯，我在听' : `收到。关于“${message.slice(0, 18)}”，我想再听你多说一点`}${ending}`;
}
