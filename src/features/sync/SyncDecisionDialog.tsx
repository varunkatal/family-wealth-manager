import { useSync } from '../../app/SyncContext';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { STORE_LABELS, STORE_NAMES } from '../../services/storage/backupRepository';
import { totalRecords, type Counts } from '../../services/google/sheetSync';

function CountsTable({ columns }: { columns: { label: string; counts: Counts }[] }) {
  const rows = STORE_NAMES.filter((s) => columns.some((c) => c.counts[s] > 0));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1 pr-3 font-medium">Records</th>
            {columns.map((c) => (
              <th key={c.label} className="py-1 pl-3 text-right font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-1 pr-3">{STORE_LABELS[s]}</td>
              {columns.map((c) => (
                <td key={c.label} className="py-1 pl-3 text-right tabular-nums">
                  {c.counts[s]}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-slate-200 font-medium dark:border-slate-700">
            <td className="py-1 pr-3">Total</td>
            {columns.map((c) => (
              <td key={c.label} className="py-1 pl-3 text-right tabular-nums">
                {totalRecords(c.counts)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Asks which copy to keep when the Google Sheet and this browser hold different data. Nothing is changed until the user picks. */
export function SyncDecisionDialog() {
  const { decision, resolveDecision, status } = useSync();
  if (!decision) return null;
  const busy = status.kind === 'working';
  const cancel = () => void resolveDecision('cancel');

  if (decision.kind === 'ask-upload') {
    return (
      <Modal title="Save this browser’s data to Google Sheet?" onClose={cancel}>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your Google Sheet <strong>{decision.file.name}</strong> is empty. This browser has the data below. Save it to the sheet?
        </p>
        <div className="mt-4">
          <CountsTable columns={[{ label: 'This browser', counts: decision.local }]} />
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={cancel} disabled={busy} autoFocus>
            Cancel
          </Button>
          <Button onClick={() => void resolveDecision('use-browser')} disabled={busy}>
            Save to Google Sheet
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={decision.conflict ? 'Your Google Sheet was changed on another device' : 'Which data do you want to keep?'}
      onClose={cancel}
      role="alertdialog"
      size="lg"
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {decision.conflict ? (
          <>
            While you were making changes here, <strong>{decision.file.name}</strong> was saved from another device or browser.
            Saving has stopped so neither copy is lost. Choose one copy to keep; the other is replaced.
          </>
        ) : (
          <>
            Your Google Sheet <strong>{decision.file.name}</strong> and this browser hold different data. Choose one copy to keep;
            the other is replaced. Nothing changes until you choose.
          </>
        )}
      </p>
      <div className="mt-4">
        <CountsTable
          columns={[
            { label: 'Google Sheet', counts: decision.sheet },
            { label: 'This browser', counts: decision.local },
          ]}
        />
      </div>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
        Not sure? Cancel, then use <strong>Download backup</strong> on Backup &amp; data to keep a copy of this browser’s data first.
      </p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={cancel} disabled={busy} autoFocus>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => void resolveDecision('use-browser')} disabled={busy}>
          Keep this browser’s data (replace the sheet)
        </Button>
        <Button onClick={() => void resolveDecision('use-sheet')} disabled={busy}>
          Use the Google Sheet (replace this browser)
        </Button>
      </div>
    </Modal>
  );
}
