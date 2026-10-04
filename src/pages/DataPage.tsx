import { useEffect, useState, type ChangeEvent } from 'react';
import { useSettings } from '../app/SettingsContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { inputClass } from '../components/FormField';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { useWealthData } from '../hooks/useWealthData';
import { toCsv } from '../services/export/csv';
import { buildExportTables, CSV_TABLES } from '../services/export/tables';
import { buildXlsx } from '../services/export/xlsx';
import {
  countRecords,
  deleteAllData,
  exportBackup,
  parseBackup,
  restoreBackup,
  STORE_LABELS,
  type ParsedBackup,
} from '../services/storage/backupRepository';
import { isStoragePersistent, requestPersistentStorage } from '../services/storage/persistence';
import { downloadFile } from '../utils/download';
import { todayISODate } from '../utils/date';

type Preview = Extract<ParsedBackup, { ok: true }> & { fileName: string; currentTotal: number };
type Dialog = { kind: 'restore' } | { kind: 'delete-all' } | null;

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const total = (counts: Record<string, number>) => Object.values(counts).reduce((s, n) => s + n, 0);

export function DataPage() {
  const data = useWealthData();
  const { reload: reloadSettings } = useSettings();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const stamp = todayISODate();
  const [persistent, setPersistent] = useState<boolean | null>(null);
  useEffect(() => {
    void isStoragePersistent().then(setPersistent).catch(() => setPersistent(null));
  }, []);

  const tables = buildExportTables(data);
  const tableByKey = new Map(tables.map((t) => [t.key, t]));

  const downloadBackup = async () => {
    try {
      const backup = await exportBackup();
      downloadFile(`family-wealth-backup-${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json');
      setMessage('Backup downloaded. Keep it somewhere safe: it contains all your financial data.');
    } catch {
      setActionError('Could not create the backup.');
    }
  };

  const downloadCsv = (key: string) => {
    const t = tableByKey.get(key)!;
    // The byte-order mark lets Excel read ₹ and other characters correctly.
    downloadFile(`family-wealth-${key}-${stamp}.csv`, '﻿' + toCsv(t.columns.map((c) => c.header), t.rows), 'text/csv;charset=utf-8');
  };

  const downloadExcel = () => {
    downloadFile(`family-wealth-${stamp}.xlsx`, buildXlsx(tables.map((t) => ({ name: t.title, columns: t.columns, rows: t.rows }))), XLSX_TYPE);
  };

  const chooseFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    setPreview(null);
    setFileErrors([]);
    setMessage(null);
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      setFileErrors(parsed.errors);
      return;
    }
    setPreview({ ...parsed, fileName: file.name, currentTotal: total(await countRecords()) });
  };

  const restore = async () => {
    if (!preview) return;
    try {
      await data.run(() => restoreBackup(preview.backup));
      await reloadSettings();
      setMessage(`Restored ${total(preview.counts)} records from ${preview.fileName}.`);
      setActionError(null);
      setPreview(null);
    } catch {
      setActionError('Restore failed. Your existing data was not changed.');
    }
    setDialog(null);
  };

  const deleteEverything = async () => {
    try {
      await data.run(deleteAllData);
      await reloadSettings();
      setMessage('All data has been deleted from this browser.');
      setActionError(null);
    } catch {
      setActionError('Could not delete the data.');
    }
    setConfirmText('');
    setDialog(null);
  };

  return (
    <>
      <PageHeader title="Backup & data" description="Everything is stored only in this browser. Back it up, export it, or delete it." />

      {message && (
        <p role="status" className="mb-4 rounded-lg bg-teal-50 px-4 py-2 text-sm text-teal-900 dark:bg-teal-950 dark:text-teal-100">
          {message}
        </p>
      )}
      {(data.error || actionError) && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {data.error ?? actionError}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Backup</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            A complete copy of all your data and settings as a JSON file. Clearing browser data deletes everything in the app,
            so keep a recent backup.
          </p>
          <Button className="mt-4" onClick={() => void downloadBackup()}>
            Download backup
          </Button>
          {persistent !== null && (
            <p data-testid="storage-status" className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
              {persistent ? (
                'This browser will keep your data even when storage runs low.'
              ) : (
                <>
                  This browser may clear the app's data if storage runs low.{' '}
                  <button
                    type="button"
                    className="font-medium text-teal-700 underline dark:text-teal-400"
                    onClick={() => void requestPersistentStorage().then((granted) => setPersistent(granted ?? false))}
                  >
                    Ask the browser to keep it
                  </button>
                </>
              )}
            </p>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">Restore</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Load a backup file. You'll see what it contains before anything changes. Restoring replaces all current data; it
            never merges.
          </p>
          <label className="mt-4 block">
            <span className="sr-only">Backup file</span>
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Backup file"
              onChange={(e) => void chooseFile(e)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200"
            />
          </label>
          {fileErrors.length > 0 && (
            <div role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
              <p className="font-medium">This file can't be restored. Nothing was changed.</p>
              <ul className="mt-1 list-disc pl-5">
                {fileErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {preview && (
            <div className="mt-4 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
              <p className="font-medium">
                {preview.fileName}
                {preview.backup.exportedAt && (
                  <span className="font-normal text-slate-500 dark:text-slate-400"> · saved {new Date(preview.backup.exportedAt).toLocaleString('en-IN')}</span>
                )}
              </p>
              <table className="mt-2 w-full">
                <caption className="sr-only">Backup contents</caption>
                <tbody>
                  {Object.entries(preview.counts).map(([store, n]) => (
                    <tr key={store}>
                      <th scope="row" className="py-0.5 text-left font-normal text-slate-600 dark:text-slate-300">
                        {STORE_LABELS[store as keyof typeof STORE_LABELS]}
                      </th>
                      <td className="py-0.5 text-right tabular-nums">{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.currentTotal > 0 && (
                <p className="mt-3 rounded bg-amber-50 px-2 py-1.5 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  Your current {preview.currentTotal} records will be replaced. Download a backup first if you may need them.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="danger" onClick={() => setDialog({ kind: 'restore' })}>
                  Replace all data with this backup
                </Button>
                <Button variant="secondary" onClick={() => setPreview(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">Export</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Readable copies for spreadsheets. Exports can't be restored; use a backup for that.
          </p>
          <Button className="mt-4" onClick={downloadExcel}>
            Download Excel workbook
          </Button>
          <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">CSV files</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CSV_TABLES.map((key) => {
              const t = tableByKey.get(key)!;
              return (
                <Button key={key} variant="secondary" onClick={() => downloadCsv(key)} aria-label={`Download ${t.title} CSV`}>
                  {t.title} <span className="text-xs text-slate-500 dark:text-slate-400">({t.rows.length})</span>
                </Button>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-red-700 dark:text-red-400">Delete all data</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Permanently removes every family member, asset, loan, investment, goal, snapshot and setting from this browser.
          </p>
          <Button variant="danger" className="mt-4" onClick={() => setDialog({ kind: 'delete-all' })}>
            Delete all data…
          </Button>
        </Card>
      </div>

      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
        Importing from Excel is not supported yet. To move data between browsers, use Backup and Restore.
      </p>

      {dialog?.kind === 'restore' && preview && (
        <ConfirmDialog
          title="Replace all data?"
          message={
            <p>
              All current data will be deleted and replaced with the {total(preview.counts)} records in{' '}
              <strong className="text-slate-900 dark:text-slate-100">{preview.fileName}</strong>. This can't be undone.
            </p>
          }
          confirmLabel="Replace all data"
          onCancel={() => setDialog(null)}
          onConfirm={restore}
        />
      )}

      {dialog?.kind === 'delete-all' && (
        <Modal title="Delete all data?" onClose={() => setDialog(null)} role="alertdialog">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This permanently deletes everything stored by the app in this browser. It can't be undone. Download a backup first
            if you might need the data.
          </p>
          <label htmlFor="confirm-delete" className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Type DELETE to confirm
          </label>
          <input
            id="confirm-delete"
            className={`${inputClass} mt-1`}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
          />
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={confirmText !== 'DELETE'} onClick={() => void deleteEverything()}>
              Delete everything
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
