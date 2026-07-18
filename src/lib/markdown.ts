import type { SearchOptions, TocItem } from '../types';

const markdownExtensions = new Set(['md', 'markdown', 'mdown', 'txt']);
const assetExtensions = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'svg',
  'bmp',
  'ico',
  'pdf'
]);

export function isMarkdownFile(name: string): boolean {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return markdownExtensions.has(extension);
}

export function isAssetFile(name: string): boolean {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return assetExtensions.has(extension);
}

export function displayNameFromPath(path: string): string {
  const fileName = path.split('/').pop() || path;
  return fileName.replace(/\.(md|markdown|mdown|txt)$/i, '') || fileName;
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[`*_~[\]()#+.!?:"']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'section';
}

export function extractHeadings(markdown: string): TocItem[] {
  const lines = markdown.split(/\r?\n/);
  const counts = new Map<string, number>();
  const headings: TocItem[] = [];
  let inFence = false;
  let fenceMarker = '';

  for (const line of lines) {
    const fence = line.match(/^(\s*)(`{3,}|~{3,})/);
    if (fence && !inFence) {
      inFence = true;
      fenceMarker = fence[2][0];
      continue;
    }
    if (inFence && line.trim().startsWith(fenceMarker.repeat(3))) {
      inFence = false;
      continue;
    }
    if (inFence) continue;

    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;

    const text = stripInlineMarkdown(match[2]).trim();
    if (!text) continue;

    const base = slugify(text);
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    headings.push({
      id: seen === 0 ? base : `${base}-${seen + 1}`,
      level: match[1].length,
      text
    });
  }

  return headings;
}

export function stripInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/\\([^\sA-Za-z0-9])/g, '$1')
    .trim();
}

export function normalizePath(path: string): string {
  const parts: string[] = [];
  path
    .replace(/\\/g, '/')
    .split('/')
    .forEach((part) => {
      if (!part || part === '.') return;
      if (part === '..') {
        parts.pop();
        return;
      }
      parts.push(part);
    });
  return parts.join('/');
}

export function resolveRelativePath(currentPath: string | undefined, target: string): string {
  const cleanTarget = decodeURI(target.split('#')[0] ?? '').split('?')[0];
  if (!currentPath) return normalizePath(cleanTarget);
  const base = currentPath.includes('/') ? currentPath.slice(0, currentPath.lastIndexOf('/')) : '';
  return normalizePath(`${base}/${cleanTarget}`);
}

export function isSafeLinkUrl(href: string): boolean {
  if (!href) return false;
  if (
    href.startsWith('#') ||
    href.startsWith('./') ||
    href.startsWith('../') ||
    href.startsWith('/')
  ) {
    return true;
  }

  try {
    const url = new URL(href, window.location.href);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function isSafeImageUrl(src: string): boolean {
  if (!src) return false;
  if (src.startsWith('./') || src.startsWith('../') || src.startsWith('/')) return true;

  if (/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src)) {
    return true;
  }

  try {
    const url = new URL(src, window.location.href);
    return url.protocol === 'https:' || url.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function isMarkdownLink(href: string): boolean {
  const withoutHash = href.split('#')[0] ?? '';
  return isMarkdownFile(withoutHash);
}

export function countMatches(text: string, query: string, options: SearchOptions): number {
  if (!query.trim()) return 0;
  const flags = options.caseSensitive ? 'g' : 'gi';
  const escaped = escapeRegExp(query.trim());
  const pattern = options.wholeWord ? `\\b${escaped}\\b` : escaped;
  const matches = text.match(new RegExp(pattern, flags));
  return matches?.length ?? 0;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function convertGitHubBlobUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.hostname !== 'github.com') return raw;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 5 && parts[2] === 'blob') {
      const [owner, repo, , branch, ...pathParts] = parts;
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${pathParts.join('/')}`;
    }
    return raw;
  } catch {
    return raw;
  }
}
