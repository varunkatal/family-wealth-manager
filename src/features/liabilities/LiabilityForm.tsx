import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { FormField, inputClass } from '../../components/FormField';
import type { FamilyMember } from '../../models/familyMember';
import { LIABILITY_TYPES, liabilityInputSchema, type Liability, type LiabilityInput } from '../../models/liability';
import { formatINRCompact, formatINRExact, parseAmountInput } from '../../utils/currency';

type FormValues = { name: string; type: string; ownerId: string; currentOutstanding: string; notes: string };
type ErrorKey = keyof LiabilityInput;

function toFormValues(liability: Liability | undefined, members: FamilyMember[]): FormValues {
  const active = members.filter((m) => m.isActive);
  return {
    name: liability?.name ?? '',
    type: liability?.type ?? '',
    ownerId: liability?.ownerId ?? (active.length === 1 ? active[0]!.id : ''),
    currentOutstanding: liability ? String(liability.currentOutstanding) : '',
    notes: liability?.notes ?? '',
  };
}

type LiabilityFormProps = {
  liability?: Liability;
  members: FamilyMember[];
  onSubmit: (input: LiabilityInput) => Promise<void>;
  onCancel: () => void;
};

export function LiabilityForm({ liability, members, onSubmit, onCancel }: LiabilityFormProps) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(liability, members));
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = (key: keyof FormValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const ownerOptions = members.filter((m) => m.isActive || m.id === values.ownerId);
  const amount = parseAmountInput(values.currentOutstanding);
  const amountHint =
    amount === undefined || Number.isNaN(amount)
      ? undefined
      : amount >= 1e5
        ? `${formatINRExact(amount)} · ${formatINRCompact(amount)}`
        : formatINRExact(amount);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const input = {
      name: values.name,
      type: values.type,
      ownerId: values.ownerId,
      currentOutstanding: amount,
      notes: values.notes,
    } as LiabilityInput;
    const parsed = liabilityInputSchema.safeParse(input);
    if (!parsed.success) {
      const next: Partial<Record<ErrorKey, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as ErrorKey] ??= issue.message;
      setErrors(next);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit(input);
    } catch {
      setSaveError('Could not save. Please try again.');
      setSaving(false);
    }
  };

  if (members.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Every liability needs an owner.{' '}
        <Link to="/family" className="font-medium underline">
          Add a family member
        </Link>{' '}
        first.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
      <FormField id="liability-name" label="Name" required error={errors.name}>
        <input
          id="liability-name"
          className={inputClass}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Home loan with Example Bank"
          autoFocus
          autoComplete="off"
          maxLength={120}
          aria-invalid={!!errors.name}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="liability-type" label="Type" required error={errors.type}>
          <select
            id="liability-type"
            className={inputClass}
            value={values.type}
            onChange={(e) => set('type', e.target.value)}
            aria-invalid={!!errors.type}
          >
            <option value="">Choose…</option>
            {LIABILITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="liability-owner" label="Owed by" required error={errors.ownerId}>
          <select
            id="liability-owner"
            className={inputClass}
            value={values.ownerId}
            onChange={(e) => set('ownerId', e.target.value)}
            aria-invalid={!!errors.ownerId}
          >
            <option value="">Choose member…</option>
            {ownerOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField
        id="liability-outstanding"
        label="Outstanding amount (₹)"
        required
        error={errors.currentOutstanding}
        hint={amountHint ?? 'What is still owed today'}
      >
        <input
          id="liability-outstanding"
          inputMode="decimal"
          className={inputClass}
          value={values.currentOutstanding}
          onChange={(e) => set('currentOutstanding', e.target.value)}
          aria-invalid={!!errors.currentOutstanding}
        />
      </FormField>

      <FormField id="liability-notes" label="Notes" hint="Optional" error={errors.notes}>
        <textarea
          id="liability-notes"
          rows={2}
          className={inputClass}
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          maxLength={1000}
        />
      </FormField>

      <p className="text-xs text-slate-500 dark:text-slate-400">Interest rate, EMI and repayment schedule come in a later update.</p>

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
          {liability ? 'Save changes' : 'Add liability'}
        </Button>
      </div>
    </form>
  );
}
