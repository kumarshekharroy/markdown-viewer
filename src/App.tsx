import { usePanelResize } from './hooks/usePanelResize';
import { useWorkspacePersistence, loadFolderExpansion } from './hooks/useWorkspacePersistence';
import { useReaderScroll } from './hooks/useReaderScroll';
import { loadScrollPosition } from './lib/scrollPositions';
import { buildHeadingScrollAnchors, mapAnchoredScroll } from './lib/scrollSync';
import { findSourceMatches, replaceAllSourceMatches, replaceSourceMatch } from './lib/search';
import { EdgePanelToggle } from './components/SidebarControls';
import { normalizeDocumentTitle } from './lib/documentTitle';
import { DEFAULT_PREFS, loadPreferences, resetDockPreferences, clamp } from './lib/preferences';
import { resolveTheme, isDarkTheme } from './data/themes';
import { usePreferenceStorage } from './hooks/usePreferenceStorage';
import { FileTree } from './components/FileTree';
import { ReadingControls } from './components/ReadingControls';
import { MoreMenu } from './components/MoreMenu';
import { TocPanel } from './components/TocPanel';
import { PreferencesForm } from './components/PreferencesForm';
import { PanelHeader, PanelResizer } from './components/Panel';
import { buildFileTree, collectFolderPaths, getParentFolderPaths } from './lib/fileTree';
import {
  paintRenderedSearchHighlights,
  clearRenderedSearchHighlights,
  findRenderedSearchRanges,
  selectEditorSearchMatch,
  scrollEditorHeadingIntoView,
  scrollHeadingIntoView,
  scrollRangeIntoStage,
  getScrollRatio,
  restoreScrollRatio,
  getReaderScrollElement
} from './lib/readerNavigation';
import type { EditorView } from '@codemirror/view';
import {
  Check,
  Columns2,
  Edit3,
  FilePlus2,
  FolderOpen,
  Moon,
  Save,
  Sun,
  TriangleAlert,
  Upload,
  X
} from 'lucide-react';
import {
  lazy,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
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
  isLegacyUnsavedFolderEntry,
  pickSaveAs,
  readMarkdownFile,
  saveToFileHandle,
  verifyPermission
} from './lib/files';
import { parseFrontMatter } from './lib/frontmatter';
import { subscribeToFileLaunches } from './lib/fileLaunch';
import {
  convertGitHubBlobUrl,
  displayNameFromPath,
  extractHeadings,
  resolveRelativePath
} from './lib/markdown';
import {
  clearApplicationData,
  deleteDraft,
  getRecent,
  getDrafts,
  getWorkspaceSession,
  removeRecent,
  saveDraft,
  upsertRecent
} from './lib/storage';
import type {
  DocumentState,
  DocumentTab,
  DraftRecord,
  FolderDocument,
  FolderState,
  Preferences,
  RecentDocument,
  SearchOptions
} from './types';

const MarkdownEditor = lazy(() =>
  import('./components/MarkdownEditor').then((module) => ({ default: module.MarkdownEditor }))
);

