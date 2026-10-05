import { useOptionalSync } from '../../app/SyncContext';

const chip = 'shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs';
const neutral = `${chip} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`;
const time = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

/** Header chip saying where the data is kept, with a sign-in button when Google needs it. */
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
    return <span className={neutral}>{sync.status.message}</span>;
  }
  if (!sync.signedIn || !sync.file) {
    return (
      <button
        type="button"
        onClick={() => void sync.connect()}
        className={`${chip} bg-amber-100 font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900`}
      >
        <span className="sm:hidden">Sign in to Google</span>
        <span className="hidden sm:inline">Google Sheet · Sign in to connect</span>
      </button>
    );
  }
  return (
    <span className={`${chip} bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200`}>
      <span className="sm:hidden">Google Sheet</span>
      <span className="hidden sm:inline">
        Google Sheet connected{sync.lastSavedAt ? ` · saved ${time(sync.lastSavedAt)}` : ''}
      </span>
    </span>
  );
}
