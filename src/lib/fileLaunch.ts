export type FileLaunchConsumer = (handles: readonly FileSystemFileHandle[]) => void | Promise<void>;

let consumer: FileLaunchConsumer | undefined;
let launchQueueRegistered = false;
let deliveryQueue = Promise.resolve();
const pendingLaunches: Array<readonly FileSystemFileHandle[]> = [];

function deliver(handles: readonly FileSystemFileHandle[]): void {
  deliveryQueue = deliveryQueue
    .then(async () => {
      if (!consumer) {
        pendingLaunches.push(handles);
        return;
      }
      await consumer(handles);
    })
    .catch(() => {
      // The app-level consumer reports launch errors in the UI. Keeping this
      // chain resolved ensures a failed file does not block a later launch.
    });
}

/**
 * Registers the native launch consumer as early as possible. The browser also
 * queues launches until setConsumer is called; this module adds a second small
 * queue until React has restored the previous workspace and is ready to open it.
 */
export function registerFileLaunchQueue(): boolean {
  if (launchQueueRegistered) return true;
  if (typeof window === 'undefined' || !window.launchQueue) return false;

  try {
    window.launchQueue.setConsumer((launchParams) => {
      const fileHandles = launchParams.files.filter(
        (handle): handle is FileSystemFileHandle => handle.kind === 'file'
      );
      if (fileHandles.length > 0) deliver(fileHandles);
    });
    launchQueueRegistered = true;
    return true;
  } catch {
    return false;
  }
}

export function subscribeToFileLaunches(nextConsumer: FileLaunchConsumer): () => void {
  consumer = nextConsumer;
  registerFileLaunchQueue();

  const waiting = pendingLaunches.splice(0);
  waiting.forEach(deliver);

  return () => {
    if (consumer === nextConsumer) consumer = undefined;
  };
}
