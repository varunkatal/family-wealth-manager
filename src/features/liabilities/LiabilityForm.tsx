import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { FormField, inputClass } from '../../components/FormField';
import type { FamilyMember } from '../../models/familyMember';
import { LIABILITY_TYPES, liabilityInputSchema, type Liability, type LiabilityInput } from '../../models/liability';
import { analyseLoan, debtFreeMonth } from '../../services/finance/loans';
import { formatINRExact, parseAmountInput } from '../../utils/currency';
import { formatMonth, todayISODate } from '../../utils/date';
import { amountHint, fieldErrors, numberText, parsePercent } from '../../utils/formInput';

type FormValues = {
  name: string;
  type: string;
  ownerId: string;
  originalAmount: string;
  currentOutstanding: string;
  interestRate: string;
  monthlyEMI: string;
  remainingMonths: string;
  startDate: string;
  notes: string;
};
type ErrorKey = keyof LiabilityInput;

function toFormValues(liability: Liability | undefined, members: FamilyMember[]): FormValues {
  const active = members.filter((m) => m.isActive);
  return {
    name: liability?.name ?? '',
    type: liability?.type ?? '',
    ownerId: liability?.ownerId ?? (active.length === 1 ? active[0]!.id : ''),
    originalAmount: numberText(liability?.originalAmount),
    currentOutstanding: numberText(liability?.currentOutstanding),
    interestRate: numberText(liability?.interestRate),
    monthlyEMI: numberText(liability?.monthlyEMI),
    remainingMonths: numberText(liability?.remainingMonths),
    startDate: liability?.startDate ?? '',
    notes: liability?.notes ?? '',
  };
}

const parseCount = (text: string) => (text.trim() === '' ? undefined : Number(text.trim()));

function toInput(v: FormValues): LiabilityInput {
  return {
    name: v.name,
    type: v.type,
    ownerId: v.ownerId,
    originalAmount: parseAmountInput(v.originalAmount),
    currentOutstanding: parseAmountInput(v.currentOutstanding),
    interestRate: parsePercent(v.interestRate),
    monthlyEMI: parseAmountInput(v.monthlyEMI),
    remainingMonths: parseCount(v.remainingMonths),
    startDate: v.startDate,
    notes: v.notes,
  } as LiabilityInput;
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

  // Live preview of the repayment plan, only once the entered values are valid.
  const parsed = liabilityInputSchema.safeParse(toInput(values));
  const preview = parsed.success ? analyseLoan(parsed.data) : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const input = toInput(values);
    const result = liabilityInputSchema.safeParse(input);
    if (!result.success) {
      setErrors(fieldErrors<ErrorKey>(result.error.issues));
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

  const field = (key: ErrorKey, id: string) => ({ id, 'aria-invalid': !!errors[key], className: inputClass });

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
      <FormField id="liability-name" label="Name" required error={errors.name}>
        <input
          {...field('name', 'liability-name')}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Home loan with Example Bank"
          autoFocus
          autoComplete="off"
          maxLength={120}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="liability-type" label="Type" required error={errors.type}>
          <select {...field('type', 'liability-type')} value={values.type} onChange={(e) => set('type', e.target.value)}>
            <option value="">Choose…</option>
            {LIABILITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="liability-owner" label="Owed by" required error={errors.ownerId}>
          <select {...field('ownerId', 'liability-owner')} value={values.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="liability-outstanding"
          label="Outstanding amount (₹)"
          required
          error={errors.currentOutstanding}
          hint={amountHint(values.currentOutstanding) ?? 'What is still owed today'}
        >
          <input
            {...field('currentOutstanding', 'liability-outstanding')}
            inputMode="decimal"
            value={values.currentOutstanding}
            onChange={(e) => set('currentOutstanding', e.target.value)}
          />
        </FormField>
        <FormField
          id="liability-original"
          label="Original amount (₹)"
          error={errors.originalAmount}
          hint={amountHint(values.originalAmount) ?? 'Optional: the amount borrowed'}
        >
          <input
            {...field('originalAmount', 'liability-original')}
            inputMode="decimal"
            value={values.originalAmount}
            onChange={(e) => set('originalAmount', e.target.value)}
          />
        </FormField>
      </div>

      <fieldset className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <legend className="px-1 text-sm font-medium text-slate-700 dark:text-slate-200">Repayment</legend>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Optional. Add the interest rate and either the EMI or the months left to see the repayment schedule.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="liability-rate" label="Interest rate (% a year)" error={errors.interestRate}>
            <input
              {...field('interestRate', 'liability-rate')}
              inputMode="decimal"
              value={values.interestRate}
              onChange={(e) => set('interestRate', e.target.value)}
            />
          </FormField>
          <FormField id="liability-emi" label="Monthly EMI (₹)" error={errors.monthlyEMI} hint={amountHint(values.monthlyEMI)}>
            <input
              {...field('monthlyEMI', 'liability-emi')}
              inputMode="decimal"
              value={values.monthlyEMI}
              onChange={(e) => set('monthlyEMI', e.target.value)}
            />
          </FormField>
          <FormField
            id="liability-months"
            label="Remaining months"
            error={errors.remainingMonths}
            hint="Used to work out the EMI when it is left blank"
          >
            <input
              {...field('remainingMonths', 'liability-months')}
              inputMode="numeric"
              value={values.remainingMonths}
              onChange={(e) => set('remainingMonths', e.target.value)}
            />
          </FormField>
          <FormField id="liability-start" label="Start date" error={errors.startDate} hint="Optional">
            <input
              {...field('startDate', 'liability-start')}
              type="date"
              value={values.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </FormField>
        </div>
        {preview?.kind === 'schedule' && preview.months > 0 && (
          <p data-testid="loan-preview" className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900 dark:bg-teal-950 dark:text-teal-100">
            {preview.emiCalculated && <>EMI {formatINRExact(preview.emi)} · </>}
            Debt-free by {formatMonth(debtFreeMonth(preview.months, todayISODate()))} ({preview.months} months) · Total
            interest {formatINRExact(preview.totalInterest)}
          </p>
        )}
      </fieldset>

      <FormField id="liability-notes" label="Notes" hint="Optional" error={errors.notes}>
        <textarea
          {...field('notes', 'liability-notes')}
          rows={2}
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          maxLength={1000}
        />
      </FormField>

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
