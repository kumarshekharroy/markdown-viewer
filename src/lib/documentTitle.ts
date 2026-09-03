/** Display-only cleanup. Original paths, titles and save targets remain untouched. */
export function normalizeDocumentTitle(value: string): string {
  let title = value.trim();
  try {
    if (/^https?:\/\//i.test(title)) title = new URL(title).pathname;
  } catch {
    /* Treat malformed URLs as an ordinary label. */
  }
  title = title.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? '';
  try {
    title = decodeURIComponent(title);
  } catch {
    /* Preserve malformed percent escapes. */
  }
  return (
    title
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      .replace(/^[`*]+|[`*]+$/g, '')
      .replace(/\.(md|markdown|mdown|txt)$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Untitled document'
  );
}
