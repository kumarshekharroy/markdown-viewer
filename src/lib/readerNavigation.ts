import type { EditorView } from '@codemirror/view';
import type { SearchOptions } from '../types';
import { escapeRegExp } from './markdown';
const SEARCH_MATCH_HIGHLIGHT = 'markdown-search-match';
const SEARCH_ACTIVE_HIGHLIGHT = 'markdown-search-active';

type HighlightLike = object;
type HighlightConstructor = new (...ranges: Range[]) => HighlightLike;

interface HighlightRegistryLike {
  set(name: string, highlight: HighlightLike): void;
  delete(name: string): boolean;
}

export function paintRenderedSearchHighlights(ranges: Range[], activeIndex: number): void {
  const support = getCssHighlightSupport();
  if (!support) return;

  clearRenderedSearchHighlights();
  if (ranges.length === 0) return;

  support.registry.set(SEARCH_MATCH_HIGHLIGHT, new support.Highlight(...ranges));

  const activeRange = ranges[activeIndex - 1];
  if (activeRange) {
    support.registry.set(SEARCH_ACTIVE_HIGHLIGHT, new support.Highlight(activeRange));
  }
}

export function clearRenderedSearchHighlights(): void {
  const support = getCssHighlightSupport();
  support?.registry.delete(SEARCH_MATCH_HIGHLIGHT);
  support?.registry.delete(SEARCH_ACTIVE_HIGHLIGHT);
}

function getCssHighlightSupport():
  { registry: HighlightRegistryLike; Highlight: HighlightConstructor } | undefined {
  if (typeof CSS === 'undefined' || typeof window === 'undefined') return undefined;
  const registry = (CSS as unknown as { highlights?: HighlightRegistryLike }).highlights;
  const Highlight = (window as unknown as { Highlight?: HighlightConstructor }).Highlight;
  if (!registry || !Highlight) return undefined;
  return { registry, Highlight };
}

export function selectEditorSearchMatch(
  editorView: EditorView,
  query: string,
  options: SearchOptions,
  cursor: number
): void {
  const match = collectTextMatches(editorView.state.doc.toString(), query, options)[cursor - 1];
  if (!match) return;
  editorView.focus();
  editorView.dispatch({
    selection: { anchor: match.from, head: match.to },
    scrollIntoView: true
  });
}

export function findRenderedSearchRanges(
  root: HTMLElement | null,
  query: string,
  options: SearchOptions
): Range[] {
  if (!root || !query.trim()) return [];
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest('button, style, script')) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? '';
    for (const match of collectTextMatches(text, query, options)) {
      const range = document.createRange();
      range.setStart(node, match.from);
      range.setEnd(node, match.to);
      ranges.push(range);
    }
    node = walker.nextNode();
  }

  return ranges;
}

function collectTextMatches(
  text: string,
  query: string,
  options: SearchOptions
): Array<{ from: number; to: number }> {
  const regex = searchRegex(query, options);
  if (!regex) return [];
  const matches: Array<{ from: number; to: number }> = [];
  for (const match of text.matchAll(regex)) {
    const from = match.index ?? 0;
    matches.push({ from, to: from + match[0].length });
  }
  return matches;
}

function searchRegex(query: string, options: SearchOptions): RegExp | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const flags = options.caseSensitive ? 'g' : 'gi';
  const escaped = escapeRegExp(trimmed);
  return new RegExp(options.wholeWord ? `\\b${escaped}\\b` : escaped, flags);
}

export function scrollHeadingIntoView(
  id: string,
  reducedMotion: boolean,
  preferredContainer?: HTMLElement | null
): boolean {
  const cleanId = id.replace(/^#/, '');
  const target = document.getElementById(cleanId);
  const container = preferredContainer ?? document.querySelector<HTMLElement>('.document-stage');
  if (!target || !container) return false;

  const targetRect = target.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const top = targetRect.top - containerRect.top + container.scrollTop - 24;
  container.scrollTo({
    top: Math.max(0, top),
    behavior: reducedMotion ? 'auto' : 'smooth'
  });
  window.history.replaceState(null, '', `#${cleanId}`);
  return true;
}

export function scrollRangeIntoStage(
  range: Range,
  container: HTMLElement | null,
  reducedMotion: boolean
): void {
  if (!container) return;
  const rect = range.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const top = rect.top - containerRect.top + container.scrollTop - container.clientHeight * 0.35;
  container.scrollTo({
    top: Math.max(0, top),
    behavior: reducedMotion ? 'auto' : 'smooth'
  });
}

export function getScrollRatio(element: HTMLElement): number {
  const max = element.scrollHeight - element.clientHeight;
  if (max <= 0) return 0;
  return element.scrollTop / max;
}

export function restoreScrollRatio(element: HTMLElement, ratio: number): void {
  const max = Math.max(0, element.scrollHeight - element.clientHeight);
  element.scrollTop = Math.max(0, Math.min(1, ratio)) * max;
}

export function getReaderScrollElement(stage: HTMLElement | null): HTMLElement | null {
  if (stage && stage.scrollHeight > stage.clientHeight) return stage;
  return document.scrollingElement as HTMLElement | null;
}
