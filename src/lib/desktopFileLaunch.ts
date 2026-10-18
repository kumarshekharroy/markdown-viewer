import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

type Consumer = (paths: readonly string[]) => void | Promise<void>;
type Subscription = { consume: Consumer; onError: (error: unknown) => void };

let subscription: Subscription | undefined;
let registration: Promise<void> | undefined;
let deliveryQueue = Promise.resolve();
let readQueue = Promise.resolve();
const pendingLaunches: string[][] = [];

function deliver(paths: string[]): void {
  deliveryQueue = deliveryQueue
    .then(async () => {
      if (subscription) await subscription.consume(paths);
      else pendingLaunches.push(paths);
    })
    .catch((error) => subscription?.onError(error));
}

function collect(): Promise<void> {
  readQueue = readQueue
    .then(async () => {
      const paths = await invoke<string[]>('take_opened_files');
      if (paths.length) deliver(paths);
    })
    .catch((error) => subscription?.onError(error));
  return readQueue;
}

export function subscribeToDesktopFileLaunches(
  consume: Consumer,
  onError: (error: unknown) => void
): () => void {
  const next = { consume, onError };
  subscription = next;
  // Register before draining so launches during initialization cannot be missed.
  registration ??= listen('desktop-files-opened', () => void collect())
    .then(() => collect())
    .catch((error) => {
      registration = undefined;
      subscription?.onError(error);
    });
  pendingLaunches.splice(0).forEach(deliver);
  return () => {
    if (subscription === next) subscription = undefined;
  };
}
