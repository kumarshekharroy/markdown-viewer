import type { EditorView } from '@codemirror/view';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Files,
  FolderOpen,
  Info,
  Monitor,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Printer,
  RotateCcw,
  Save,
  Search,
  Settings,
  Sun,
  TriangleAlert,
  Upload,
  X
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from './components/Dialog';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { exampleDocument } from './data/exampleDocument';
import {
  buildHtmlExport,
  documentFromContent,
  downloadText,
  filenameForMarkdown,
  folderFromDirectoryHandle,
  folderFromInputFiles,
  pickSaveAs,
  readMarkdownFile,
  saveToFileHandle,
  verifyPermission
} from './lib/files';
import { parseFrontMatter } from './lib/frontmatter';
import {
  convertGitHubBlobUrl,
  countMatches,
  displayNameFromPath,
  escapeRegExp,
  extractHeadings,
  resolveRelativePath
} from './lib/markdown';
import {
  clearApplicationData,
  deleteDraft,
  getRecent,
  latestDraft,
  removeRecent,
  saveDraft,
  upsertRecent
} from './lib/storage';
import type {
  DocumentState,
  DraftRecord,
  FolderDocument,
  FolderState,
  FontChoice,
  Preferences,
  RecentDocument,
  SearchOptions,
  ThemeMode
} from './types';

const MarkdownEditor = lazy(() =>
  import('./components/MarkdownEditor').then((module) => ({ default: module.MarkdownEditor }))
);

const MIN_CONTENT_WIDTH = 600;
const MAX_CONTENT_WIDTH = 1280;

const DEFAULT_PREFS: Preferences = {
  theme: 'system',
  lastThemeOverride: 'dark',
  fontSize: 18,
  lineHeight: 1.68,
  contentWidth: MAX_CONTENT_WIDTH,
  fontChoice: 'sans',
  codeWrap: false,
  reducedMotion: false,
  filePanelVisible: true,
  tocVisible: true,
  filePanelWidth: 280,
  tocPanelWidth: 296
};

const APP_NAME = 'Markdown Viewer';
const PREFS_KEY = 'markdown-viewer-preferences';
const LEGACY_PREFS_KEY = 'quietmark-preferences';
const MIN_PANEL_WIDTH = 220;
const MAX_PANEL_WIDTH = 460;
const SEARCH_MATCH_HIGHLIGHT = 'markdown-search-match';
const SEARCH_ACTIVE_HIGHLIGHT = 'markdown-search-active';
const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark', 'sepia', 'mint', 'sky', 'plum'];
const THEME_OVERRIDES: Exclude<ThemeMode, 'system'>[] = [
  'light',
  'dark',
  'sepia',
  'mint',
  'sky',
  'plum'
];
const FONT_CHOICES: FontChoice[] = ['system', 'sans', 'serif', 'slab', 'mono', 'rounded'];
const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
  sepia: 'Sepia',
  mint: 'Mint',
  sky: 'Sky',
  plum: 'Plum'
};

const filePickerTypes = [
  {
    description: 'Markdown files',
    accept: {
      'text/markdown': ['.md', '.markdown', '.mdown'],
      'text/plain': ['.txt']
    }
  }
];

type NoticeTone = 'info' | 'success' | 'warning' | 'error';

interface Notice {
  message: string;
  tone: NoticeTone;
}

type PanelSide = 'files' | 'toc';
type HighlightLike = object;
type HighlightConstructor = new (...ranges: Range[]) => HighlightLike;

