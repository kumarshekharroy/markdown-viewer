import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { documentFromContent } from './lib/files';
import { clearApplicationData, saveWorkspaceSession } from './lib/storage';
import type { DocumentState } from './types';

const native = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
  read: vi.fn(),
  subscribe: vi.fn(),
  ask: vi.fn(),
  onCloseRequested: vi.fn()
}));

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
vi.mock('./lib/desktopFiles', () => ({
  openDesktopMarkdown: native.open,
  readDesktopMarkdown: native.read,
  saveDesktopMarkdown: native.save
}));
vi.mock('./lib/desktopFileLaunch', () => ({ subscribeToDesktopFileLaunches: native.subscribe }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ onCloseRequested: native.onCloseRequested })
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ ask: native.ask }));
vi.mock('./components/MarkdownEditor', () => ({
  MarkdownEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Markdown source"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}));

beforeEach(async () => {
  Object.values(native).forEach((mock) => mock.mockReset());
  native.onCloseRequested.mockResolvedValue(vi.fn());
  native.subscribe.mockReturnValue(vi.fn());
  localStorage.clear();
  await clearApplicationData();
});

async function openNote() {
  const user = userEvent.setup();
  const document = documentFromContent('# Note', 'note', 'note.md', {
    desktopPath: '/notes/note.md',
    canDirectSave: true
  });
  native.open.mockResolvedValue(document);
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Open' }));
  await screen.findByRole('heading', { name: 'Note' });
  await user.click(screen.getByRole('button', { name: 'Edit Markdown' }));
  const editor = await screen.findByRole('textbox', { name: 'Markdown source' });
  return { user, document, editor };
}

describe('desktop app file handling', () => {
  it('opens OS-launched files in tabs and preserves unsaved edits when the same file is opened again', async () => {
    const user = userEvent.setup();
    const document = documentFromContent('# From Finder', 'finder-note', 'finder-note.md', {
      desktopPath: '/notes/finder-note.md',
      canDirectSave: true
    });
    native.read.mockResolvedValue(document);
    render(<App />);
    await waitFor(() => expect(native.subscribe).toHaveBeenCalledOnce());
    const consume = native.subscribe.mock.calls[0][0];
    await act(async () => consume(['/notes/finder-note.md']));

    expect(screen.getByRole('heading', { name: 'From Finder' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit Markdown' }));
    const editor = await screen.findByRole('textbox', { name: 'Markdown source' });
    fireEvent.change(editor, { target: { value: '# Keep unsaved edits' } });
    await act(async () => consume(['/notes/finder-note.md']));

    expect(native.read).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(editor).toHaveValue('# Keep unsaved edits');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('●');
  });

  it('continues opening other OS-launched files when one is unreadable', async () => {
    native.read.mockRejectedValueOnce(new Error('Unreadable file')).mockResolvedValueOnce(
      documentFromContent('# Readable', 'readable', 'readable.md', {
        desktopPath: '/notes/readable.md',
        canDirectSave: true
      })
    );
    render(<App />);
    await waitFor(() => expect(native.subscribe).toHaveBeenCalledOnce());
    await act(async () =>
      native.subscribe.mock.calls[0][0](['/notes/broken.md', '/notes/readable.md'])
    );

    expect(screen.getByRole('heading', { name: 'Readable' })).toBeInTheDocument();
    expect(native.read).toHaveBeenCalledTimes(2);
  });

  it('uses desktop-appropriate privacy, settings, and example copy', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText(/Your local documents stay on your device/)).toBeInTheDocument();
    expect(screen.queryByText(/this browser/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Privacy' }));
    const privacy = screen.getByRole('dialog', { name: 'Privacy and Local Data' });
    expect(privacy).toHaveTextContent('Native file access lasts for the current app session.');
    expect(privacy).not.toHaveTextContent(/browser/i);
    await user.click(within(privacy).getByRole('button', { name: 'Close dialog' }));

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Preferences' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toHaveTextContent(
      'Changes are saved automatically on this device.'
    );
  });

  it('gives native save instructions for files imported without a native path', async () => {
    const bytes = new TextEncoder().encode('# Imported file');
    const file = {
      name: 'imported.md',
      size: bytes.length,
      arrayBuffer: async () => bytes.buffer
    };
    render(<App />);
    const input = document.querySelector('input[type="file"]:not([multiple])')!;
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByRole('heading', { name: 'Imported file' });
    expect(screen.getByRole('status')).toHaveTextContent(
      'File opened. Use Save to choose where to keep your changes.'
    );
    expect(screen.getByRole('status')).not.toHaveTextContent(/browser|download/i);
  });

  it('keeps the current document when the native Open dialog is canceled', async () => {
    native.open.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('heading', { name: 'Markdown Viewer Example' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });

  it('keeps a canceled or failed save dirty and reports write errors', async () => {
    const { user, editor } = await openNote();
    fireEvent.change(editor, { target: { value: '# Changed' } });
    native.save.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('Disk full'));

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('●');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Disk full');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('●');
    expect(editor).toHaveValue('# Changed');
  });

  it('preserves edits made during Save As and uses the new path on the next Save', async () => {
    const { user, editor } = await openNote();
    fireEvent.change(editor, { target: { value: '# Saved snapshot' } });
    let finishSave!: (document: DocumentState) => void;
    native.save.mockImplementationOnce(
      () => new Promise<DocumentState>((resolve) => (finishSave = resolve))
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Save As' }));
    await waitFor(() => expect(native.save).toHaveBeenCalledOnce());
    const snapshot = native.save.mock.calls[0][0] as DocumentState;
    expect(native.save.mock.calls[0][1]).toBe(true);
    fireEvent.change(editor, { target: { value: '# Newer unsaved edit' } });

    await act(async () => {
      finishSave({
        ...snapshot,
        title: 'copy',
        path: 'copy.md',
        sourceLabel: 'copy.md',
        desktopPath: '/notes/copy.md'
      });
    });

    expect(editor).toHaveValue('# Newer unsaved edit');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(/copy.*●/);
    native.save.mockResolvedValueOnce(null);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(native.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ desktopPath: '/notes/copy.md', content: '# Newer unsaved edit' }),
      false
    );
  });

  it('clears stale native permissions when restoring a workspace', async () => {
    const document = documentFromContent('# Restored', 'note', 'note.md', {
      desktopPath: '/notes/note.md',
      canDirectSave: true
    });
    await saveWorkspaceSession({
      id: 'current',
      document,
      dirty: true,
      expandedFolders: [],
      updatedAt: Date.now()
    });
    const user = userEvent.setup();
    native.save.mockResolvedValue(null);
    render(<App />);
    await screen.findByRole('heading', { name: 'Restored' });
    await user.click(screen.getByRole('button', { name: 'Edit Markdown' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(native.save).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '# Restored',
        desktopPath: undefined,
        canDirectSave: false
      }),
      false
    );
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('●');
  });

  it('prevents native window close when the user keeps unsaved changes', async () => {
    const { editor } = await openNote();
    fireEvent.change(editor, { target: { value: '# Keep editing' } });
    await waitFor(() => expect(native.onCloseRequested).toHaveBeenCalledOnce());
    const onClose = native.onCloseRequested.mock.calls[0][0];
    const event = { preventDefault: vi.fn() };
    native.ask.mockResolvedValue(false);

    await act(async () => onClose(event));

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(editor).toHaveValue('# Keep editing');
  });
});
