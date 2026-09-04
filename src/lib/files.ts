import { displayNameFromPath, isAssetFile, isMarkdownFile, normalizePath } from './markdown';
import type { DocumentState, FolderDocument, FolderState } from '../types';

export const MAX_FILE_SIZE = 8 * 1024 * 1024;

export async function readMarkdownFile(file: File): Promise<string> {
  if (!isMarkdownFile(file.name)) {
    throw new Error('Choose a .md, .markdown, .mdown, or .txt file.');
  }
  if (file.size === 0) {
    throw new Error('This file is empty.');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      'This file is larger than 8 MB. Open a smaller Markdown file for best performance.'
    );
  }

  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new Error('This file could not be decoded as UTF-8 text.');
  }
}

export function documentFromContent(
  content: string,
  title: string,
  sourceLabel: string,
  options: Partial<DocumentState> = {}
): DocumentState {
  return {
    id: options.id ?? crypto.randomUUID(),
    title,
    content,
    sourceLabel,
    canDirectSave: Boolean(options.fileHandle),
    ...options
  };
}

/**
 * Removes virtual Untitled entries created by versions that placed a new,
 * unsaved document inside the open folder tree. Real folder files always
 * include either a file handle or their File.lastModified timestamp.
 */
export function isLegacyUnsavedFolderEntry(document: FolderDocument): boolean {
  const filename = document.path.split('/').filter(Boolean).at(-1) ?? '';
  return (
    document.fileHandle === undefined &&
    document.lastModified === undefined &&
    document.content === '' &&
    /^Untitled(?:-\d+)?\.md$/i.test(filename)
  );
}

export function downloadText(
  filename: string,
  content: string,
  type = 'text/markdown;charset=utf-8'
): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function filenameForMarkdown(title: string): string {
  const clean =
    title
      .trim()
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'document';
  return /\.(md|markdown|mdown|txt)$/i.test(clean) ? clean : `${clean}.md`;
}

export async function verifyPermission(
  handle: FileSystemFileHandle,
  mode: FileSystemPermissionMode = 'readwrite'
): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  const descriptor = { mode };
  if ((await handle.queryPermission(descriptor)) === 'granted') return true;
  return (await handle.requestPermission(descriptor)) === 'granted';
}

export async function saveToFileHandle(
  handle: FileSystemFileHandle,
  content: string
): Promise<void> {
  const allowed = await verifyPermission(handle, 'readwrite');
  if (!allowed) {
    throw new Error('The browser did not grant permission to update the original file.');
  }
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function pickSaveAs(suggestedName: string, content: string): Promise<boolean> {
  if (!window.showSaveFilePicker) {
    downloadText(suggestedName, content);
    return false;
  }
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [
      {
        description: 'Markdown',
        accept: {
          'text/markdown': ['.md', '.markdown', '.mdown'],
          'text/plain': ['.txt']
        }
      }
    ]
  });
  await saveToFileHandle(handle, content);
  return true;
}

export async function folderFromDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<FolderState> {
  const documents: FolderDocument[] = [];
  const assets = new Map<string, string>();
  await walkDirectoryHandle(handle, '', documents, assets);
  documents.sort((a, b) => a.path.localeCompare(b.path));
  return { name: handle.name, documents, assets };
}

async function walkDirectoryHandle(
  directory: FileSystemDirectoryHandle,
  basePath: string,
  documents: FolderDocument[],
  assets: Map<string, string>
): Promise<void> {
  for await (const entry of directory.values()) {
    const path = normalizePath(`${basePath}/${entry.name}`);
    if (entry.kind === 'directory') {
      await walkDirectoryHandle(entry as FileSystemDirectoryHandle, path, documents, assets);
      continue;
    }

    const fileHandle = entry as FileSystemFileHandle;
    const file = await fileHandle.getFile();
    if (isMarkdownFile(file.name)) {
      try {
        const content = await readMarkdownFile(file);
        documents.push({
          id: path,
          name: displayNameFromPath(path),
          path,
          content,
          fileHandle,
          lastModified: file.lastModified
        });
      } catch {
        // Malformed Markdown files are skipped in folder mode and can still be opened individually.
      }
    } else if (isAssetFile(file.name) && file.size <= MAX_FILE_SIZE) {
      assets.set(path, URL.createObjectURL(file));
    }
  }
}

export async function folderFromInputFiles(files: FileList): Promise<FolderState> {
  const documents: FolderDocument[] = [];
  const assets = new Map<string, string>();
  const rootName = files[0]?.webkitRelativePath?.split('/')[0] || 'Selected folder';

  for (const file of Array.from(files)) {
    const path = normalizePath(file.webkitRelativePath || file.name);
    if (isMarkdownFile(file.name)) {
      try {
        documents.push({
          id: path,
          name: displayNameFromPath(path),
          path,
          content: await readMarkdownFile(file),
          lastModified: file.lastModified
        });
      } catch {
        // Skip unreadable files in bulk folder mode.
      }
    } else if (isAssetFile(file.name) && file.size <= MAX_FILE_SIZE) {
      assets.set(path, URL.createObjectURL(file));
    }
  }

  documents.sort((a, b) => a.path.localeCompare(b.path));
  return { name: rootName, documents, assets };
}

export function buildHtmlExport(title: string, articleHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; color: #1f2937; background: #f7f5ef; font: 18px/1.65 system-ui, sans-serif; }
    main { max-width: 760px; margin: 0 auto; padding: 48px 24px; background: #fffdfa; }
    img, svg, video, canvas { max-width: 100%; height: auto; }
    pre { overflow-x: auto; padding: 16px; background: #111827; color: #f8fafc; border-radius: 8px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d8d2c3; padding: 8px; }
    blockquote { border-left: 4px solid #0f766e; margin-left: 0; padding-left: 16px; color: #475569; }
  </style>
</head>
<body><main>${articleHtml}</main></body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
