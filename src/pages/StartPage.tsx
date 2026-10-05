import { useSync } from '../app/SyncContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Disclaimer } from '../components/Disclaimer';
import { SyncStatusMessage } from '../features/sync/SyncStatusMessage';

/** First screen: choose where the family's data is kept. */
export function StartPage() {
  const { googleAvailable, connect, chooseBrowserOnly, status } = useSync();
  const busy = status.kind === 'working';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 font-bold text-white">₹</span>
          <h1 className="text-2xl font-semibold tracking-tight">Family Wealth Calculator</h1>
        </div>
        <p className="mt-3 text-slate-600 dark:text-slate-300">Where should your family’s data be kept?</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="flex min-w-0 flex-col">
            <h2 className="font-semibold">In my Google Sheet</h2>
            <ul className="mt-2 flex-1 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
              <li>Saved to a spreadsheet in your own Google Drive.</li>
              <li>Use it from any device by signing in with the same Google account.</li>
              <li>The app can open only the spreadsheet it creates, nothing else in your Drive.</li>
              <li>Your data goes only between this browser and Google. Nobody else, including the app’s developer, receives it.</li>
            </ul>
            <Button className="mt-4" onClick={() => void connect()} disabled={!googleAvailable || busy}>
              Connect Google Sheet
            </Button>
            {!googleAvailable && (
              <p className="mt-2 text-xs text-slate-500">Google sign-in is not set up for this copy of the app (no Google Client ID).</p>
            )}
          </Card>

          <Card className="flex min-w-0 flex-col">
            <h2 className="font-semibold">In this browser only</h2>
            <ul className="mt-2 flex-1 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
              <li>Stored on this device only. Nothing is sent anywhere.</li>
              <li>Other devices and browsers start empty.</li>
              <li>Clearing browser data deletes it, so download backups regularly.</li>
            </ul>
            <Button variant="secondary" className="mt-4" onClick={chooseBrowserOnly} disabled={busy}>
              Use in this browser only
            </Button>
          </Card>
        </div>

        <SyncStatusMessage className="mt-4" />
        <p className="mt-4 text-xs text-slate-500">You can switch later on the Backup &amp; data page.</p>
        <div className="mt-8">
          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
