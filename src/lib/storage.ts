import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DraftRecord, RecentDocument, WorkspaceSession } from '../types';

interface MarkdownViewerDb extends DBSchema {
  drafts: {
    key: string;
    value: DraftRecord;
    indexes: { 'by-updated': number };
  };
  recent: {
    key: string;
    value: RecentDocument;
    indexes: { 'by-updated': number };
  };
  workspace: {
    key: string;
    value: WorkspaceSession;
  };
}

let dbPromise: Promise<IDBPDatabase<MarkdownViewerDb>> | undefined;
const memoryDrafts = new Map<string, DraftRecord>();
const memoryRecent = new Map<string, RecentDocument>();
let memoryWorkspace: WorkspaceSession | undefined;
const PREFERENCE_KEYS = [
  'markdown-viewer-preferences',
  'quietmark-preferences',
  'markdown-viewer-tree-state',
  'markdown-viewer-split-ratio'
];
const SCROLL_POSITIONS_KEY = 'markdown-viewer-scroll-positions';

function getDb(): Promise<IDBPDatabase<MarkdownViewerDb>> {
  dbPromise ??= openDB<MarkdownViewerDb>('quietmark', 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('drafts')) {
        const drafts = db.createObjectStore('drafts', { keyPath: 'id' });
        drafts.createIndex('by-updated', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('recent')) {
        const recent = db.createObjectStore('recent', { keyPath: 'id' });
        recent.createIndex('by-updated', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('workspace')) {
        db.createObjectStore('workspace', { keyPath: 'id' });
      }
    }
  });
  return dbPromise;
}

export async function saveDraft(record: DraftRecord): Promise<void> {
  if (!hasIndexedDb()) {
    memoryDrafts.set(record.id, record);
    return;
  }
  const db = await getDb();
  await db.put('drafts', record);
}

export async function deleteDraft(id: string): Promise<void> {
  if (!hasIndexedDb()) {
    memoryDrafts.delete(id);
    return;
  }
  const db = await getDb();
  await db.delete('drafts', id);
}

export async function latestDraft(): Promise<DraftRecord | undefined> {
  return (await getDrafts())[0];
}

export async function getDrafts(): Promise<DraftRecord[]> {
  if (!hasIndexedDb()) {
    return Array.from(memoryDrafts.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  const db = await getDb();
  const drafts = await db.getAllFromIndex('drafts', 'by-updated');
  return drafts.reverse();
}

export async function upsertRecent(record: RecentDocument): Promise<void> {
  if (!hasIndexedDb()) {
    memoryRecent.set(record.id, record);
    trimMemoryRecent();
    return;
  }
  const db = await getDb();
  await db.put('recent', record);
  const all = await db.getAllFromIndex('recent', 'by-updated');
  const overflow = all.slice(0, Math.max(0, all.length - 12));
  await Promise.all(overflow.map((item) => db.delete('recent', item.id)));
}

export async function getRecent(): Promise<RecentDocument[]> {
  if (!hasIndexedDb()) {
    return Array.from(memoryRecent.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  const db = await getDb();
  const records = await db.getAllFromIndex('recent', 'by-updated');
  return records.reverse();
}

export async function removeRecent(id: string): Promise<void> {
  if (!hasIndexedDb()) {
    memoryRecent.delete(id);
    return;
  }
  const db = await getDb();
  await db.delete('recent', id);
}

export async function saveWorkspaceSession(session: WorkspaceSession): Promise<void> {
  if (!hasIndexedDb()) {
    memoryWorkspace = session;
    return;
  }
  const db = await getDb();
  try {
    await db.put('workspace', session);
  } catch {
    // Some engines cannot clone file-system handles. The content and UI state can
    // still be restored even when direct-save permission cannot be retained.
    await db.put('workspace', withoutFileHandles(session));
  }
}

export async function getWorkspaceSession(): Promise<WorkspaceSession | undefined> {
  if (!hasIndexedDb()) return memoryWorkspace;
  const db = await getDb();
  return db.get('workspace', 'current');
}

export async function clearApplicationData(): Promise<void> {
  if (!hasIndexedDb()) {
    memoryDrafts.clear();
    memoryRecent.clear();
    memoryWorkspace = undefined;
    PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(SCROLL_POSITIONS_KEY);
    return;
  }
  const db = await getDb();
  await db.clear('drafts');
  await db.clear('recent');
  await db.clear('workspace');
  PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(SCROLL_POSITIONS_KEY);
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function trimMemoryRecent(): void {
  const sorted = Array.from(memoryRecent.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  for (const item of sorted.slice(12)) {
    memoryRecent.delete(item.id);
  }
}

function withoutFileHandles(session: WorkspaceSession): WorkspaceSession {
  return {
    ...session,
    document: {
      ...session.document,
      fileHandle: undefined,
      canDirectSave: false
    },
    tabs: session.tabs?.map((tab) => ({
      ...tab,
      document: { ...tab.document, fileHandle: undefined, canDirectSave: false }
    })),
    folder: session.folder
      ? {
          ...session.folder,
          documents: session.folder.documents.map((document) => ({
            ...document,
            fileHandle: undefined
          }))
        }
      : undefined
  };
}
