import { useOptionalSync } from '../../app/SyncContext';

const chip = 'shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs';
const neutral = `${chip} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`;
const good = `${chip} bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200`;
const warn = `${chip} font-medium bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900`;
const time = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

/** Header chip: where the data is kept and whether the latest changes reached the Google Sheet. */
export function StorageBadge() {
  const sync = useOptionalSync();

  if (!sync || sync.mode !== 'google') {
    return (
      <span className={neutral}>
        <span className="sm:hidden">Local only</span>
        <span className="hidden sm:inline">Stored on this device only</span>
      </span>
    );
  }
  if (sync.status.kind === 'working') {
    return (
      <span role="status" className={neutral}>
        {sync.status.message}
      </span>
    );
  }

  const button = (short: string, long: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className={warn}>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{long}</span>
    </button>
  );

  switch (sync.saveState) {
    case 'pending':
    case 'saving':
      return (
        <span role="status" className={neutral}>
          Saving…
        </span>
      );
    case 'signed-out':
      return button('Sign in to save', 'Not saved · Sign in to Google', () => void sync.connect());
    case 'error':
      return button('Not saved · Retry', 'Not saved to Google Sheet · Retry', () => void sync.saveNow());
    case 'conflict':
      return button('Changed elsewhere', 'Sheet changed on another device · Choose', () => void sync.saveNow());
    case 'saved':
      if (!sync.signedIn || !sync.file) return button('Sign in', 'Google Sheet · Sign in to connect', () => void sync.connect());
      return (
        <span role="status" className={good}>
          <span className="sm:hidden">Saved</span>
          <span className="hidden sm:inline">Saved to Google Sheet{sync.lastSavedAt ? ` · ${time(sync.lastSavedAt)}` : ''}</span>
        </span>
      );
  }
}
