import type { EditorView } from '@codemirror/view';
import type { TocItem } from '../types';

export interface ScrollAnchor {
  editor: number;
  preview: number;
}

export function buildHeadingScrollAnchors(
  view: EditorView,
  preview: HTMLElement,
  article: HTMLElement | null,
  headings: TocItem[],
  stacked: boolean
): ScrollAnchor[] {
  if (!article) return [];
  const editor = view.scrollDOM;
  const editorFocus = Math.min(160, editor.clientHeight * 0.25);
  const toolbarHeight =
    editor.closest('.editor-shell')?.querySelector('.format-toolbar')?.clientHeight ?? 0;
  const previewFocus = Math.min(
    preview.clientHeight * 0.7,
    editorFocus + (stacked ? 0 : toolbarHeight)
  );
  const previewTop = preview.getBoundingClientRect().top;
  const renderedHeadings = new Map(
    Array.from(article.querySelectorAll<HTMLElement>('.doc-heading')).map((heading) => [
      heading.id,
      heading
    ])
  );

  return headings.flatMap((heading) => {
    const rendered = renderedHeadings.get(heading.id);
    if (!rendered) return [];
    const position = Math.min(heading.from, view.state.doc.length);
    const editorTop = view.lineBlockAt(position).top + view.documentPadding.top;
    const renderedTop = rendered.getBoundingClientRect().top - previewTop + preview.scrollTop;
    return [{ editor: editorTop - editorFocus, preview: renderedTop - previewFocus }];
  });
}

export function mapAnchoredScroll(
  position: number,
  anchors: ScrollAnchor[],
  source: 'editor' | 'preview',
  sourceMax: number,
  targetMax: number
): number {
  if (sourceMax <= 0 || targetMax <= 0) return 0;
  const target = source === 'editor' ? 'preview' : 'editor';
  const points = [{ from: 0, to: 0 }];
  for (const anchor of anchors) {
    const from = anchor[source];
    const to = anchor[target];
    const previous = points[points.length - 1];
    if (
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      from <= previous.from ||
      to <= previous.to ||
      from >= sourceMax ||
      to >= targetMax
    )
      continue;
    points.push({ from, to });
  }
  points.push({ from: sourceMax, to: targetMax });
  const clamped = Math.max(0, Math.min(sourceMax, position));
  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];
    if (clamped <= right.from) {
      const progress = (clamped - left.from) / (right.from - left.from);
      return left.to + progress * (right.to - left.to);
    }
  }
  return targetMax;
}
