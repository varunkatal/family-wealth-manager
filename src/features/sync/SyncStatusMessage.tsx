import { useSync } from '../../app/SyncContext';

/** Progress or error from the last Google action. */
export function SyncStatusMessage({ className = '' }: { className?: string }) {
  const { status, dismissError } = useSync();
  if (status.kind === 'idle') return null;
  if (status.kind === 'working') {
    return (
      <p role="status" className={`text-sm text-slate-600 dark:text-slate-300 ${className}`}>
        {status.message}
      </p>
    );
  }
  return (
    <div role="alert" className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <p>{status.message}</p>
        <button type="button" onClick={dismissError} className="shrink-0 font-medium underline">
          Dismiss
        </button>
      </div>
      {status.details && status.details.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {status.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
