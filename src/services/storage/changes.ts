/**
 * "Data changed" signal: fires after any write to the app database completes,
 * so the Google Sheet sync can save without every page having to remember to tell it.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let muted = 0;

export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyDataChanged() {
  if (muted > 0) return;
  for (const listener of listeners) listener();
}

/** Runs a write that should not count as a change (e.g. loading the sheet's own data into the browser). */
export async function withoutChangeNotifications<T>(action: () => Promise<T>): Promise<T> {
  muted++;
  try {
    return await action();
  } finally {
    muted--;
  }
}