interface HighlightRegistryLike {
  set(name: string, highlight: HighlightLike): void;
  delete(name: string): boolean;
}

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const resolvedTheme = resolveTheme(preferences.theme, systemDark);
  const dark = isDarkTheme(resolvedTheme);
  const [isEditing, setIsEditing] = useState(false);
  const [documentState, setDocumentState] = useState<DocumentState>(() =>
    documentFromContent(exampleDocument, 'Markdown Viewer Example', 'Example document', {
      id: 'example-document',
      path: 'example.md'
    })
  );
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<Notice>({
    message: 'Example document loaded. Open, paste, or drop a Markdown file to begin.',
    tone: 'info'
  });
  const [folder, setFolder] = useState<FolderState | null>(null);
  const [recent, setRecent] = useState<RecentDocument[]>([]);
  const [recoverableDraft, setRecoverableDraft] = useState<DraftRecord | undefined>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false
  });
  const [searchCursor, setSearchCursor] = useState(0);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [mobileFilesOpen, setMobileFilesOpen] = useState(false);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [compactLayout, setCompactLayout] = useState(() => isCompactLayout());
  const [viewportRightOffset, setViewportRightOffset] = useState(() => getViewportRightOffset());
  const [activeHeading, setActiveHeading] = useState('');
  const [renderedText, setRenderedText] = useState('');
  const [editorView, setEditorView] = useState<EditorView | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const pendingScrollRatioRef = useRef<number | null>(null);

  const parsed = useMemo(() => parseFrontMatter(documentState.content), [documentState.content]);
  const toc = useMemo(() => extractHeadings(parsed.body), [parsed.body]);
  const searchText = isEditing ? documentState.content : renderedText || parsed.body;
  const matchCount = useMemo(
    () => countMatches(searchText, searchQuery, searchOptions),
    [searchOptions, searchQuery, searchText]
  );

  const announce = useCallback((message: string, tone: NoticeTone = 'info') => {
    setNotice({ message, tone });
  }, []);

  const refreshRecent = useCallback(async () => {
    setRecent(await getRecent());
  }, []);

  useEffect(() => {
    refreshRecent();
    latestDraft().then((draft) => {
      if (draft?.dirty && draft.content.trim() && draft.id !== documentState.id) {
        setRecoverableDraft(draft);
      }
    });
  }, [documentState.id, refreshRecent]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 980px)');
    const listener = (event: MediaQueryListEvent) => setCompactLayout(event.matches);
    setCompactLayout(query.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const update = () => setViewportRightOffset(getViewportRightOffset());
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    if (!compactLayout) {
      setMobileFilesOpen(false);
      setMobileTocOpen(false);
    }
  }, [compactLayout]);

  useEffect(() => {
    directoryInputRef.current?.setAttribute('webkitdirectory', '');
    directoryInputRef.current?.setAttribute('directory', '');
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.motion = preferences.reducedMotion ? 'reduced' : 'full';
  }, [preferences.reducedMotion, resolvedTheme]);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return undefined;
    const timer = window.setTimeout(() => {
      saveDraft({
        id: documentState.id,
        title: documentState.title,
        content: documentState.content,
        sourceLabel: documentState.sourceLabel,
        sourceUrl: documentState.sourceUrl,
        path: documentState.path,
        updatedAt: Date.now(),
        dirty
      }).catch(() =>
        announce('Draft recovery could not be updated in this browser session.', 'warning')
      );
    }, 700);
    return () => window.clearTimeout(timer);
  }, [announce, dirty, documentState]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRenderedText(articleRef.current?.innerText ?? '');
    }, 80);
    return () => window.clearTimeout(timer);
  }, [parsed.body, isEditing]);

  useEffect(() => {
    if (isEditing || !searchOpen || !searchQuery.trim()) {
      clearRenderedSearchHighlights();
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const ranges = findRenderedSearchRanges(articleRef.current, searchQuery, searchOptions);
      const activeIndex = ranges.length > 0 ? clamp(searchCursor || 1, 1, ranges.length) : 0;
      paintRenderedSearchHighlights(ranges, activeIndex);
    }, 40);

    return () => {
      window.clearTimeout(timer);
      clearRenderedSearchHighlights();
    };
  }, [
    isEditing,
    matchCount,
    parsed.body,
    renderedText,
    searchCursor,
    searchOpen,
    searchOptions,
    searchQuery
  ]);

  useEffect(() => {
    const article = articleRef.current;
    if (!article || toc.length === 0) return undefined;
    const headings = Array.from(article.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id]'));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActiveHeading(visible.target.id);
        }
      },
      { rootMargin: '-20% 0px -65% 0px' }
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [toc, parsed.body, isEditing]);

  useEffect(() => {
    const container =
      scrollContainerRef.current ?? document.querySelector<HTMLElement>('.document-stage');
    if (!container) return undefined;
    const key = `quietmark-scroll-${documentState.id}`;
    const saved = Number(sessionStorage.getItem(key) ?? 0);
    if (saved > 0) {
      container.scrollTop = saved;
    }
    const savePosition = () => sessionStorage.setItem(key, String(container.scrollTop));
    container.addEventListener('scroll', savePosition, { passive: true });
    return () => container.removeEventListener('scroll', savePosition);
  }, [documentState.id, isEditing]);

  useEffect(() => {
    if (pendingScrollRatioRef.current === null) return undefined;
    const timer = window.setTimeout(() => {
      const target = isEditing
        ? editorView?.scrollDOM
        : getReaderScrollElement(scrollContainerRef.current);
      if (!target) return;
      restoreScrollRatio(target, pendingScrollRatioRef.current ?? 0);
      pendingScrollRatioRef.current = null;
    }, 80);
    return () => window.clearTimeout(timer);
  }, [editorView, isEditing, parsed.body]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setPreferences((current) => ({ ...current, tocVisible: true }));
        if (compactLayout) {
          setMobileTocOpen(true);
        }
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [compactLayout]);

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"], .cm-editor')) return;
      const text = event.clipboardData?.getData('text/plain');
      if (!text || text.trim().length < 3 || !looksLikeMarkdown(text)) return;
      event.preventDefault();
      if (!(await confirmReplace())) return;
      applyDocument(
        documentFromContent(text, 'Pasted Markdown', 'Clipboard paste', {
          path: 'pasted.md'
        }),
        false
      );
      announce('Pasted Markdown loaded locally.', 'success');
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  });

  const confirmReplace = useCallback(async () => {
    if (!dirty) return true;
    return window.confirm('This document has unsaved changes. Replace it anyway?');
  }, [dirty]);

  const applyDocument = useCallback((next: DocumentState, markDirty: boolean) => {
    setDocumentState(next);
    setDirty(markDirty);
    setIsEditing(false);
    setSearchCursor(0);
    if (!markDirty) {
      deleteDraft(next.id).catch(() => undefined);
    }
  }, []);

  const rememberDocument = useCallback(
    async (doc: DocumentState) => {
      await upsertRecent({
        id: doc.id,
        title: doc.title,
        sourceLabel: doc.sourceLabel,
        sourceUrl: doc.sourceUrl,
        updatedAt: Date.now(),
        size: doc.content.length,
        fileHandle: doc.fileHandle
      });
      await refreshRecent();
    },
    [refreshRecent]
  );

  const openFile = async () => {
    if (!(await confirmReplace())) return;

    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: filePickerTypes
        });
        const file = await handle.getFile();
        const content = await readMarkdownFile(file);
        const doc = documentFromContent(content, displayNameFromPath(file.name), file.name, {
          fileHandle: handle,
          canDirectSave: true,
          lastModified: file.lastModified,
          path: file.name
        });
        applyDocument(doc, false);
        await rememberDocument(doc);
        announce(
          'File opened. Direct save is available while permission remains granted.',
          'success'
        );
      } catch (error) {
        if (isAbort(error)) return;
        announce(errorMessage(error, 'The file could not be opened.'), 'error');
      }
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileInput = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!(await confirmReplace())) return;
    try {
      const content = await readMarkdownFile(file);
      const doc = documentFromContent(content, displayNameFromPath(file.name), file.name, {
        lastModified: file.lastModified,
        path: file.name
      });
      applyDocument(doc, false);
      await rememberDocument(doc);
      announce(
        'File opened. Use Download updated file to keep changes because this browser did not grant direct file access.',
        'success'
      );
    } catch (error) {
      announce(errorMessage(error, 'The file could not be opened.'), 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openFolder = async () => {
    if (!(await confirmReplace())) return;

    if (window.showDirectoryPicker) {
      try {
        const handle = await window.showDirectoryPicker();
        await applyFolder(await folderFromDirectoryHandle(handle));
      } catch (error) {
        if (isAbort(error)) return;
        announce(errorMessage(error, 'The folder could not be opened.'), 'error');
      }
      return;
    }

    directoryInputRef.current?.click();
  };

  const handleDirectoryInput = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!(await confirmReplace())) return;
    try {
      await applyFolder(await folderFromInputFiles(files));
    } catch (error) {
      announce(errorMessage(error, 'The folder could not be opened.'), 'error');
    } finally {
      if (directoryInputRef.current) directoryInputRef.current.value = '';
    }
  };

  const applyFolder = async (nextFolder: FolderState) => {
    setFolder((previous) => {
      previous?.assets.forEach((url) => URL.revokeObjectURL(url));
      return nextFolder;
    });

    if (nextFolder.documents.length === 0) {
      announce('No supported Markdown files were found in that folder.', 'warning');
      return;
    }

    const first = nextFolder.documents[0];
    const doc = documentFromFolderDocument(first);
    applyDocument(doc, false);
    await rememberDocument(doc);
    setPreferences((current) => ({ ...current, filePanelVisible: true }));
    if (compactLayout) {
      setMobileFilesOpen(true);
    }
    announce(
      `${nextFolder.documents.length} Markdown file${nextFolder.documents.length === 1 ? '' : 's'} found in ${nextFolder.name}.`,
      'success'
    );
  };

  const scrollToHeading = useCallback(
    (id: string) => {
      const cleanId = id.replace(/^#/, '');
      if (scrollHeadingIntoView(cleanId, preferences.reducedMotion, scrollContainerRef.current)) {
        setActiveHeading(cleanId);
      }
    },
    [preferences.reducedMotion]
  );

  useEffect(() => {
    const handleHashChange = () => {
      if (!window.location.hash || isEditing) return;
      window.setTimeout(() => scrollToHeading(window.location.hash), 0);
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isEditing, parsed.body, scrollToHeading]);

  const openFolderDocument = async (entry: FolderDocument, hash?: string) => {
    if (!(await confirmReplace())) return;
    const doc = documentFromFolderDocument(entry);
    applyDocument(doc, false);
    await rememberDocument(doc);
    if (hash) {
      window.setTimeout(() => scrollToHeading(hash), 120);
    }
  };

  const resolveAsset = useCallback(
    (src: string) => {
      if (!folder || !documentState.path || /^(https?:|data:|blob:)/i.test(src)) return undefined;
      return folder.assets.get(resolveRelativePath(documentState.path, src));
    },
    [documentState.path, folder]
  );

  const navigateLocal = (href: string) => {
    if (!folder || !documentState.path) return;
    const hash = href.includes('#') ? `#${href.split('#').slice(1).join('#')}` : undefined;
    const targetPath = resolveRelativePath(documentState.path, href);
    const entry = folder.documents.find((item) => item.path === targetPath);
    if (!entry) {
      announce('That linked Markdown file was not found in the opened folder.', 'warning');
      return;
    }
    openFolderDocument(entry, hash);
  };

  const saveDocument = async () => {
    try {
      if (documentState.fileHandle && documentState.canDirectSave) {
        await saveToFileHandle(documentState.fileHandle, documentState.content);
        markSaved();
        announce('Changes saved to the original file.', 'success');
        return;
      }
      downloadText(filenameForMarkdown(documentState.title), documentState.content);
      markSaved();
      announce(
        'Updated Markdown downloaded. The original file was not modified by the browser.',
        'success'
      );
    } catch (error) {
      announce(errorMessage(error, 'Changes could not be saved.'), 'error');
    }
  };

  const saveAs = async () => {
    try {
      const direct = await pickSaveAs(
        filenameForMarkdown(documentState.title),
        documentState.content
      );
      markSaved();
      announce(direct ? 'Saved as a new file.' : 'Updated Markdown downloaded.', 'success');
    } catch (error) {
      if (isAbort(error)) return;
      announce(errorMessage(error, 'Save As failed.'), 'error');
    }
  };

  const markSaved = () => {
    setDirty(false);
    deleteDraft(documentState.id).catch(() => undefined);
    if (folder && documentState.path) {
      setFolder({
        ...folder,
        documents: folder.documents.map((entry) =>
          entry.path === documentState.path ? { ...entry, content: documentState.content } : entry
        )
      });
    }
    rememberDocument(documentState).catch(() => undefined);
  };

  const copyRaw = async () => {
    await navigator.clipboard.writeText(documentState.content);
    announce('Raw Markdown copied.', 'success');
  };

  const copyRendered = async () => {
    await navigator.clipboard.writeText(articleRef.current?.innerText ?? parsed.body);
    announce('Rendered text copied.', 'success');
  };

  const downloadHtml = () => {
    const html = buildHtmlExport(documentState.title, articleRef.current?.innerHTML ?? '');
    downloadText(
      `${filenameForMarkdown(documentState.title).replace(/\.(md|markdown|mdown|txt)$/i, '')}.html`,
      html,
      'text/html;charset=utf-8'
    );
    announce('Rendered HTML downloaded.', 'success');
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        announce('Clipboard text is empty.', 'warning');
        return;
      }
      if (!(await confirmReplace())) return;
      const doc = documentFromContent(text, 'Pasted Markdown', 'Clipboard paste', {
        path: 'pasted.md'
      });
      applyDocument(doc, false);
      announce('Clipboard Markdown loaded locally.', 'success');
    } catch (error) {
      announce(errorMessage(error, 'Clipboard text could not be read.'), 'error');
    }
  };

  const loadExample = async () => {
    if (!(await confirmReplace())) return;
    applyDocument(
      documentFromContent(exampleDocument, 'Markdown Viewer Example', 'Example document', {
        id: 'example-document',
        path: 'example.md'
      }),
      false
    );
    announce('Example document loaded.', 'success');
  };

  const loadFromUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      announce('Enter a public Markdown URL.', 'warning');
      return;
    }
    if (!(await confirmReplace())) return;

    let url: URL;
    try {
      url = new URL(convertGitHubBlobUrl(trimmed));
    } catch {
      announce('That URL is not valid.', 'error');
      return;
    }

    const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !localHttp) {
      announce(
        'Only HTTPS Markdown URLs are loaded, except localhost during development.',
        'error'
      );
      return;
    }

    setUrlLoading(true);
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText || 'Request failed'}`);
      }
      const text = await response.text();
      if (!text.trim()) {
        throw new Error('The URL returned an empty file.');
      }
      if (text.length > 8 * 1024 * 1024) {
        throw new Error('The URL returned more than 8 MB of Markdown.');
      }
      const name = displayNameFromPath(url.pathname.split('/').pop() || 'Remote Markdown');
      const doc = documentFromContent(text, name, url.href, {
        sourceUrl: url.href,
        path: url.pathname.split('/').pop() || 'remote.md'
      });
      applyDocument(doc, false);
      await rememberDocument(doc);
      setUrlDialogOpen(false);
      announce(
        'Public Markdown URL loaded. Private repositories require an authenticated integration, which this app does not use.',
        'success'
      );
    } catch (error) {
      announce(
        errorMessage(
          error,
          'The URL could not be loaded. It may be private, blocked by CORS, offline, or not a Markdown file.'
        ),
        'error'
      );
    } finally {
      setUrlLoading(false);
    }
  };

  const reopenRecent = async (item: RecentDocument) => {
    if (item.fileHandle) {
      try {
        const allowed = await verifyPermission(item.fileHandle, 'read');
        if (!allowed) {
          announce(
            'The browser needs you to choose that file again before it can be reopened.',
            'warning'
          );
          return;
        }
        const file = await item.fileHandle.getFile();
        const content = await readMarkdownFile(file);
        const doc = documentFromContent(content, displayNameFromPath(file.name), file.name, {
          id: item.id,
          fileHandle: item.fileHandle,
          canDirectSave: true,
          path: file.name,
          lastModified: file.lastModified
        });
        applyDocument(doc, false);
        await rememberDocument(doc);
        announce('Recent file reopened with browser permission.', 'success');
      } catch (error) {
        announce(errorMessage(error, 'The recent file could not be reopened.'), 'error');
      }
      return;
    }

    if (item.sourceUrl) {
      setUrlInput(item.sourceUrl);
      setUrlDialogOpen(true);
      return;
    }

    announce(
      'Browsers cannot permanently reopen that local file without you granting access again.',
      'warning'
    );
  };

  const clearData = async () => {
    if (
      !window.confirm(
        'Clear recent documents, drafts, and reading preferences stored in this browser?'
      )
    )
      return;
    await clearApplicationData();
    setRecent([]);
    setRecoverableDraft(undefined);
    setPreferences(DEFAULT_PREFS);
    announce('Local application data cleared from this browser.', 'success');
  };

  const restoreDraft = () => {
    if (!recoverableDraft) return;
    applyDocument(
      documentFromContent(
        recoverableDraft.content,
        recoverableDraft.title,
        recoverableDraft.sourceLabel,
        {
          id: recoverableDraft.id,
          path: recoverableDraft.path,
          sourceUrl: recoverableDraft.sourceUrl
        }
      ),
      true
    );
    setRecoverableDraft(undefined);
    announce('Unsaved draft restored from this browser.', 'success');
  };

  const discardDraft = async () => {
    if (!recoverableDraft) return;
    await deleteDraft(recoverableDraft.id);
    setRecoverableDraft(undefined);
    announce('Recovered draft discarded.', 'info');
  };

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    await handleFileInput(event.dataTransfer.files);
  };

  const updateContent = (content: string) => {
    setDocumentState((current) => ({ ...current, content }));
    setDirty(true);
  };

  const moveSearch = (direction: 'next' | 'previous') => {
    if (!searchQuery.trim()) return;
    if (matchCount === 0) return;

    const nextCursor =
      direction === 'next'
        ? searchCursor <= 0 || searchCursor >= matchCount
          ? 1
          : searchCursor + 1
        : searchCursor <= 1
          ? matchCount
          : searchCursor - 1;

    setSearchCursor(nextCursor);

    if (isEditing && editorView) {
      selectEditorSearchMatch(editorView, searchQuery, searchOptions, nextCursor);
      return;
    }

    window.setTimeout(() => {
      const range = findRenderedSearchRanges(articleRef.current, searchQuery, searchOptions)[
        nextCursor - 1
      ];
      if (!range) return;
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      scrollRangeIntoStage(range, scrollContainerRef.current, preferences.reducedMotion);
    }, 0);
  };

  const cycleTheme = () => {
    setPreferences((current) => {
      if (current.theme === 'system') {
        return { ...current, theme: current.lastThemeOverride };
      }

      return {
        ...current,
        lastThemeOverride: current.theme,
        theme: 'system'
      };
    });
  };

  const openSearch = () => {
    setSearchOpen(true);
    setPreferences((current) => ({ ...current, tocVisible: true }));
    if (compactLayout) {
      setMobileTocOpen(true);
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchCursor(0);
  };

  const updatePanelWidth = (side: PanelSide, nextWidth: number) => {
    const key = side === 'files' ? 'filePanelWidth' : 'tocPanelWidth';
    setPreferences((current) => ({
      ...current,
      [key]: clamp(Math.round(nextWidth), MIN_PANEL_WIDTH, MAX_PANEL_WIDTH)
    }));
  };

  const startPanelResize = (side: PanelSide, event: React.PointerEvent) => {
    if (compactLayout) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = side === 'files' ? preferences.filePanelWidth : preferences.tocPanelWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      updatePanelWidth(side, side === 'files' ? startWidth + delta : startWidth - delta);
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handlePanelResizeKeydown = (side: PanelSide, event: React.KeyboardEvent) => {
    const amount =
      event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight') ? 32 : 12;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const sign = event.key === 'ArrowRight' ? 1 : -1;
    const currentWidth = side === 'files' ? preferences.filePanelWidth : preferences.tocPanelWidth;
    updatePanelWidth(side, currentWidth + (side === 'files' ? sign : -sign) * amount);
  };

  const captureScrollRatio = () => {
    const target = isEditing
      ? editorView?.scrollDOM
      : getReaderScrollElement(scrollContainerRef.current);
    pendingScrollRatioRef.current = target ? getScrollRatio(target) : 0;
  };

  const toggleEditing = () => {
    captureScrollRatio();
    setIsEditing((current) => !current);
  };

  const toggleFilePanel = () => {
    if (compactLayout) {
      setMobileFilesOpen(true);
      setPreferences((current) => ({ ...current, filePanelVisible: true }));
      return;
    }
    setPreferences((current) => ({ ...current, filePanelVisible: !current.filePanelVisible }));
  };

  const toggleTocPanel = () => {
    if (compactLayout) {
      setMobileTocOpen(true);
      setPreferences((current) => ({ ...current, tocVisible: true }));
      return;
    }
    setPreferences((current) => ({ ...current, tocVisible: !current.tocVisible }));
  };

  const workspaceClass = [
    'workspace',
    preferences.filePanelVisible ? 'workspace--files-visible' : 'workspace--files-hidden',
    preferences.tocVisible ? 'workspace--toc-visible' : 'workspace--toc-hidden',
    isEditing ? 'workspace--editing' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const renderFilePanel = compactLayout ? mobileFilesOpen : preferences.filePanelVisible;
  const renderTocPanel = compactLayout ? mobileTocOpen : preferences.tocVisible;
  const visibleRecent = recent.slice(0, 3);
  const appStyle = {
    '--file-panel-width': `${preferences.filePanelWidth}px`,
    '--toc-panel-width': `${preferences.tocPanelWidth}px`,
    '--viewport-right-offset': `${viewportRightOffset}px`
  } as React.CSSProperties;

  useEffect(() => {
    if (!searchOpen) return undefined;
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [renderTocPanel, searchOpen]);

  return (
    <div
      className="app"
      style={appStyle}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <header className={`app-header ${isEditing ? 'is-editing' : ''}`}>
        <div className="header-title-area">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="brand-icon" />
          <div className="title-block">
            <span className="app-name">{APP_NAME}</span>
            <strong title={documentState.sourceLabel}>{documentState.title}</strong>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="control-button control-button--primary"
            type="button"
            onClick={openFile}
          >
            <Upload size={17} aria-hidden="true" />
            Open
          </button>
          {isEditing ? (
            <button className="control-button" type="button" onClick={saveDocument}>
              <Save size={17} aria-hidden="true" />
              Save
            </button>
          ) : null}
          <IconToggle
            label={isEditing ? 'Done editing' : 'Edit Markdown'}
            pressed={isEditing}
            onClick={toggleEditing}
            variant={isEditing ? 'done' : undefined}
          >
            {isEditing ? (
              <Check size={18} aria-hidden="true" />
            ) : (
              <Edit3 size={18} aria-hidden="true" />
            )}
          </IconToggle>
          <IconToggle
            label={themeLabel(preferences.theme, dark)}
            pressed={preferences.theme !== 'system'}
            onClick={cycleTheme}
          >
            {preferences.theme === 'system' ? (
              <Monitor size={18} aria-hidden="true" />
            ) : preferences.theme === 'dark' ? (
              <Moon size={18} aria-hidden="true" />
            ) : (
              <Sun size={18} aria-hidden="true" />
            )}
          </IconToggle>
          <MoreMenu
            canDirectSave={documentState.canDirectSave}
            dirty={dirty}
            onSave={saveDocument}
            onSaveAs={saveAs}
            onOpenFolder={openFolder}
            onCopyRaw={copyRaw}
            onCopyRendered={copyRendered}
            onDownloadHtml={downloadHtml}
            onPrint={() => window.print()}
            onLoadUrl={() => setUrlDialogOpen(true)}
            onPaste={pasteFromClipboard}
            onExample={loadExample}
            onSettings={() => setSettingsOpen(true)}
            onPrivacy={() => setPrivacyOpen(true)}
            onClearData={clearData}
          />
        </div>
      </header>

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
        onChange={(event) => handleFileInput(event.currentTarget.files)}
      />
      <input
        ref={directoryInputRef}
        className="visually-hidden"
        type="file"
        multiple
        onChange={(event) => handleDirectoryInput(event.currentTarget.files)}
      />
      <div className="visually-hidden" role="status" aria-live="polite">
        {notice.message}
      </div>

      {recoverableDraft ? (
        <section className="recovery-banner" aria-live="polite">
          <span className="recovery-banner__icon" aria-hidden="true">
            <TriangleAlert size={21} />
          </span>
          <div className="recovery-banner__copy">
            <strong>Unsaved draft found</strong>
            <span>
              {recoverableDraft.title} from {new Date(recoverableDraft.updatedAt).toLocaleString()}
            </span>
          </div>
          <div className="recovery-banner__actions">
            <button className="control-button" type="button" onClick={restoreDraft}>
              Restore
            </button>
            <button className="ghost-button" type="button" onClick={discardDraft}>
              Discard
            </button>
          </div>
        </section>
      ) : null}

      {(mobileFilesOpen || mobileTocOpen) && compactLayout ? (
        <button
          className="drawer-backdrop"
          type="button"
          aria-label="Close open panel"
          onClick={() => {
            setMobileFilesOpen(false);
            setMobileTocOpen(false);
          }}
        />
      ) : null}

      <div className={workspaceClass}>
        {renderFilePanel ? (
          <aside
            className={`file-panel ${mobileFilesOpen ? 'is-open' : ''}`}
            aria-label="Files and recent documents"
          >
            <PanelHeader
              title="Files"
              onClose={() => setMobileFilesOpen(false)}
              actions={
                <button
                  className="panel-action tooltip-button"
                  type="button"
                  onClick={openFolder}
                  aria-label="Open folder"
                  data-tooltip="Open folder"
                >
                  <FolderOpen size={17} aria-hidden="true" />
                  <span>Open</span>
                </button>
              }
            />
            {!window.showDirectoryPicker ? (
              <div className="panel-section panel-section--compact">
                <p className="browser-note">
                  Folder access varies by browser. This browser uses a directory picker fallback
                  when available.
                </p>
              </div>
            ) : null}
            {folder ? (
              <div className="panel-section">
                <h2>{folder.name}</h2>
                <nav className="file-tree" aria-label="Folder Markdown files">
                  {folder.documents.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      className={[
                        entry.path === documentState.path ? 'is-active' : '',
                        dirty && entry.path === documentState.path ? 'is-dirty' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => openFolderDocument(entry)}
                      title={
                        dirty && entry.path === documentState.path
                          ? `${entry.path} has unsaved changes`
                          : entry.path
                      }
                    >
                      {dirty && entry.path === documentState.path ? (
                        <TriangleAlert
                          className="file-tree__marker"
                          size={15}
                          aria-label="Unsaved changes"
                        />
                      ) : (
                        <Files className="file-tree__marker" size={15} aria-hidden="true" />
                      )}
                      <span>{entry.path}</span>
                    </button>
                  ))}
                </nav>
              </div>
            ) : null}
            <div className="panel-section recent-section">
              <h2>Recent</h2>
              {recent.length === 0 ? (
                <p className="browser-note">
                  Recent document metadata appears here. File contents are not stored in this list.
                </p>
              ) : (
                <ul className="recent-list">
                  {visibleRecent.map((item) => (
                    <li
                      key={item.id}
                      className={[
                        item.id === documentState.id ? 'is-active' : '',
                        dirty && item.id === documentState.id ? 'is-dirty' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <button type="button" onClick={() => reopenRecent(item)}>
                        <strong>{item.title}</strong>
                        <span>{item.sourceLabel}</span>
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={async () => {
                          await removeRecent(item.id);
                          await refreshRecent();
                        }}
                        aria-label={`Remove ${item.title} from recent documents`}
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <PanelResizer
              side="files"
              label="Resize file sidebar"
              onPointerDown={startPanelResize}
              onKeyDown={handlePanelResizeKeydown}
            />
          </aside>
        ) : null}

        <main
          ref={scrollContainerRef}
          className={`document-stage ${isEditing ? 'document-stage--edit' : 'document-stage--read'}`}
          tabIndex={-1}
        >
          {parsed.error ? (
            <div className="render-warning">Front matter warning: {parsed.error}</div>
          ) : null}
          {!isEditing ? (
            <MarkdownRenderer
              markdown={parsed.body}
              toc={toc}
              preferences={preferences}
              dark={dark}
              currentPath={documentState.path}
              resolveAsset={resolveAsset}
              onNavigateLocal={navigateLocal}
              articleRef={articleRef}
            />
          ) : null}
          {isEditing ? (
            <Suspense fallback={<EditorFallback />}>
              <MarkdownEditor
                value={documentState.content}
                onChange={updateContent}
                dark={dark}
                lineWrap={preferences.codeWrap}
                onEditorReady={setEditorView}
              />
            </Suspense>
          ) : null}
        </main>

        {renderTocPanel ? (
          <TocPanel
            open={mobileTocOpen}
            onClose={() => setMobileTocOpen(false)}
            toc={toc}
            activeHeading={activeHeading}
            searchOpen={searchOpen}
            searchInputRef={searchInputRef}
            searchQuery={searchQuery}
            searchOptions={searchOptions}
            searchCursor={searchCursor}
            matchCount={matchCount}
            onOpenSearch={openSearch}
            onCloseSearch={closeSearch}
            onSearchQueryChange={(value) => {
              setSearchQuery(value);
              setSearchCursor(0);
            }}
            onSearchOptionsChange={setSearchOptions}
            onMoveSearch={moveSearch}
            onNavigateHeading={scrollToHeading}
            onResizePointerDown={startPanelResize}
            onResizeKeyDown={handlePanelResizeKeydown}
          />
        ) : null}
      </div>

      <EdgePanelToggle
        side="left"
        visible={renderFilePanel}
        dirty={dirty}
        label={renderFilePanel ? 'Hide file sidebar' : 'Show file sidebar'}
        onClick={toggleFilePanel}
      />
      <EdgePanelToggle
        side="right"
        visible={renderTocPanel}
        label={renderTocPanel ? 'Hide table of contents' : 'Show table of contents'}
        onClick={toggleTocPanel}
      />

      <Dialog
        open={urlDialogOpen}
        title="Load Markdown URL"
        onClose={() => setUrlDialogOpen(false)}
      >
        <div className="form-grid">
          <label>
            Public HTTPS Markdown URL
            <input
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              placeholder="https://raw.githubusercontent.com/user/repo/main/README.md"
            />
          </label>
          <p>
            Standard GitHub blob links are converted to raw links when the path is clear. Private
            repositories are not accessible because Markdown Viewer does not use authentication or
            proxies.
          </p>
          <div className="dialog-actions">
            <button
              className="control-button"
              type="button"
              onClick={loadFromUrl}
              disabled={urlLoading}
            >
              {urlLoading ? 'Loading...' : 'Load URL'}
            </button>
            <button className="ghost-button" type="button" onClick={() => setUrlDialogOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={settingsOpen}
        title="Reading Preferences"
        onClose={() => setSettingsOpen(false)}
      >
        <PreferencesForm
          preferences={preferences}
          setPreferences={setPreferences}
          onReset={() => setPreferences(DEFAULT_PREFS)}
        />
      </Dialog>

      <Dialog
        open={privacyOpen}
        title="Privacy and Local Data"
        onClose={() => setPrivacyOpen(false)}
      >
        <div className="privacy-copy">
          <p>
            Markdown Viewer runs entirely in this browser. Local files and opened folders are never
            uploaded by the app, and there are no analytics, cookies, accounts, or tracking scripts.
          </p>
          <p>
            Draft recovery stores unsaved Markdown in IndexedDB on this device. Recent documents
            store metadata and, where the browser supports it, a file handle that still requires
            permission before reuse.
          </p>
          <p>
            Loading a public URL uses the browser's normal network and CORS rules. Markdown Viewer
            does not bypass private repository permissions or send content through a server proxy.
          </p>
        </div>
      </Dialog>
    </div>
  );
}

function IconToggle({
  label,
  pressed,
  onClick,
  children,
  variant
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'done';
}) {
  return (
    <button
      className={`icon-button tooltip-button ${variant === 'done' ? 'icon-button--done' : ''}`}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      data-tooltip={label}
    >
      {children}
    </button>
  );
}

function EdgePanelToggle({
  side,
  visible,
  dirty = false,
  label,
  onClick
}: {
  side: 'left' | 'right';
  visible: boolean;
  dirty?: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon =
    side === 'left'
      ? visible
        ? PanelLeftClose
        : PanelLeftOpen
      : visible
        ? PanelRightClose
        : PanelRightOpen;
  return (
    <button
      className={[
        'edge-toggle',
        'tooltip-button',
        `edge-toggle--${side}`,
        visible ? 'is-open' : '',
        dirty ? 'is-dirty' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={visible}
      data-tooltip={label}
    >
      <Icon size={18} aria-hidden="true" />
      {dirty ? <span className="edge-toggle__dot" aria-hidden="true" /> : null}
    </button>
  );
}

function PanelResizer({
  side,
  label,
  onPointerDown,
  onKeyDown
}: {
  side: PanelSide;
  label: string;
  onPointerDown: (side: PanelSide, event: React.PointerEvent) => void;
  onKeyDown: (side: PanelSide, event: React.KeyboardEvent) => void;
}) {
  return (
    <div
      className={`panel-resizer panel-resizer--${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      onPointerDown={(event) => onPointerDown(side, event)}
      onKeyDown={(event) => onKeyDown(side, event)}
    />
  );
}

