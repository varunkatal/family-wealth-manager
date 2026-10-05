import { useState } from 'react';
import { useOptionalSync } from '../../app/SyncContext';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Modal } from '../../components/Modal';
import { SyncStatusMessage } from './SyncStatusMessage';

function DisconnectDialog({ unsaved, onConfirm, onCancel }: { unsaved: boolean; onConfirm: (deleteBrowserData: boolean) => Promise<void>; onCancel: () => void }) {
  const [deleteHere, setDeleteHere] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Disconnect Google Sheet?" onClose={onCancel} role="alertdialog">
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>
          The app stops saving to your Google Sheet and signs out of Google. The sheet stays in your Google Drive; you can connect to it again
          later.
        </p>
        {unsaved && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Some changes in this browser have not been saved to the sheet yet.
          </p>
        )}
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-0.5" checked={deleteHere} onChange={(e) => setDeleteHere(e.target.checked)} />
          <span>Also delete the data stored in this browser (for example on a shared computer). The Google Sheet is not affected.</span>
        </label>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={busy} autoFocus>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onConfirm(deleteHere).finally(() => setBusy(false));
          }}
        >
          Disconnect
        </Button>
      </div>
    </Modal>
  );
}

/** Where the data is kept, and switching between Google Sheet and this browser only. */
export function GoogleSheetCard() {
  const sync = useOptionalSync();
  const [confirming, setConfirming] = useState(false);
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
                Connected to <strong>{sync.file!.name}</strong> in your Google Drive. Every change is saved to it automatically within a few
                seconds; this browser keeps a working copy.
              </>
            ) : (
              'Your data is kept in your Google Sheet. Sign in to Google to connect this browser to it. Changes made meanwhile are kept here and saved when you sign in.'
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {connected ? (
              <>
                <Button variant="secondary" onClick={() => void sync.saveNow()} disabled={busy || sync.saveState === 'saving'}>
                  Save now
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
            <Button variant="ghost" onClick={() => setConfirming(true)} disabled={busy}>
              Disconnect…
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
      {confirming && (
        <DisconnectDialog
          unsaved={sync.saveState !== 'saved'}
          onCancel={() => setConfirming(false)}
          onConfirm={async (deleteBrowserData) => {
            await sync.disconnect({ deleteBrowserData });
            setConfirming(false);
          }}
        />
      )}
    </Card>
  );
}
