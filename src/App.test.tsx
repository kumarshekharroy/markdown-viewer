import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { clearApplicationData } from './lib/storage';

describe('App', () => {
  beforeEach(async () => {
    Reflect.deleteProperty(window, 'launchQueue');
    localStorage.clear();
    await clearApplicationData();
  });

  it('renders the example document in reading mode by default', async () => {
    render(<App />);

    expect(screen.getAllByText('Markdown Viewer')).not.toHaveLength(0);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Markdown Viewer Example/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^Open$/i })).toBeInTheDocument();
  });

  it('opens the search panel and reports matches', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Find in document/i }));
    await user.type(screen.getByPlaceholderText(/Search this document/i), 'Markdown');

    expect(screen.getByText(/^1 of \d+$/i)).toBeInTheDocument();
  });

  it('keeps quick reading controls available and applies their settings', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('toolbar', { name: 'Reading controls' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Increase font size/i }));
    await user.click(screen.getByRole('button', { name: /^Zoom in/i }));
    await user.click(screen.getByRole('button', { name: /^Increase font weight/i }));
    await user.click(screen.getByRole('button', { name: 'Enable high contrast' }));

    const article = document.querySelector<HTMLElement>('.markdown-body');
    expect(article?.style.getPropertyValue('--reader-font-size')).toBe('19px');
    expect(article?.style.getPropertyValue('--reader-font-weight')).toBe('500');
    expect(article?.style.zoom).toBe('1.1');
    expect(document.documentElement).toHaveAttribute('data-contrast', 'high');

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('markdown-viewer-preferences') ?? '{}')).toMatchObject(
        {
          fontSize: 19,
          fontWeight: 500,
          zoom: 110,
          highContrast: true
        }
      );
    });
  });

  it('opens a Markdown file passed to the installed PWA by the operating system', async () => {
    let nativeConsumer: ((params: LaunchParams) => void) | undefined;
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: {
        setConsumer(nextConsumer: (params: LaunchParams) => void) {
          nativeConsumer = nextConsumer;
        }
      }
    });
    const bytes = new TextEncoder().encode('# Opened from desktop');
    const file = {
      name: 'double-click.md',
      size: bytes.byteLength,
      lastModified: 123,
      arrayBuffer: vi.fn().mockResolvedValue(bytes.buffer)
    } as unknown as File;
    const handle = {
      kind: 'file',
      name: file.name,
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
      getFile: vi.fn().mockResolvedValue(file)
    } as unknown as FileSystemFileHandle;

    render(<App />);

    await waitFor(() => expect(nativeConsumer).toBeDefined());
    nativeConsumer?.({ files: [handle] });

    expect(await screen.findByRole('heading', { name: 'Opened from desktop' })).toBeInTheDocument();
    expect(handle.getFile).toHaveBeenCalledOnce();
    expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'read' });
  });
});
