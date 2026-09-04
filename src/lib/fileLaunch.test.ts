import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  Reflect.deleteProperty(window, 'launchQueue');
  vi.resetModules();
});

describe('PWA file launches', () => {
  it('queues an OS file launch until the app is ready to consume it', async () => {
    let nativeConsumer: ((params: LaunchParams) => void) | undefined;
    const setConsumer = vi.fn((nextConsumer: (params: LaunchParams) => void) => {
      nativeConsumer = nextConsumer;
    });
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: { setConsumer }
    });

    const { registerFileLaunchQueue, subscribeToFileLaunches } = await import('./fileLaunch');
    const handle = {
      kind: 'file',
      name: 'opened.md'
    } as FileSystemFileHandle;

    expect(registerFileLaunchQueue()).toBe(true);
    expect(registerFileLaunchQueue()).toBe(true);
    expect(setConsumer).toHaveBeenCalledTimes(1);

    nativeConsumer?.({ files: [handle] });
    const appConsumer = vi.fn();
    subscribeToFileLaunches(appConsumer);

    await vi.waitFor(() => expect(appConsumer).toHaveBeenCalledWith([handle]));
  });

  it('ignores directory-only launches', async () => {
    let nativeConsumer: ((params: LaunchParams) => void) | undefined;
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: {
        setConsumer(nextConsumer: (params: LaunchParams) => void) {
          nativeConsumer = nextConsumer;
        }
      }
    });

    const { registerFileLaunchQueue, subscribeToFileLaunches } = await import('./fileLaunch');
    const appConsumer = vi.fn();
    subscribeToFileLaunches(appConsumer);
    registerFileLaunchQueue();

    nativeConsumer?.({
      files: [{ kind: 'directory', name: 'notes' } as FileSystemDirectoryHandle]
    });

    await Promise.resolve();
    expect(appConsumer).not.toHaveBeenCalled();
  });
});