function EditorFallback() {
  return (
    <section className="editor-shell editor-shell--loading" aria-label="Markdown editor loading">
      Loading editor...
    </section>
  );
}

interface MoreMenuProps {
  canDirectSave: boolean;
  dirty: boolean;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenFolder: () => void;
  onCopyRaw: () => void;
  onCopyRendered: () => void;
  onDownloadHtml: () => void;
  onPrint: () => void;
  onLoadUrl: () => void;
  onPaste: () => void;
  onExample: () => void;
  onSettings: () => void;
  onPrivacy: () => void;
  onClearData: () => void;
}

function MoreMenu({
  canDirectSave,
  dirty,
  onSave,
  onSaveAs,
  onOpenFolder,
  onCopyRaw,
  onCopyRendered,
  onDownloadHtml,
  onPrint,
  onLoadUrl,
  onPaste,
  onExample,
  onSettings,
  onPrivacy,
  onClearData
}: MoreMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [open]);

  return (
    <div className="more-menu" ref={menuRef}>
      <button
        className="icon-button tooltip-button"
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        data-tooltip="More actions"
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open ? (
        <div className="menu-popover">
          <button type="button" onClick={() => run(onSave)}>
            <Save size={16} aria-hidden="true" />
            {canDirectSave ? 'Save' : dirty ? 'Download updated file' : 'Download file'}
          </button>
          <button type="button" onClick={() => run(onSaveAs)}>
            <Download size={16} aria-hidden="true" />
            Save As
          </button>
          <button type="button" onClick={() => run(onOpenFolder)}>
            <FolderOpen size={16} aria-hidden="true" />
            Open folder
          </button>
          <button type="button" onClick={() => run(onLoadUrl)}>
            <Upload size={16} aria-hidden="true" />
            Load URL
          </button>
          <button type="button" onClick={() => run(onPaste)}>
            <Upload size={16} aria-hidden="true" />
            Paste Markdown
          </button>
          <button type="button" onClick={() => run(onExample)}>
            <Files size={16} aria-hidden="true" />
            Load example
          </button>
          <hr />
          <button type="button" onClick={() => run(onCopyRaw)}>
            Copy raw Markdown
          </button>
          <button type="button" onClick={() => run(onCopyRendered)}>
            Copy rendered text
          </button>
          <button type="button" onClick={() => run(onDownloadHtml)}>
            Download rendered HTML
          </button>
          <button type="button" onClick={() => run(onPrint)}>
            <Printer size={16} aria-hidden="true" />
            Print
          </button>
          <hr />
          <button type="button" onClick={() => run(onSettings)}>
            <Settings size={16} aria-hidden="true" />
            Preferences
          </button>
          <button type="button" onClick={() => run(onPrivacy)}>
            <Info size={16} aria-hidden="true" />
            Privacy
          </button>
          <button type="button" onClick={() => run(onClearData)}>
            <RotateCcw size={16} aria-hidden="true" />
            Clear local data
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TocPanel({
  open,
  onClose,
  toc,
  activeHeading,
  searchOpen,
  searchInputRef,
  searchQuery,
  searchOptions,
  searchCursor,
  matchCount,
  onOpenSearch,
  onCloseSearch,
  onSearchQueryChange,
  onSearchOptionsChange,
  onMoveSearch,
  onNavigateHeading,
  onResizePointerDown,
  onResizeKeyDown
}: {
  open: boolean;
  onClose: () => void;
  toc: ReturnType<typeof extractHeadings>;
  activeHeading: string;
  searchOpen: boolean;
  searchInputRef: React.RefObject<HTMLInputElement>;
  searchQuery: string;
  searchOptions: SearchOptions;
  searchCursor: number;
  matchCount: number;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onSearchQueryChange: (value: string) => void;
  onSearchOptionsChange: React.Dispatch<React.SetStateAction<SearchOptions>>;
  onMoveSearch: (direction: 'next' | 'previous') => void;
  onNavigateHeading: (id: string) => void;
  onResizePointerDown: (side: PanelSide, event: React.PointerEvent) => void;
  onResizeKeyDown: (side: PanelSide, event: React.KeyboardEvent) => void;
}) {
  return (
    <aside className={`toc-panel ${open ? 'is-open' : ''}`} aria-label="Table of contents">
      <PanelHeader
        title="Contents"
        onClose={onClose}
        actions={
          <button
            className="panel-action tooltip-button"
            type="button"
            onClick={searchOpen ? onCloseSearch : onOpenSearch}
            aria-label="Find in document"
            aria-expanded={searchOpen}
            data-tooltip="Find in document"
          >
            <Search size={17} aria-hidden="true" />
            <span>Find</span>
          </button>
        }
      />
      {searchOpen ? (
        <div className="toc-search-block">
          <section className="toc-search" aria-label="Document search">
            <label>
              <span className="visually-hidden">Search text</span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="Search this document"
              />
            </label>
            <div className="toc-search__controls">
              <span className="match-count">
                {matchCount === 0 ? 'No matches' : `${searchCursor || 1} of ${matchCount}`}
              </span>
              <button
                className="icon-button"
                type="button"
                onClick={() => onMoveSearch('previous')}
                aria-label="Previous match"
              >
                <ChevronLeft size={17} aria-hidden="true" />
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={() => onMoveSearch('next')}
                aria-label="Next match"
              >
                <ChevronRight size={17} aria-hidden="true" />
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={onCloseSearch}
                aria-label="Close search"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <div className="toc-search__options">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={searchOptions.caseSensitive}
                  onChange={(event) =>
                    onSearchOptionsChange((current) => ({
                      ...current,
                      caseSensitive: event.target.checked
                    }))
                  }
                />
                Case
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={searchOptions.wholeWord}
                  onChange={(event) =>
                    onSearchOptionsChange((current) => ({
                      ...current,
                      wholeWord: event.target.checked
                    }))
                  }
                />
                Whole word
              </label>
            </div>
          </section>
        </div>
      ) : null}
      <nav className="toc-list" aria-label="Document headings">
        {toc.length === 0 ? (
          <p className="browser-note">Headings in the current document appear here.</p>
        ) : (
          toc.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => window.setTimeout(() => onNavigateHeading(item.id), 0)}
              className={activeHeading === item.id ? 'is-active' : ''}
              style={{ paddingLeft: `${Math.max(0, item.level - 1) * 12 + 8}px` }}
            >
              {item.text}
            </a>
          ))
        )}
      </nav>
      <PanelResizer
        side="toc"
        label="Resize table of contents"
        onPointerDown={onResizePointerDown}
        onKeyDown={onResizeKeyDown}
      />
    </aside>
  );
}

