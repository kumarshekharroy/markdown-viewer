import type { SearchOptions } from '../types';
import { escapeRegExp } from './markdown';

export interface TextMatch {
  from: number;
  to: number;
}

function matchPattern(query: string, options: SearchOptions): RegExp | null {
  if (!query.trim()) return null;
  const escaped = escapeRegExp(query.trim());
  return new RegExp(
    options.wholeWord ? `\\b${escaped}\\b` : escaped,
    options.caseSensitive ? 'g' : 'gi'
  );
}

export function findSourceMatches(
  text: string,
  query: string,
  options: SearchOptions
): TextMatch[] {
  const pattern = matchPattern(query, options);
  if (!pattern) return [];
  return Array.from(text.matchAll(pattern), (match) => ({
    from: match.index ?? 0,
    to: (match.index ?? 0) + match[0].length
  }));
}

export function replaceSourceMatch(text: string, match: TextMatch, replacement: string): string {
  return text.slice(0, match.from) + replacement + text.slice(match.to);
}

export function replaceAllSourceMatches(
  text: string,
  query: string,
  options: SearchOptions,
  replacement: string
): string {
  const pattern = matchPattern(query, options);
  return pattern ? text.replace(pattern, () => replacement) : text;
}
