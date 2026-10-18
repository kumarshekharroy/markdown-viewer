import { File as NodeFile } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { documentFromContent, MAX_FILE_SIZE } from './files';
import { openDesktopMarkdown, saveDesktopMarkdown } from './desktopFiles';

const native = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
  readFile: vi.fn(),
  writeTextFile: vi.fn()
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: native.open, save: native.save }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: native.readFile,
  writeTextFile: native.writeTextFile
}));

beforeEach(() => {
  Object.values(native).forEach((mock) => mock.mockReset());
  // jsdom's File lacks arrayBuffer; Node's File implements the same browser API.
  vi.stubGlobal('File', NodeFile);
});

afterEach(() => vi.unstubAllGlobals());

describe('desktop Markdown files', () => {
  it('opens a Windows path with the existing Markdown validation and direct-save metadata', async () => {
    native.open.mockResolvedValue('C:\\Notes\\hello.md');
    native.readFile.mockResolvedValue(new TextEncoder().encode('# Hello'));

    const document = await openDesktopMarkdown();

    expect(document).toMatchObject({
      title: 'hello',
      content: '# Hello',
      path: 'hello.md',
      desktopPath: 'C:\\Notes\\hello.md',
      canDirectSave: true
    });
    expect(native.readFile).toHaveBeenCalledWith('C:\\Notes\\hello.md');
  });

  it('does not read a file when Open is canceled', async () => {
    native.open.mockResolvedValue(null);

    expect(await openDesktopMarkdown()).toBeNull();
    expect(native.readFile).not.toHaveBeenCalled();
  });

  it('rejects invalid UTF-8 and oversized files before opening them in the editor', async () => {
    native.open.mockResolvedValue('/notes/broken.md');
    native.readFile.mockResolvedValue(new Uint8Array([0xff]));
    await expect(openDesktopMarkdown()).rejects.toThrow('UTF-8');

    native.readFile.mockResolvedValue(new Uint8Array(MAX_FILE_SIZE + 1));
    await expect(openDesktopMarkdown()).rejects.toThrow('larger than 8 MB');
  });

  it('saves to the opened path without asking for another destination', async () => {
    const document = documentFromContent('# Updated', 'note', 'note.md', {
      desktopPath: '/notes/note.md',
      canDirectSave: true
    });

    expect(await saveDesktopMarkdown(document)).toMatchObject({
      desktopPath: '/notes/note.md',
      canDirectSave: true
    });
    expect(native.save).not.toHaveBeenCalled();
    expect(native.writeTextFile).toHaveBeenCalledWith('/notes/note.md', '# Updated');
  });

  it('uses the Save As destination for later saves without mutating the original document', async () => {
    const document = documentFromContent('# Copy', 'original', 'original.md', {
      desktopPath: '/notes/original.md'
    });
    native.save.mockResolvedValue('/notes/copy.markdown');

    const saved = await saveDesktopMarkdown(document, true);
    expect(saved).toMatchObject({
      id: document.id,
      title: 'copy',
      path: 'copy.markdown',
      desktopPath: '/notes/copy.markdown'
    });
    expect(document.desktopPath).toBe('/notes/original.md');

    await saveDesktopMarkdown(saved!);
    expect(native.save).toHaveBeenCalledOnce();
    expect(native.writeTextFile).toHaveBeenLastCalledWith('/notes/copy.markdown', '# Copy');
  });

  it('does not write or change the document when Save As is canceled', async () => {
    const document = documentFromContent('# Keep', 'note', 'note.md');
    native.save.mockResolvedValue(null);

    expect(await saveDesktopMarkdown(document)).toBeNull();
    expect(native.writeTextFile).not.toHaveBeenCalled();
    expect(document.desktopPath).toBeUndefined();
  });

  it('propagates write failures so the app keeps unsaved changes', async () => {
    native.writeTextFile.mockRejectedValue(new Error('Disk full'));
    const document = documentFromContent('# Keep', 'note', 'note.md', {
      desktopPath: '/notes/note.md'
    });

    await expect(saveDesktopMarkdown(document)).rejects.toThrow('Disk full');
  });
});
