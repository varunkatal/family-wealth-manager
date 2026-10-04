import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { FormField, inputClass } from '../../components/FormField';
import { manualSnapshotInputSchema, manualValuationInputSchema, type ManualSnapshotInput, type ManualValuationInput } from '../../models/history';
import { parseAmountInput } from '../../utils/currency';
import { amountHint, fieldErrors } from '../../utils/formInput';

type Schema = { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } };

/** Shared form behaviour: validate, show errors, save, report failures. */
function useSimpleForm<V extends Record<string, string>>(initial: V, schema: Schema, toInput: (v: V) => unknown, onSubmit: (input: never) => Promise<void>) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const set = (key: keyof V, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const input = toInput(values);
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors<string>(parsed.error!.issues));
      return;
    }
    setSaving(true);
    try {
      await onSubmit(input as never);
    } catch {
      setSaveError('Could not save. Please try again.');
      setSaving(false);
    }
  };
  return { values, errors, saving, saveError, set, submit };
}

function Actions({ saving, saveError, onCancel, label }: { saving: boolean; saveError: string | null; onCancel: () => void; label: string }) {
  return (
    <>
      {saveError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {saveError}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {label}
        </Button>
      </div>
    </>
  );
}

const Input = ({ id, error, ...props }: { id: string; error?: string } & InputHTMLAttributes<HTMLInputElement>): ReactNode => (
  <input id={id} className={inputClass} aria-invalid={!!error} {...props} />
);

export function ManualSnapshotForm({ onSubmit, onCancel }: { onSubmit: (input: ManualSnapshotInput) => Promise<void>; onCancel: () => void }) {
  const f = useSimpleForm(
    { date: '', totalAssets: '', totalLiabilities: '', notes: '' },
    manualSnapshotInputSchema,
    (v) => ({ date: v.date, totalAssets: parseAmountInput(v.totalAssets), totalLiabilities: parseAmountInput(v.totalLiabilities) ?? 0, notes: v.notes }),
    onSubmit,
  );
  return (
    <form onSubmit={(e) => void f.submit(e)} noValidate className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">Record your family's totals on a past date, e.g. from old statements.</p>
      <FormField id="snapshot-date" label="Date" required error={f.errors.date}>
        <Input id="snapshot-date" type="date" value={f.values.date} onChange={(e) => f.set('date', e.target.value)} error={f.errors.date} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="snapshot-assets" label="Total assets (₹)" required error={f.errors.totalAssets} hint={amountHint(f.values.totalAssets)}>
          <Input id="snapshot-assets" inputMode="decimal" value={f.values.totalAssets} onChange={(e) => f.set('totalAssets', e.target.value)} error={f.errors.totalAssets} />
        </FormField>
        <FormField id="snapshot-liabilities" label="Total liabilities (₹)" error={f.errors.totalLiabilities} hint={amountHint(f.values.totalLiabilities) ?? 'Blank means none'}>
          <Input id="snapshot-liabilities" inputMode="decimal" value={f.values.totalLiabilities} onChange={(e) => f.set('totalLiabilities', e.target.value)} error={f.errors.totalLiabilities} />
        </FormField>
      </div>
      <FormField id="snapshot-notes" label="Notes" hint="Optional" error={f.errors.notes}>
        <Input id="snapshot-notes" value={f.values.notes} onChange={(e) => f.set('notes', e.target.value)} maxLength={500} />
      </FormField>
      <Actions saving={f.saving} saveError={f.saveError} onCancel={onCancel} label="Add snapshot" />
    </form>
  );
}

export function ManualValuationForm({ onSubmit, onCancel }: { onSubmit: (input: ManualValuationInput) => Promise<void>; onCancel: () => void }) {
  const f = useSimpleForm(
    { date: '', value: '', notes: '' },
    manualValuationInputSchema,
    (v) => ({ date: v.date, value: parseAmountInput(v.value), notes: v.notes }),
    onSubmit,
  );
  return (
    <form onSubmit={(e) => void f.submit(e)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="valuation-date" label="Date" required error={f.errors.date}>
          <Input id="valuation-date" type="date" value={f.values.date} onChange={(e) => f.set('date', e.target.value)} error={f.errors.date} />
        </FormField>
        <FormField id="valuation-value" label="Value (₹)" required error={f.errors.value} hint={amountHint(f.values.value)}>
          <Input id="valuation-value" inputMode="decimal" value={f.values.value} onChange={(e) => f.set('value', e.target.value)} error={f.errors.value} />
        </FormField>
      </div>
      <FormField id="valuation-notes" label="Notes" hint="Optional, e.g. where the value came from" error={f.errors.notes}>
        <Input id="valuation-notes" value={f.values.notes} onChange={(e) => f.set('notes', e.target.value)} maxLength={500} />
      </FormField>
      <p className="text-xs text-slate-500 dark:text-slate-400">This adds to the asset's history only; its current value is not changed.</p>
      <Actions saving={f.saving} saveError={f.saveError} onCancel={onCancel} label="Add value" />
    </form>
  );
}
