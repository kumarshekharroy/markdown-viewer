import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen: native.listen }));

beforeEach(() => {
  vi.resetModules();
  native.invoke.mockReset().mockResolvedValue([]);
  native.listen.mockReset().mockResolvedValue(vi.fn());
});

afterEach(() => vi.resetModules());

describe('desktop file launch queue', () => {
  it('listens before draining files received before React was ready', async () => {
    native.invoke.mockResolvedValueOnce(['/notes/startup.md']);
    const { subscribeToDesktopFileLaunches } = await import('./desktopFileLaunch');
    const consume = vi.fn();
    subscribeToDesktopFileLaunches(consume, vi.fn());

    await vi.waitFor(() => expect(consume).toHaveBeenCalledWith(['/notes/startup.md']));
    expect(native.listen.mock.invocationCallOrder[0]).toBeLessThan(
      native.invoke.mock.invocationCallOrder[0]
    );
  });

  it('drains later launches without delivering the same queued file twice', async () => {
    const { subscribeToDesktopFileLaunches } = await import('./desktopFileLaunch');
    const consume = vi.fn();
    subscribeToDesktopFileLaunches(consume, vi.fn());
    await vi.waitFor(() => expect(native.invoke).toHaveBeenCalledOnce());
    const notify = native.listen.mock.calls[0][1];
    native.invoke.mockResolvedValueOnce(['/notes/later.md']).mockResolvedValue([]);
    notify();
    notify();

    await vi.waitFor(() => expect(consume).toHaveBeenCalledOnce());
    expect(consume).toHaveBeenCalledWith(['/notes/later.md']);
  });

  it('retains an in-flight launch when React unsubscribes and mounts again', async () => {
    let finish!: (paths: string[]) => void;
    native.invoke.mockImplementationOnce(
      () => new Promise<string[]>((resolve) => (finish = resolve))
    );
    const { subscribeToDesktopFileLaunches } = await import('./desktopFileLaunch');
    const first = vi.fn();
    const unsubscribe = subscribeToDesktopFileLaunches(first, vi.fn());
    await vi.waitFor(() => expect(native.invoke).toHaveBeenCalledOnce());
    unsubscribe();
    finish(['/notes/pending.md']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = vi.fn();
    subscribeToDesktopFileLaunches(second, vi.fn());

    await vi.waitFor(() => expect(second).toHaveBeenCalledWith(['/notes/pending.md']));
    expect(first).not.toHaveBeenCalled();
    expect(native.listen).toHaveBeenCalledOnce();
  });

  it('reports an IPC failure and continues delivering later launches', async () => {
    native.invoke.mockRejectedValueOnce(new Error('IPC failed'));
    const { subscribeToDesktopFileLaunches } = await import('./desktopFileLaunch');
    const consume = vi.fn();
    const onError = vi.fn();
    subscribeToDesktopFileLaunches(consume, onError);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    native.invoke.mockResolvedValueOnce(['/notes/recovered.md']);
    native.listen.mock.calls[0][1]();

    await vi.waitFor(() => expect(consume).toHaveBeenCalledWith(['/notes/recovered.md']));
  });
});
