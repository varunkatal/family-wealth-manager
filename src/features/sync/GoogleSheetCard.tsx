import { useOptionalSync } from '../../app/SyncContext';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { SyncStatusMessage } from './SyncStatusMessage';

/** Where the data is kept, and switching between Google Sheet and this browser only. */
export function GoogleSheetCard() {
  const sync = useOptionalSync();
  if (!sync) return null;
  const busy = sync.status.kind === 'working';
  const connected = sync.mode === 'google' && sync.signedIn && sync.file;

  return (
    <Card className="mb-6">
      <h2 className="font-semibold">Google Sheet</h2>
      {sync.mode === 'google' ? (
        <>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {connected ? (
              <>
                Connected to <strong>{sync.file!.name}</strong> in your Google Drive. This browser keeps a working copy.
              </>
            ) : (
              'Your data is kept in your Google Sheet. Sign in to Google to connect this browser to it.'
            )}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Changes are not saved to the sheet automatically yet. Use <strong>Save to Google Sheet now</strong> after making changes.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {connected ? (
              <>
                <Button onClick={() => void sync.saveNow()} disabled={busy}>
                  Save to Google Sheet now
                </Button>
                {sync.file!.webViewLink && (
                  <a
                    href={sync.file!.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Open in Google Sheets
                  </a>
                )}
              </>
            ) : (
              <Button onClick={() => void sync.connect()} disabled={busy || !sync.googleAvailable}>
                Sign in to Google
              </Button>
            )}
            <Button variant="ghost" onClick={() => void sync.disconnect()} disabled={busy}>
              Disconnect (use this browser only)
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Your data is stored in this browser only. Connect a Google Sheet to keep it in your own Google Drive and use it from other devices.
            The app can open only the spreadsheet it creates.
          </p>
          <Button className="mt-4" onClick={() => void sync.connect()} disabled={busy || !sync.googleAvailable}>
            Connect Google Sheet
          </Button>
          {!sync.googleAvailable && <p className="mt-2 text-xs text-slate-500">Google sign-in is not set up for this copy of the app.</p>}
        </>
      )}
      <SyncStatusMessage className="mt-3" />
    </Card>
  );
}