const APP_NAME = 'Markdown Viewer';

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

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const resolvedTheme = resolveTheme(preferences.theme, systemDark);
  const dark = isDarkTheme(resolvedTheme);
  const [isEditing, setIsEditing] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [splitRatio, setSplitRatio] = useState(loadSplitRatio);
  const [tabs, setTabs] = useState<DocumentTab[]>(() => [
    {
      tabId: 'example-tab',
      document: documentFromContent(
        exampleDocument,
        'Markdown Viewer Example',
        'Example document',
        {
          id: 'example-document',
          path: 'example.md'
        }
      ),
      dirty: false
    }
  ]);
  const [activeTabId, setActiveTabId] = useState('example-tab');
  const activeTab = tabs.find((tab) => tab.tabId === activeTabId) ?? tabs[0];
  const documentState = activeTab.document;
  const dirty = activeTab.dirty;
  const anyDirty = tabs.some((tab) => tab.dirty);
  const [notice, setNotice] = useState<Notice>({
    message: 'Example document loaded. Open, paste, or drop a Markdown file to begin.',
    tone: 'info'
  });
  const [folder, setFolder] = useState<FolderState | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [recent, setRecent] = useState<RecentDocument[]>([]);
  const [recoverableDrafts, setRecoverableDrafts] = useState<DraftRecord[]>([]);
  const recoverableDraft = recoverableDrafts[0];
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [replaceOpen, setReplaceOpen] = useState(false);
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
  const { startPanelResize, handlePanelResizeKeydown } = usePanelResize(
    preferences,
    setPreferences,
    compactLayout
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const previewPaneRef = useRef<HTMLElement>(null);
  const splitSyncRef = useRef(false);
  const pendingScrollRatioRef = useRef<number | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const updateActiveTab = useCallback(
    (update: (tab: DocumentTab) => DocumentTab) => {
      setTabs((current) => current.map((tab) => (tab.tabId === activeTabId ? update(tab) : tab)));
    },
    [activeTabId]
  );

  const readerContainer = useCallback(
    () => (splitView && isEditing ? previewPaneRef.current : scrollContainerRef.current),
    [splitView, isEditing]
  );

  useEffect(() => {
    try {
      localStorage.setItem('markdown-viewer-split-ratio', String(splitRatio));
    } catch {
      // The split view still works when browser storage is unavailable.
    }
  }, [splitRatio]);

  const deferredContent = useDeferredValue(documentState.content);
  const contentToParse = isEditing ? deferredContent : documentState.content;
  const parsed = useMemo(() => parseFrontMatter(contentToParse), [contentToParse]);
  const toc = useMemo(
    () => extractHeadings(parsed.body, parsed.raw?.length ?? 0),
    [parsed.body, parsed.raw]
  );

  useEffect(() => {
    if (!splitView || !isEditing || !editorView || !previewPaneRef.current) return;
    const editor = editorView.scrollDOM;
    const preview = previewPaneRef.current;
    let anchors = buildHeadingScrollAnchors(
      editorView,
      preview,
      articleRef.current,
      toc,
      compactLayout
    );
    let frame = 0;
    const refreshAnchors = () => {
      anchors = buildHeadingScrollAnchors(
        editorView,
        preview,
        articleRef.current,
        toc,
        compactLayout
      );
    };
    const sync = (source: HTMLElement, target: HTMLElement, direction: 'editor' | 'preview') => {
      if (splitSyncRef.current) return;
      const next = mapAnchoredScroll(
        source.scrollTop,
        anchors,
        direction,
        Math.max(0, source.scrollHeight - source.clientHeight),
        Math.max(0, target.scrollHeight - target.clientHeight)
      );
      if (Math.abs(target.scrollTop - next) < 1) return;
      splitSyncRef.current = true;
      target.scrollTop = next;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        splitSyncRef.current = false;
      });
    };
    const fromEditor = () => sync(editor, preview, 'editor');
    const fromPreview = () => sync(preview, editor, 'preview');
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refreshAnchors);
    if (articleRef.current) observer?.observe(articleRef.current);
    observer?.observe(preview);
    window.addEventListener('resize', refreshAnchors);
    editor.addEventListener('scroll', fromEditor, { passive: true });
    preview.addEventListener('scroll', fromPreview, { passive: true });
    fromEditor();
    return () => {
      cancelAnimationFrame(frame);
      splitSyncRef.current = false;
      observer?.disconnect();
      window.removeEventListener('resize', refreshAnchors);
      editor.removeEventListener('scroll', fromEditor);
      preview.removeEventListener('scroll', fromPreview);
    };
  }, [editorView, isEditing, splitView, activeTabId, toc, parsed.body, compactLayout]);

  const fileTree = useMemo(
    () => (folder ? buildFileTree(folder.documents, folder.name) : []),
    [folder]
  );
  const documentsByPath = useMemo(
    () => new Map(folder?.documents.map((entry) => [entry.path, entry])),
    [folder]
  );
  const activeFolderDocument =
    folder?.documents.some((entry) => entry.id === documentState.id) ?? false;
  const sourceMatches = useMemo(
    () => findSourceMatches(documentState.content, searchQuery, searchOptions),
    [documentState.content, searchQuery, searchOptions]
  );
  const matchCount = sourceMatches.length;

  const announce = useCallback((message: string, tone: NoticeTone = 'info') => {
    setNotice({ message, tone });
  }, []);

  const refreshRecent = useCallback(async () => {
    setRecent(await getRecent());
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getWorkspaceSession(), getRecent()])
      .then(([session, recentDocuments]) => {
        if (!active) return;
        setRecent(recentDocuments);
        if (session?.document) {
          const legacyEntries = session.folder?.documents.filter(isLegacyUnsavedFolderEntry) ?? [];
          const restoredTabs = session.tabs?.length
            ? session.tabs
            : [{ tabId: session.document.id, document: session.document, dirty: session.dirty }];
          setTabs(
            restoredTabs.map((tab) => ({
              ...tab,
              document: legacyEntries.some((entry) => entry.id === tab.document.id)
                ? {
                    ...tab.document,
                    path: undefined,
                    fileHandle: undefined,
                    canDirectSave: false,
                    sourceLabel: filenameForMarkdown(tab.document.title)
                  }
                : tab.document
            }))
          );
          setActiveTabId(
            restoredTabs.some((tab) => tab.tabId === session.activeTabId)
              ? session.activeTabId!
              : restoredTabs[0].tabId
          );
          setFolder(
            session.folder
              ? {
                  ...session.folder,
                  documents: session.folder.documents.filter(
                    (entry) => !isLegacyUnsavedFolderEntry(entry)
                  ),
                  assets: new Map<string, string>()
                }
              : null
          );
          setExpandedFolders(
            new Set(loadFolderExpansion(session.folder?.name, session.expandedFolders))
          );
          setNotice({
            message: `Restored ${session.document.title} from your last session.`,
            tone: 'success'
          });
        }
        setWorkspaceReady(true);
      })
      .catch(() => {
        if (!active) return;
        setWorkspaceReady(true);
        announce('The previous workspace could not be restored.', 'warning');
      });
    return () => {
      active = false;
    };
  }, [announce]);

  useEffect(() => {
    if (!workspaceReady) return;
    getDrafts().then((drafts) => {
      const openIds = new Set(tabsRef.current.map((tab) => tab.document.id));
      setRecoverableDrafts(
        drafts.filter((draft) => draft.dirty && draft.content.trim() && !openIds.has(draft.id))
      );
    });
  }, [workspaceReady]);

  useWorkspacePersistence(tabs, activeTabId, folder, expandedFolders, workspaceReady, () =>
    announce('The current workspace could not be remembered.', 'warning')
  );
  useReaderScroll(documentState.id, isEditing, workspaceReady, scrollContainerRef);

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
    const activeFile = document.querySelector<HTMLElement>(
      '#files-panel .file-tree button[aria-current="page"]'
    );
    activeFile?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [documentState.path, fileTree, mobileFilesOpen, preferences.filePanelVisible]);

  useEffect(() => {
    directoryInputRef.current?.setAttribute('webkitdirectory', '');
    directoryInputRef.current?.setAttribute('directory', '');
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.appearance = dark ? 'dark' : 'light';
    document.documentElement.dataset.motion = preferences.reducedMotion ? 'reduced' : 'full';
    document.documentElement.dataset.contrast = preferences.highContrast ? 'high' : 'normal';
  }, [dark, preferences.highContrast, preferences.reducedMotion, resolvedTheme]);

  usePreferenceStorage(preferences);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!anyDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [anyDirty]);

  useEffect(() => {
    const dirtyTabs = tabs.filter((tab) => tab.dirty);
    if (dirtyTabs.length === 0) return undefined;
    const timer = window.setTimeout(() => {
      Promise.all(
        dirtyTabs.map(({ document: doc }) =>
          saveDraft({
            id: doc.id,
            title: doc.title,
            content: doc.content,
            sourceLabel: doc.sourceLabel,
            sourceUrl: doc.sourceUrl,
            path: doc.path,
            updatedAt: Date.now(),
            dirty: true
          })
        )
      ).catch(() =>
        announce('Draft recovery could not be updated in this browser session.', 'warning')
      );
    }, 700);
    return () => window.clearTimeout(timer);
  }, [announce, tabs]);

  useEffect(() => {
    if ((isEditing && !splitView) || !searchOpen) return;
    const timer = window.setTimeout(() => {
      setRenderedText(articleRef.current?.textContent ?? '');
    }, 80);
    return () => window.clearTimeout(timer);
  }, [parsed.body, isEditing, splitView, searchOpen]);

  useEffect(() => {
    if ((isEditing && !splitView) || !searchOpen || !searchQuery.trim()) {
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
    splitView,
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
      {
        root: splitView && isEditing ? previewPaneRef.current : scrollContainerRef.current,
        rootMargin: '-20% 0px -65% 0px'
      }
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [toc, parsed.body, isEditing, splitView]);

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
      if ((event.metaKey || event.ctrlKey) && ['f', 'h'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        if (event.key.toLowerCase() === 'h') setReplaceOpen(true);
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

  const applyDocument = useCallback((next: DocumentState, markDirty: boolean) => {
    const existing = tabsRef.current.find((tab) => tab.document.id === next.id);
    if (existing) {
      setActiveTabId(existing.tabId);
    } else {
      const tabId = crypto.randomUUID();
      setTabs((current) => [...current, { tabId, document: next, dirty: markDirty }]);
      setActiveTabId(tabId);
      if (!markDirty) deleteDraft(next.id).catch(() => undefined);
    }
    setSearchCursor(0);
    setActiveHeading('');
    if (window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  const closeTab = (tabId: string) => {
    const tab = tabs.find((entry) => entry.tabId === tabId);
    if (!tab) return;
    if (tab.dirty && !window.confirm(`Discard unsaved changes to ${tab.document.title}?`)) return;
    if (tab.dirty) deleteDraft(tab.document.id).catch(() => undefined);
    const remaining = tabs.filter((entry) => entry.tabId !== tabId);
    if (remaining.length === 0) {
      const replacement = documentFromContent(
        exampleDocument,
        'Markdown Viewer Example',
        'Example document',
        {
          id: 'example-document',
          path: 'example.md'
        }
      );
      const fallback = { tabId: crypto.randomUUID(), document: replacement, dirty: false };
      setTabs([fallback]);
      setActiveTabId(fallback.tabId);
    } else {
      setTabs(remaining);
      if (activeTabId === tabId)
        setActiveTabId(remaining[Math.max(0, tabs.indexOf(tab) - 1)].tabId);
    }
  };

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

  useEffect(() => {
    if (!workspaceReady) return undefined;

    return subscribeToFileLaunches(async (handles) => {
      const handle = handles[0];
      if (!handle) return;

      try {
        const allowed = await verifyPermission(handle, 'read');
        if (!allowed) {
          throw new Error('Permission to read the opened file was not granted.');
        }

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
          handles.length === 1
            ? 'File opened by the installed app. Direct save is available.'
            : `Opened ${file.name}. Open additional selected files one at a time.`,
          'success'
        );
      } catch (error) {
        announce(errorMessage(error, 'The file passed to the app could not be opened.'), 'error');
      }
    });
  }, [announce, applyDocument, rememberDocument, workspaceReady]);

  const createDocument = async () => {
    const filename = nextUntitledFilename(folder, tabs);
    applyDocument(
      documentFromContent('', filename, filename, {
        id: `new-${crypto.randomUUID()}`
      }),
      true
    );
    setIsEditing(true);
    setMobileFilesOpen(false);
    setMobileTocOpen(false);
    announce(
      'New Markdown file created outside the open folder. Save it, then reopen the folder to include it in the file tree.',
      'success'
    );
  };

  const openFile = async () => {
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
    try {
      await applyFolder(await folderFromInputFiles(files));
    } catch (error) {
      announce(errorMessage(error, 'The folder could not be opened.'), 'error');
    } finally {
      if (directoryInputRef.current) directoryInputRef.current.value = '';
    }
  };

  const applyFolder = async (nextFolder: FolderState) => {
    const folderKey = crypto.randomUUID();
    const identifiedFolder = {
      ...nextFolder,
      documents: nextFolder.documents.map((entry) => ({
        ...entry,
        id: `${folderKey}:${entry.path}`
      }))
    };
    setFolder((previous) => {
      previous?.assets.forEach((url) => URL.revokeObjectURL(url));
      return identifiedFolder;
    });

    if (identifiedFolder.documents.length === 0) {
      setExpandedFolders(new Set());
      announce('No supported Markdown files were found in that folder.', 'warning');
      return;
    }

    setExpandedFolders(
      new Set(collectFolderPaths(buildFileTree(identifiedFolder.documents, identifiedFolder.name)))
    );
    const first = identifiedFolder.documents[0];
    const doc = documentFromFolderDocument(first);
    applyDocument(doc, false);
    await rememberDocument(doc);
    setPreferences((current) => ({ ...current, filePanelVisible: true }));
    if (compactLayout) {
      setMobileFilesOpen(true);
    }
    announce(
      `${identifiedFolder.documents.length} Markdown file${identifiedFolder.documents.length === 1 ? '' : 's'} found in ${identifiedFolder.name}.`,
      'success'
    );
  };

  const scrollToHeading = useCallback(
    (id: string) => {
      const cleanId = id.replace(/^#/, '');
      if (isEditing) {
        const heading = toc.find((item) => item.id === cleanId);
        if (!editorView || !heading) return;
        scrollEditorHeadingIntoView(editorView, heading.from);
        setActiveHeading(cleanId);
        window.history.replaceState(null, '', `#${cleanId}`);
        if (compactLayout) setMobileTocOpen(false);
        return;
      }
      if (scrollHeadingIntoView(cleanId, preferences.reducedMotion, readerContainer())) {
        setActiveHeading(cleanId);
        if (compactLayout) setMobileTocOpen(false);
      }
    },
    [compactLayout, editorView, isEditing, readerContainer, preferences.reducedMotion, toc]
  );

  useEffect(() => {
    const handleHashChange = () => {
      if (!window.location.hash || isEditing) return;
      window.setTimeout(() => scrollToHeading(window.location.hash), 0);
    };
    window.addEventListener('hashchange', handleHashChange);
    if (loadScrollPosition(documentState.id) === 0) handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [documentState.id, isEditing, parsed.body, scrollToHeading]);

  const openFolderDocument = useCallback(
    async (entry: FolderDocument, hash?: string) => {
      if (entry.id === documentState.id) {
        if (hash) scrollToHeading(hash);
        if (compactLayout) setMobileFilesOpen(false);
        return;
      }
      if (folder) {
        const parentPaths = getParentFolderPaths(entry.path, folder.name);
        setExpandedFolders((current) => new Set([...current, ...parentPaths]));
      }
      const doc = documentFromFolderDocument(entry);
      applyDocument(doc, false);
      await rememberDocument(doc);
      if (compactLayout) setMobileFilesOpen(false);
      if (hash) {
        window.setTimeout(() => scrollToHeading(hash), 120);
      }
    },
    [documentState.id, folder, applyDocument, rememberDocument, scrollToHeading, compactLayout]
  );

  const resolveAsset = useCallback(
    (src: string) => {
      if (
        !folder ||
        !activeFolderDocument ||
        !documentState.path ||
        /^(https?:|data:|blob:)/i.test(src)
      )
        return undefined;
      return folder.assets.get(resolveRelativePath(documentState.path, src));
    },
    [documentState.path, folder, activeFolderDocument]
  );

  const navigateLocal = useCallback(
    (href: string) => {
      if (!folder || !activeFolderDocument || !documentState.path) return;
      const hash = href.includes('#') ? `#${href.split('#').slice(1).join('#')}` : undefined;
      const targetPath = resolveRelativePath(documentState.path, href);
      const entry = documentsByPath.get(targetPath);
      if (!entry) {
        announce('That linked Markdown file was not found in the opened folder.', 'warning');
        return;
      }
      openFolderDocument(entry, hash);
    },
    [
      folder,
      activeFolderDocument,
      documentState.path,
      documentsByPath,
      announce,
      openFolderDocument
    ]
  );

  const saveDocument = async () => {
    try {
      if (documentState.fileHandle && documentState.canDirectSave) {
        await saveToFileHandle(documentState.fileHandle, documentState.content);
        markSaved(documentState);
        announce('Changes saved to the original file.', 'success');
        return;
      }
      downloadText(filenameForMarkdown(documentState.title), documentState.content);
      markSaved(documentState);
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
      markSaved(documentState);
      announce(direct ? 'Saved as a new file.' : 'Updated Markdown downloaded.', 'success');
    } catch (error) {
      if (isAbort(error)) return;
      announce(errorMessage(error, 'Save As failed.'), 'error');
    }
  };

  const markSaved = (saved: DocumentState) => {
    setTabs((current) =>
      current.map((tab) =>
        tab.document.id === saved.id
          ? { ...tab, dirty: tab.document.content !== saved.content }
          : tab
      )
    );
    deleteDraft(saved.id).catch(() => undefined);
    if (folder && saved.path && folder.documents.some((entry) => entry.id === saved.id)) {
      setFolder({
        ...folder,
        documents: folder.documents.map((entry) =>
          entry.id === saved.id ? { ...entry, content: saved.content } : entry
        )
      });
    }
    rememberDocument(saved).catch(() => undefined);
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
    const openTab = tabs.find((tab) => tab.document.id === item.id);
    if (openTab) {
      setActiveTabId(openTab.tabId);
      return;
    }
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
    setRecoverableDrafts([]);
    setPreferences(DEFAULT_PREFS);
    setSplitRatio(50);
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
    setRecoverableDrafts((current) => current.filter((draft) => draft.id !== recoverableDraft.id));
    announce('Unsaved draft restored from this browser.', 'success');
  };

  const discardDraft = async () => {
    if (!recoverableDraft) return;
    await deleteDraft(recoverableDraft.id);
    setRecoverableDrafts((current) => current.filter((draft) => draft.id !== recoverableDraft.id));
    announce('Recovered draft discarded.', 'info');
  };

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    await handleFileInput(event.dataTransfer.files);
  };

  const updateContent = useCallback(
    (content: string) => {
      updateActiveTab((tab) => ({ ...tab, document: { ...tab.document, content }, dirty: true }));
    },
    [updateActiveTab]
  );

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
      if (!range) {
        const match = sourceMatches[nextCursor - 1];
        const container = readerContainer();
        if (match && container)
          restoreScrollRatio(container, match.from / Math.max(1, documentState.content.length));
        return;
      }
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      scrollRangeIntoStage(range, readerContainer(), preferences.reducedMotion);
    }, 0);
  };

  const replaceCurrent = () => {
    const index = searchCursor > 0 ? searchCursor - 1 : 0;
    const match = sourceMatches[index];
    if (!match) return;
    updateContent(replaceSourceMatch(documentState.content, match, replaceText));
    setSearchCursor(index + 1 <= matchCount - 1 ? index + 1 : 0);
  };

  const replaceAll = () => {
    if (!matchCount) return;
    updateContent(
      replaceAllSourceMatches(documentState.content, searchQuery, searchOptions, replaceText)
    );
    setSearchCursor(0);
    announce(
      `Replaced ${matchCount} match${matchCount === 1 ? '' : 'es'} in ${documentState.title}.`,
      'success'
    );
  };

  const resetDock = () => {
    setPreferences(resetDockPreferences);
    setMobileFilesOpen(false);
    setMobileTocOpen(false);
    announce(
      'Dock reset. Text size, zoom, weight, contrast and sidebar visibility restored.',
      'success'
    );
  };

  const toggleFolderExpanded = useCallback((path: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const openSearch = () => {
    setSearchOpen(true);
    setPreferences((current) => ({ ...current, tocVisible: true }));
    if (compactLayout) {
      setMobileTocOpen(true);
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setReplaceOpen(false);
    setSearchCursor(0);
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

  const startSplitResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const stage = scrollContainerRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const update = (pointer: PointerEvent) => {
      const percentage = compactLayout
        ? ((pointer.clientY - rect.top) / rect.height) * 100
        : ((pointer.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(clamp(percentage, 25, 75));
    };
    const stop = () => {
      window.removeEventListener('pointermove', update);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', update);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };

  const resizeSplitByKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = compactLayout
      ? event.key === 'ArrowDown'
        ? 5
        : event.key === 'ArrowUp'
          ? -5
          : 0
      : event.key === 'ArrowRight'
        ? 5
        : event.key === 'ArrowLeft'
          ? -5
          : 0;
    if (!delta) return;
    event.preventDefault();
    setSplitRatio((current) => clamp(current + delta, 25, 75));
  };

  const toggleFilePanel = () => {
    if (compactLayout) {
      setMobileFilesOpen((current) => !current);
      setMobileTocOpen(false);
      return;
    }
    setPreferences((current) => ({ ...current, filePanelVisible: !current.filePanelVisible }));
  };

  const toggleTocPanel = () => {
    if (compactLayout) {
      setMobileTocOpen((current) => !current);
      setMobileFilesOpen(false);
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
    '--viewport-right-offset': `${viewportRightOffset}px`,
    '--reader-controls-left-space': `${!compactLayout && preferences.filePanelVisible ? preferences.filePanelWidth : 0}px`,
    '--reader-controls-right-space': `${!compactLayout && preferences.tocVisible ? preferences.tocPanelWidth : 0}px`,
    '--split-editor-width': `${splitRatio}%`
  } as React.CSSProperties;

  useLayoutEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [renderTocPanel, searchOpen]);

  return (
    <div
      className={`app ${isEditing ? 'app--editing' : ''}`}
      style={appStyle}
      aria-busy={!workspaceReady}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <header className={`app-header ${isEditing ? 'is-editing' : ''}`}>
        <div className="header-title-area">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="brand-icon" />
          <div className="title-block">
            <span className="app-name">{APP_NAME}</span>
            <strong title={documentState.sourceLabel}>
              {normalizeDocumentTitle(documentState.title)}
            </strong>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="control-button control-button--primary header-open-button"
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
          {isEditing ? (
            <IconToggle
              label={splitView ? 'Hide live preview' : 'Show live preview beside editor'}
              pressed={splitView}
              onClick={() => setSplitView((current) => !current)}
            >
              <Columns2 size={18} aria-hidden="true" />
            </IconToggle>
          ) : null}
          <IconToggle
            label={`Switch to ${dark ? 'light' : 'dark'} mode`}
            onClick={() =>
              setPreferences((current) => ({
                ...current,
                theme: dark ? 'paper' : 'slate',
                lastThemeOverride: dark ? 'paper' : 'slate'
              }))
            }
          >
            {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </IconToggle>
          <MoreMenu
            canDirectSave={documentState.canDirectSave}
            dirty={dirty}
            onNew={createDocument}
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

      <nav className="document-tabs" aria-label="Open documents">
        <div className="document-tabs__list" role="tablist" aria-label="Open documents">
          {tabs.map((tab) => (
            <div className="document-tab" key={tab.tabId}>
              <button
                type="button"
                role="tab"
                aria-selected={tab.tabId === activeTabId}
                aria-controls="document-stage"
                className="document-tab__select"
                title={tab.document.sourceLabel}
                onClick={() => {
                  setActiveTabId(tab.tabId);
                  setSearchCursor(0);
                  setActiveHeading('');
                  setEditorView(null);
                }}
              >
                <span className="document-tab__title">
                  {normalizeDocumentTitle(tab.document.title)}
                </span>
                {tab.dirty ? (
                  <span className="document-tab__dirty" aria-label="Unsaved changes">
                    ●
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className="document-tab__close"
                aria-label={`Close ${tab.document.title}`}
                onClick={() => closeTab(tab.tabId)}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="document-tabs__new"
          aria-label="New Markdown tab"
          onClick={createDocument}
        >
          <FilePlus2 size={17} aria-hidden="true" />
        </button>
      </nav>

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
              {recoverableDrafts.length > 1
                ? ` · ${recoverableDrafts.length - 1} more draft${recoverableDrafts.length === 2 ? '' : 's'}`
                : ''}
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
            id="files-panel"
            aria-label="Files and recent documents"
          >
            <PanelHeader
              title="Files"
              onClose={() => setMobileFilesOpen(false)}
              actions={
                <>
                  <button
                    className="panel-action tooltip-button"
                    type="button"
                    onClick={createDocument}
                    aria-label="New Markdown file"
                    data-tooltip="New Markdown file"
                  >
                    <FilePlus2 size={17} aria-hidden="true" />
                    <span>New</span>
                  </button>
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
                </>
              }
            />
            <div className="file-panel__scroll">
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
                    <FileTree
                      nodes={fileTree}
                      expandedFolders={expandedFolders}
                      activePath={activeFolderDocument ? documentState.path : undefined}
                      dirty={dirty}
                      onToggleFolder={toggleFolderExpanded}
                      onOpenDocument={openFolderDocument}
                    />
                  </nav>
                </div>
              ) : null}
              <div className="panel-section recent-section">
                <h2>Recent</h2>
                {recent.length === 0 ? (
                  <p className="browser-note">
                    Recent document metadata appears here. File contents are not stored in this
                    list.
                  </p>
                ) : (
                  <ul className="recent-list">
                    {visibleRecent.map((item) => (
                      <li
                        key={item.id}
                        className={[
                          item.id === documentState.id ? 'is-active' : '',
                          tabs.some((tab) => tab.dirty && tab.document.id === item.id)
                            ? 'is-dirty'
                            : ''
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
          id="document-stage"
          ref={scrollContainerRef}
          className={`document-stage ${isEditing ? 'document-stage--edit' : 'document-stage--read'} ${isEditing && splitView ? 'document-stage--split' : ''}`}
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
          {isEditing && splitView ? (
            <>
              <section className="split-editor-pane" aria-label="Markdown source">
                <Suspense fallback={<EditorFallback />}>
                  <MarkdownEditor
                    key={activeTabId}
                    value={documentState.content}
                    onChange={updateContent}
                    dark={dark}
                    lineWrap={preferences.codeWrap}
                    onEditorReady={setEditorView}
                    onOpenSearch={openSearch}
                    searchOpen={searchOpen}
                    searchQuery={searchQuery}
                    searchOptions={searchOptions}
                  />
                </Suspense>
              </section>
              <div
                className="split-divider"
                role="separator"
                tabIndex={0}
                aria-label="Resize editor and preview"
                aria-orientation={compactLayout ? 'horizontal' : 'vertical'}
                aria-valuemin={25}
                aria-valuemax={75}
                aria-valuenow={splitRatio}
                onPointerDown={startSplitResize}
                onKeyDown={resizeSplitByKeyboard}
              />
              <section
                ref={previewPaneRef}
                className="split-preview-pane"
                aria-label="Live preview"
              >
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
              </section>
            </>
          ) : null}
          {isEditing && !splitView ? (
            <Suspense fallback={<EditorFallback />}>
              <MarkdownEditor
                key={activeTabId}
                value={documentState.content}
                onChange={updateContent}
                dark={dark}
                lineWrap={preferences.codeWrap}
                onEditorReady={setEditorView}
                onOpenSearch={openSearch}
                searchOpen={searchOpen}
                searchQuery={searchQuery}
                searchOptions={searchOptions}
              />
            </Suspense>
          ) : null}
        </main>

        <ReadingControls
          preferences={preferences}
          setPreferences={setPreferences}
          filesVisible={renderFilePanel}
          tocVisible={renderTocPanel}
          isEditing={isEditing}
          dirty={dirty}
          onToggleFiles={toggleFilePanel}
          onToggleToc={toggleTocPanel}
          onReset={resetDock}
        />

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
            replaceOpen={replaceOpen}
            replaceText={replaceText}
            onOpenSearch={openSearch}
            onCloseSearch={closeSearch}
            onSearchQueryChange={(value) => {
              setSearchQuery(value);
              setSearchCursor(0);
            }}
            onSearchOptionsChange={(update) => {
              setSearchOptions(update);
              setSearchCursor(0);
            }}
            onMoveSearch={moveSearch}
            onToggleReplace={() => setReplaceOpen((current) => !current)}
            onReplaceTextChange={setReplaceText}
            onReplaceCurrent={replaceCurrent}
            onReplaceAll={replaceAll}
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
        panelWidth={preferences.filePanelWidth}
        onClick={toggleFilePanel}
      />
      <EdgePanelToggle
        side="right"
        visible={renderTocPanel}
        panelWidth={preferences.tocPanelWidth}
        rightOffset={viewportRightOffset}
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
        title="Settings"
        onClose={() => setSettingsOpen(false)}
        className="settings-dialog"
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
            store metadata, and the current workspace stores open tabs, their unsaved Markdown, and
            the folder tree so they can be restored after a reload. Where the browser supports it,
            file handles still require permission before reuse.
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

function EditorFallback() {
  return (
    <section className="editor-shell editor-shell--loading" aria-label="Markdown editor loading">
      Loading editor...
    </section>
  );
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

function nextUntitledFilename(folder: FolderState | null, tabs: DocumentTab[]): string {
  const usedNames = new Set(
    [...(folder?.documents ?? []), ...tabs.map((tab) => ({ path: tab.document.title }))].map(
      (document) => document.path.split('/').filter(Boolean).at(-1)?.toLowerCase() ?? ''
    )
  );
  let number = 1;
  let candidate = 'Untitled.md';
  while (usedNames.has(candidate.toLowerCase())) {
    number += 1;
    candidate = `Untitled-${number}.md`;
  }
  return candidate;
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

function isCompactLayout(): boolean {
  return window.matchMedia('(max-width: 980px)').matches;
}

function loadSplitRatio(): number {
  try {
    const stored = Number(localStorage.getItem('markdown-viewer-split-ratio'));
    return Number.isFinite(stored) && stored >= 25 && stored <= 75 ? stored : 50;
  } catch {
    return 50;
  }
}

function getViewportRightOffset(): number {
  const visualViewport = window.visualViewport;
  if (!visualViewport) return 0;
  return Math.max(0, window.innerWidth - visualViewport.width - visualViewport.offsetLeft);
}
