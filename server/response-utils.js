export function extractSources(response) {
  const found = [];
  for (const item of response?.output ?? []) {
    for (const source of item?.action?.sources ?? []) {
      if (source?.url) found.push({ url: source.url, title: source.title || source.url });
    }
    for (const part of item?.content ?? []) {
      for (const annotation of part?.annotations ?? []) {
        if (annotation?.type === 'url_citation' && annotation.url) {
          found.push({ url: annotation.url, title: annotation.title || annotation.url });
        }
      }
    }
  }
  const unique = new Map();
  found.forEach((source) => { if (!unique.has(source.url)) unique.set(source.url, source); });
  return [...unique.values()].slice(0, 6);
}
