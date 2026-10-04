import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { FormField, inputClass } from '../../components/FormField';
import type { Asset } from '../../models/asset';
import { contributionInputSchema, type Contribution, type ContributionInput } from '../../models/contribution';
import type { FamilyMember } from '../../models/familyMember';
import { FREQUENCIES, FREQUENCY_LABELS } from '../../services/finance/sip';
import { parseAmountInput } from '../../utils/currency';
import { todayISODate } from '../../utils/date';
import { amountHint, fieldErrors, numberText, parsePercent } from '../../utils/formInput';

type FormValues = {
  name: string;
  ownerId: string;
  linkedAssetId: string;
  amount: string;
  frequency: string;
  startDate: string;
  endDate: string;
  expectedReturn: string;
  annualIncrease: string;
  notes: string;
};
type ErrorKey = keyof ContributionInput;

function toFormValues(c: Contribution | undefined, members: FamilyMember[]): FormValues {
  const active = members.filter((m) => m.isActive);
  return {
    name: c?.name ?? '',
    ownerId: c?.ownerId ?? (active.length === 1 ? active[0]!.id : ''),
    linkedAssetId: c?.linkedAssetId ?? '',
    amount: numberText(c?.amount),
    frequency: c?.frequency ?? 'monthly',
    startDate: c?.startDate ?? todayISODate(),
    endDate: c?.endDate ?? '',
    expectedReturn: numberText(c?.expectedReturn),
    annualIncrease: numberText(c?.annualIncrease),
    notes: c?.notes ?? '',
  };
}

type ContributionFormProps = {
  contribution?: Contribution;
  members: FamilyMember[];
  assets: Asset[];
  onSubmit: (input: ContributionInput) => Promise<void>;
  onCancel: () => void;
};

export function ContributionForm({ contribution, members, assets, onSubmit, onCancel }: ContributionFormProps) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(contribution, members));
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
  const linkedAsset = assets.find((a) => a.id === values.linkedAssetId);
  const returnHint =
    linkedAsset?.baseGrowthRate !== undefined
      ? `Blank: uses ${linkedAsset.name}'s Base rate (${linkedAsset.baseGrowthRate}%)`
      : linkedAsset
        ? `Blank: ${linkedAsset.name} has no Base rate, so contributions are added without growth`
        : 'Blank: added without growth unless linked to an asset with a rate';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const input = {
      name: values.name,
      ownerId: values.ownerId,
      linkedAssetId: values.linkedAssetId,
      amount: parseAmountInput(values.amount),
      frequency: values.frequency,
      startDate: values.startDate,
      endDate: values.endDate,
      expectedReturn: parsePercent(values.expectedReturn),
      annualIncrease: parsePercent(values.annualIncrease),
      notes: values.notes,
    } as ContributionInput;
    const parsed = contributionInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors<ErrorKey>(parsed.error.issues));
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
        Every regular investment needs an owner.{' '}
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
      <FormField id="contribution-name" label="Name" required error={errors.name}>
        <input
          {...field('name', 'contribution-name')}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Example Equity Fund SIP"
          autoFocus
          autoComplete="off"
          maxLength={120}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="contribution-owner" label="Invested by" required error={errors.ownerId}>
          <select {...field('ownerId', 'contribution-owner')} value={values.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
            <option value="">Choose member…</option>
            {ownerOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="contribution-asset" label="Linked asset" hint="Optional: the asset this money goes into" error={errors.linkedAssetId}>
          <select
            {...field('linkedAssetId', 'contribution-asset')}
            value={values.linkedAssetId}
            onChange={(e) => set('linkedAssetId', e.target.value)}
          >
            <option value="">None</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="contribution-amount" label="Amount (₹)" required error={errors.amount} hint={amountHint(values.amount) ?? 'Per contribution'}>
          <input {...field('amount', 'contribution-amount')} inputMode="decimal" value={values.amount} onChange={(e) => set('amount', e.target.value)} />
        </FormField>

        <FormField id="contribution-frequency" label="Frequency" required error={errors.frequency}>
          <select {...field('frequency', 'contribution-frequency')} value={values.frequency} onChange={(e) => set('frequency', e.target.value)}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="contribution-start" label="Start date" required error={errors.startDate} hint="Date of the first contribution">
          <input {...field('startDate', 'contribution-start')} type="date" value={values.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </FormField>
        <FormField id="contribution-end" label="End date" error={errors.endDate} hint="Optional: blank means it continues">
          <input {...field('endDate', 'contribution-end')} type="date" value={values.endDate} onChange={(e) => set('endDate', e.target.value)} />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="contribution-return" label="Expected return (% a year)" error={errors.expectedReturn} hint={returnHint}>
          <input
            {...field('expectedReturn', 'contribution-return')}
            inputMode="decimal"
            value={values.expectedReturn}
            onChange={(e) => set('expectedReturn', e.target.value)}
          />
        </FormField>
        <FormField
          id="contribution-increase"
          label="Annual increase (%)"
          error={errors.annualIncrease}
          hint="Optional step-up: the amount rises by this % every 12 months"
        >
          <input
            {...field('annualIncrease', 'contribution-increase')}
            inputMode="decimal"
            value={values.annualIncrease}
            onChange={(e) => set('annualIncrease', e.target.value)}
          />
        </FormField>
      </div>

      <FormField id="contribution-notes" label="Notes" hint="Optional" error={errors.notes}>
        <textarea
          {...field('notes', 'contribution-notes')}
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
          {contribution ? 'Save changes' : 'Add investment'}
        </Button>
      </div>
    </form>
  );
}
