import { useEffect, useRef } from 'react';
import { saveWorkspaceSession } from '../lib/storage';
import type { DocumentState, FolderState } from '../types';

export const TREE_STATE_KEY = 'markdown-viewer-tree-state';
export function loadFolderExpansion(name: string | undefined, fallback: string[]): string[] {
  try {
    const state = JSON.parse(localStorage.getItem(TREE_STATE_KEY) ?? '{}');
    if (state.name === name && Array.isArray(state.paths))
      return state.paths.filter((path: unknown) => typeof path === 'string');
  } catch {
    /* Use the last durable workspace snapshot. */
  }
  return fallback;
}

export function useWorkspacePersistence(
  documentState: DocumentState,
  folder: FolderState | null,
  expanded: Set<string>,
  dirty: boolean,
  ready: boolean,
  onError: () => void
) {
  const expandedRef = useRef(expanded);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    expandedRef.current = expanded;
    if (!ready) return;
    try {
      localStorage.setItem(
        TREE_STATE_KEY,
        JSON.stringify({ name: folder?.name, paths: Array.from(expanded) })
      );
    } catch {
      /* Best effort; snapshot also includes this state. */
    }
  }, [expanded, folder?.name, ready]);
  useEffect(() => {
    if (!ready) return;
    const save = () =>
      saveWorkspaceSession({
        id: 'current',
        document: documentState,
        folder: folder ? { name: folder.name, documents: folder.documents } : undefined,
        expandedFolders: Array.from(expandedRef.current),
        dirty,
        updatedAt: Date.now()
      }).catch(() => onErrorRef.current());
    const timer = window.setTimeout(save, 300);
    return () => window.clearTimeout(timer);
  }, [documentState, folder, dirty, ready]);
}
