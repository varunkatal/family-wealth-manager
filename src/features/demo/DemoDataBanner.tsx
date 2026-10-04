import { useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { clearDemoData, type ClearDemoResult } from '../../services/storage/demoRepository';

type DemoDataBannerProps = {
  /** Number of demo records (members, assets, liabilities) currently stored. */
  demoCount: number;
  /** Runs the clear through the page's data hook so the page reloads afterwards. */
  run: <T>(action: () => Promise<T>) => Promise<T>;
};

/** Shown whenever demo data exists, so it can never be mistaken for real figures. */
export function DemoDataBanner({ demoCount, run }: DemoDataBannerProps) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (demoCount === 0 && !result) return null;

  const describe = (r: ClearDemoResult) =>
    r.keptMembers.length > 0
      ? `Demo data cleared. Kept ${r.keptMembers.join(', ')} as a regular family member${r.keptMembers.length === 1 ? '' : 's'}, because they own some of your own assets or liabilities.`
      : 'Demo data cleared.';

  return (
    <>
      {result && (
        <p role="status" className="mb-4 rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {result}
        </p>
      )}
      {demoCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span>Demo data is loaded. Items marked DEMO are fake and only for trying the app.</span>
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Clear demo data
          </Button>
        </div>
      )}
      {confirming && (
        <ConfirmDialog
          title="Clear demo data?"
          message={
            <p>
              All demo family members, assets and liabilities will be removed. Anything you entered yourself is not
              affected.
            </p>
          }
          confirmLabel="Clear demo data"
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            try {
              setResult(describe(await run(clearDemoData)));
            } catch {
              setResult('Could not clear demo data.');
            }
            setConfirming(false);
          }}
        />
      )}
    </>
  );
}