function PanelHeader({
  title,
  onClose,
  actions
}: {
  title: string;
  onClose: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      <div className="panel-header__actions">
        {actions}
        <button
          className="icon-button mobile-only"
          type="button"
          onClick={onClose}
          aria-label={`Close ${title}`}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function PreferencesForm({
  preferences,
  setPreferences,
  onReset
}: {
  preferences: Preferences;
  setPreferences: React.Dispatch<React.SetStateAction<Preferences>>;
  onReset: () => void;
}) {
  return (
    <div className="preferences-form">
      <label>
        Color theme
        <select
          value={preferences.theme}
          onChange={(event) =>
            setPreferences((current) => {
              const theme = event.target.value as ThemeMode;
              return {
                ...current,
                theme,
                lastThemeOverride: theme === 'system' ? current.lastThemeOverride : theme
              };
            })
          }
        >
          <option value="system">Follow system</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="sepia">Sepia</option>
          <option value="mint">Mint</option>
          <option value="sky">Sky</option>
          <option value="plum">Plum</option>
        </select>
      </label>
      <label>
        Font size
        <input
          type="range"
          min="15"
          max="24"
          value={preferences.fontSize}
          onChange={(event) =>
            setPreferences((current) => ({ ...current, fontSize: Number(event.target.value) }))
          }
        />
        <span>{preferences.fontSize}px</span>
      </label>
      <label>
        Line height
        <input
          type="range"
          min="1.35"
          max="1.9"
          step="0.05"
          value={preferences.lineHeight}
          onChange={(event) =>
            setPreferences((current) => ({ ...current, lineHeight: Number(event.target.value) }))
          }
        />
        <span>{preferences.lineHeight.toFixed(2)}</span>
      </label>
      <label>
        Content width
        <input
          type="range"
          min={MIN_CONTENT_WIDTH}
          max={MAX_CONTENT_WIDTH}
          step="20"
          value={preferences.contentWidth}
          onChange={(event) =>
            setPreferences((current) => ({ ...current, contentWidth: Number(event.target.value) }))
          }
        />
        <span>{preferences.contentWidth}px</span>
      </label>
      <label>
        Reading font
        <select
          value={preferences.fontChoice}
          onChange={(event) =>
            setPreferences((current) => ({
              ...current,
              fontChoice: event.target.value as Preferences['fontChoice']
            }))
          }
        >
          <option value="system">System UI</option>
          <option value="sans">Sans-serif</option>
          <option value="serif">Serif</option>
          <option value="slab">Slab serif</option>
          <option value="mono">Monospace</option>
          <option value="rounded">Rounded</option>
        </select>
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={preferences.codeWrap}
          onChange={(event) =>
            setPreferences((current) => ({ ...current, codeWrap: event.target.checked }))
          }
        />
        Wrap code and editor lines
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={preferences.filePanelVisible}
          onChange={(event) =>
            setPreferences((current) => ({ ...current, filePanelVisible: event.target.checked }))
          }
        />
        Show file sidebar
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={preferences.tocVisible}
          onChange={(event) =>
            setPreferences((current) => ({ ...current, tocVisible: event.target.checked }))
          }
        />
        Show table of contents
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={preferences.reducedMotion}
          onChange={(event) =>
            setPreferences((current) => ({ ...current, reducedMotion: event.target.checked }))
          }
        />
        Reduce motion
      </label>
      <button className="control-button" type="button" onClick={onReset}>
        Reset reading preferences
      </button>
    </div>
  );
}

function themeLabel(theme: ThemeMode, dark: boolean): string {
  if (theme === 'system') {
    return `Theme follows system (${dark ? 'dark' : 'light'}). Click to override.`;
  }
  return `${THEME_LABELS[theme]} theme override. Click to return to system.`;
}

function resolveTheme(theme: ThemeMode, systemDark: boolean): Exclude<ThemeMode, 'system'> {
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

function isDarkTheme(theme: Exclude<ThemeMode, 'system'>): boolean {
  return theme === 'dark';
}

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY) ?? localStorage.getItem(LEGACY_PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return normalizePreferences({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
  } catch {
    return DEFAULT_PREFS;
  }
}

function normalizePreferences(preferences: Preferences): Preferences {
  const theme = THEME_MODES.includes(preferences.theme) ? preferences.theme : 'system';
  const lastThemeOverride = THEME_OVERRIDES.includes(preferences.lastThemeOverride)
    ? preferences.lastThemeOverride
    : theme === 'system'
      ? DEFAULT_PREFS.lastThemeOverride
      : theme;
  const fontChoice = FONT_CHOICES.includes(preferences.fontChoice)
    ? preferences.fontChoice
    : 'sans';

  return {
    ...preferences,
    theme,
    lastThemeOverride,
    fontChoice,
    contentWidth: clamp(preferences.contentWidth, MIN_CONTENT_WIDTH, MAX_CONTENT_WIDTH),
    filePanelWidth: clamp(preferences.filePanelWidth, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH),
    tocPanelWidth: clamp(preferences.tocPanelWidth, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH)
  };
}

function documentFromFolderDocument(entry: FolderDocument): DocumentState {
  return documentFromContent(entry.content, entry.name, entry.path, {
    id: entry.id,
    path: entry.path,
    fileHandle: entry.fileHandle,
    canDirectSave: Boolean(entry.fileHandle),
    lastModified: entry.lastModified
  });
}

function paintRenderedSearchHighlights(ranges: Range[], activeIndex: number): void {
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

function clearRenderedSearchHighlights(): void {
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

function selectEditorSearchMatch(
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

function findRenderedSearchRanges(
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

function scrollHeadingIntoView(
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

function scrollRangeIntoStage(
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

function looksLikeMarkdown(text: string): boolean {
  return /(^#{1,6}\s)|(\n[-*]\s)|(```)|(\[[^\]]+\]\([^)]+\))|(\n> )|(\|.+\|)/m.test(text);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function getScrollRatio(element: HTMLElement): number {
  const max = element.scrollHeight - element.clientHeight;
  if (max <= 0) return 0;
  return element.scrollTop / max;
}

function restoreScrollRatio(element: HTMLElement, ratio: number): void {
  const max = Math.max(0, element.scrollHeight - element.clientHeight);
  element.scrollTop = Math.max(0, Math.min(1, ratio)) * max;
}

function getReaderScrollElement(stage: HTMLElement | null): HTMLElement | null {
  if (stage && stage.scrollHeight > stage.clientHeight) return stage;
  return document.scrollingElement as HTMLElement | null;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function isCompactLayout(): boolean {
  return window.matchMedia('(max-width: 980px)').matches;
}

function getViewportRightOffset(): number {
  const visualViewport = window.visualViewport;
  if (!visualViewport) return 0;
  return Math.max(0, window.innerWidth - visualViewport.width - visualViewport.offsetLeft);
}
