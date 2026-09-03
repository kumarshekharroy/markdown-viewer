export type ThemeMode =
  | 'system'
  | 'light'
  | 'dark'
  | 'sepia'
  | 'mint'
  | 'sky'
  | 'plum'
  | 'paper'
  | 'rose'
  | 'midnight'
  | 'forest'
  | 'slate'
  | 'ember';
export type FontChoice = 'system' | 'sans' | 'serif' | 'slab' | 'mono' | 'rounded';

export interface Preferences {
  theme: ThemeMode;
  lastThemeOverride: Exclude<ThemeMode, 'system'>;
  fontSize: number;
  fontWeight: number;
  zoom: number;
  lineHeight: number;
  contentWidth: number;
  fullWidth: boolean;
  fontChoice: FontChoice;
  highContrast: boolean;
  codeWrap: boolean;
  reducedMotion: boolean;
  filePanelVisible: boolean;
  tocVisible: boolean;
  filePanelWidth: number;
  tocPanelWidth: number;
}

export interface DocumentState {
  id: string;
  title: string;
  content: string;
  sourceLabel: string;
  sourceUrl?: string;
  path?: string;
  fileHandle?: FileSystemFileHandle;
  canDirectSave: boolean;
  lastModified?: number;
}

export interface FolderDocument {
  id: string;
  name: string;
  path: string;
  content: string;
  fileHandle?: FileSystemFileHandle;
  lastModified?: number;
}

export interface FolderState {
  name: string;
  documents: FolderDocument[];
  assets: Map<string, string>;
}

export interface WorkspaceSession {
  id: 'current';
  document: DocumentState;
  folder?: Pick<FolderState, 'name' | 'documents'>;
  expandedFolders: string[];
  dirty: boolean;
  updatedAt: number;
}

export interface TocItem {
  id: string;
  level: number;
  text: string;
}

export interface RecentDocument {
  id: string;
  title: string;
  sourceLabel: string;
  sourceUrl?: string;
  updatedAt: number;
  size: number;
  fileHandle?: FileSystemFileHandle;
}

export interface DraftRecord {
  id: string;
  title: string;
  content: string;
  sourceLabel: string;
  sourceUrl?: string;
  path?: string;
  updatedAt: number;
  dirty: boolean;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}
