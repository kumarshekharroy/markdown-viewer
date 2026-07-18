import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DraftRecord, RecentDocument } from '../types';

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
}

let dbPromise: Promise<IDBPDatabase<MarkdownViewerDb>> | undefined;
const memoryDrafts = new Map<string, DraftRecord>();
const memoryRecent = new Map<string, RecentDocument>();
const PREFERENCE_KEYS = ['markdown-viewer-preferences', 'quietmark-preferences'];

function getDb(): Promise<IDBPDatabase<MarkdownViewerDb>> {
  dbPromise ??= openDB<MarkdownViewerDb>('quietmark', 1, {
    upgrade(db) {
      const drafts = db.createObjectStore('drafts', { keyPath: 'id' });
      drafts.createIndex('by-updated', 'updatedAt');
      const recent = db.createObjectStore('recent', { keyPath: 'id' });
      recent.createIndex('by-updated', 'updatedAt');
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
  if (!hasIndexedDb()) {
    return Array.from(memoryDrafts.values())
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .at(-1);
  }
  const db = await getDb();
  const drafts = await db.getAllFromIndex('drafts', 'by-updated');
  return drafts.at(-1);
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

export async function clearApplicationData(): Promise<void> {
  if (!hasIndexedDb()) {
    memoryDrafts.clear();
    memoryRecent.clear();
    PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key));
    return;
  }
  const db = await getDb();
  await db.clear('drafts');
  await db.clear('recent');
  PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key));
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
