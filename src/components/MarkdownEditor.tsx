import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { markdown } from '@codemirror/lang-markdown';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  undo
} from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { search, SearchQuery, setSearchQuery } from '@codemirror/search';
import { EditorSelection, type Extension } from '@codemirror/state';
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers
} from '@codemirror/view';
import {
  Bold,
  Code2,
  Heading1,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  Search,
  Table2,
  Undo2
} from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import type { SearchOptions } from '../types';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  dark: boolean;
  lineWrap: boolean;
  onEditorReady: (view: EditorView | null) => void;
  onOpenSearch: () => void;
  searchOpen: boolean;
  searchQuery: string;
  searchOptions: SearchOptions;
}

export function MarkdownEditor({
  value,
  onChange,
  dark,
  lineWrap,
  onEditorReady,
  onOpenSearch,
  searchOpen,
  searchQuery,
  searchOptions
}: MarkdownEditorProps) {
  const ref = useRef<ReactCodeMirrorRef>(null);
  const extensions = useMemo<Extension[]>(
    () => [
      lineNumbers(),
      highlightActiveLineGutter(),
      history(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      markdown(),
      search({ top: true }),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      lineWrap ? EditorView.lineWrapping : []
    ],
    [lineWrap]
  );

  useEffect(() => {
    const view = ref.current?.view;
    if (!view) return;
    view.dispatch({
      effects: setSearchQuery.of(
        new SearchQuery({
          search: searchOpen ? searchQuery.trim() : '',
          caseSensitive: searchOptions.caseSensitive,
          wholeWord: searchOptions.wholeWord
        })
      )
    });
  }, [searchOpen, searchQuery, searchOptions]);

  const withView = (callback: (view: EditorView) => void) => {
    const view = ref.current?.view;
    if (!view) return;
    callback(view);
    view.focus();
  };

  return (
    <section className="editor-shell" aria-label="Markdown editor">
      <div className="format-toolbar" aria-label="Formatting toolbar">
        <ToolbarButton
          label="Bold"
          onClick={() => withView((view) => wrapSelection(view, '**', '**', 'bold text'))}
        >
          <Bold size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          onClick={() => withView((view) => wrapSelection(view, '_', '_', 'italic text'))}
        >
          <Italic size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Heading" onClick={() => withView(applyHeading)}>
          <Heading1 size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          onClick={() =>
            withView((view) => wrapSelection(view, '[', '](https://example.com)', 'link text'))
          }
        >
          <LinkIcon size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Inline code"
          onClick={() => withView((view) => wrapSelection(view, '`', '`', 'code'))}
        >
          <Code2 size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Code block"
          onClick={() =>
            withView((view) => insertBlock(view, '```ts\n', '\n```', 'const value = true;'))
          }
        >
          <Code2 size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Quote" onClick={() => withView((view) => prefixLines(view, '> '))}>
          <Quote size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Ordered list"
          onClick={() => withView((view) => prefixLines(view, '1. '))}
        >
          <ListOrdered size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Unordered list"
          onClick={() => withView((view) => prefixLines(view, '- '))}
        >
          <List size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Task list"
          onClick={() => withView((view) => prefixLines(view, '- [ ] '))}
        >
          <ListChecks size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Insert table" onClick={() => withView(insertTable)}>
          <Table2 size={17} aria-hidden="true" />
        </ToolbarButton>
        <span className="toolbar-divider" aria-hidden="true" />
        <ToolbarButton label="Undo" onClick={() => withView((view) => undo(view))}>
          <Undo2 size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => withView((view) => redo(view))}>
          <Redo2 size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Search and replace" onClick={onOpenSearch}>
          <Search size={17} aria-hidden="true" />
        </ToolbarButton>
      </div>
      <CodeMirror
        ref={ref}
        value={value}
        height="100%"
        autoFocus
        theme={dark ? githubDark : githubLight}
        extensions={extensions}
        basicSetup={false}
        onChange={onChange}
        onCreateEditor={(view) => onEditorReady(view)}
        onUpdate={(update) => {
          if (update.view !== ref.current?.view) {
            onEditorReady(update.view);
          }
        }}
      />
    </section>
  );
}

interface ToolbarButtonProps {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}

function ToolbarButton({ label, children, onClick }: ToolbarButtonProps) {
  return (
    <button
      className="icon-button toolbar-button"
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function wrapSelection(view: EditorView, before: string, after: string, placeholder: string): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.doc.sliceString(from, to);
  const text = selected || placeholder;
  const insert = `${before}${text}${after}`;
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.range(from + before.length, from + before.length + text.length)
  });
}

function insertBlock(view: EditorView, before: string, after: string, placeholder: string): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.doc.sliceString(from, to) || placeholder;
  const insert = `${before}${selected}${after}`;
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.cursor(from + before.length + selected.length)
  });
}

function applyHeading(view: EditorView): void {
  prefixLines(view, '# ');
}

function prefixLines(view: EditorView, prefix: string): void {
  const { from, to } = view.state.selection.main;
  const startLine = view.state.doc.lineAt(from);
  const endLine = view.state.doc.lineAt(to);
  const changes = [];
  for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
    const line = view.state.doc.line(lineNumber);
    changes.push({ from: line.from, insert: prefix });
  }
  view.dispatch({ changes });
}

function insertTable(view: EditorView): void {
  const table = '\n| Column | Column |\n| --- | --- |\n| Value | Value |\n';
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: table },
    selection: EditorSelection.cursor(from + table.length)
  });
}
