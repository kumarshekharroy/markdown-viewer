import type { DocumentState } from '../types';
import { documentFromContent, filenameForMarkdown, readMarkdownFile } from './files';
import { displayNameFromPath } from './markdown';

const filters = [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'txt'] }];

function filename(path: string): string {
  return path.split(/[\\/]/).pop() || 'document.md';
}

export async function openDesktopMarkdown(): Promise<DocumentState | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const path = await open({ multiple: false, directory: false, filters });
  if (!path) return null;

  const { readFile } = await import('@tauri-apps/plugin-fs');
  const bytes = await readFile(path);
  const name = filename(path);
  const file = new File([new Uint8Array(bytes).buffer], name);
  const content = await readMarkdownFile(file);

  return documentFromContent(content, displayNameFromPath(name), name, {
    path: name,
    desktopPath: path,
    canDirectSave: true
  });
}

export async function saveDesktopMarkdown(
  document: DocumentState,
  saveAs = false
): Promise<DocumentState | null> {
  let path = saveAs ? undefined : document.desktopPath;

  if (!path) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    path =
      (await save({
        defaultPath: filenameForMarkdown(document.title),
        filters
      })) ?? undefined;
  }
  if (!path) return null;

  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  await writeTextFile(path, document.content);
  const name = filename(path);

  return {
    ...document,
    title: displayNameFromPath(name),
    sourceLabel: name,
    path: name,
    desktopPath: path,
    fileHandle: undefined,
    canDirectSave: true
  };
}
