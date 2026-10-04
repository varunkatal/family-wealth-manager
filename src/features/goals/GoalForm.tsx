import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { FormField, inputClass } from '../../components/FormField';
import type { FamilyMember } from '../../models/familyMember';
import { GOAL_PRIORITIES, GOAL_TYPES, goalInputSchema, PRIORITY_LABELS, type Goal, type GoalInput } from '../../models/goal';
import { calculateRequiredMonthlyContribution, monthsUntil } from '../../services/finance/goals';
import { formatINRExact, parseAmountInput } from '../../utils/currency';
import { todayISODate } from '../../utils/date';
import { amountHint, fieldErrors, numberText, parsePercent } from '../../utils/formInput';

type Values = {
  name: string;
  type: string;
  targetAmount: string;
  savedAmount: string;
  targetDate: string;
  ownerId: string;
  priority: string;
  expectedReturn: string;
  notes: string;
};
type ErrorKey = keyof GoalInput;

function toInput(v: Values): GoalInput {
  return {
    name: v.name,
    type: v.type,
    targetAmount: parseAmountInput(v.targetAmount),
    savedAmount: parseAmountInput(v.savedAmount) ?? 0,
    targetDate: v.targetDate,
    ownerId: v.ownerId,
    priority: v.priority,
    expectedReturn: parsePercent(v.expectedReturn),
    notes: v.notes,
  } as GoalInput;
}

type GoalFormProps = {
  goal?: Goal;
  members: FamilyMember[];
  onSubmit: (input: GoalInput) => Promise<void>;
  onCancel: () => void;
};

export function GoalForm({ goal, members, onSubmit, onCancel }: GoalFormProps) {
  const [values, setValues] = useState<Values>(() => ({
    name: goal?.name ?? '',
    type: goal?.type ?? '',
    targetAmount: numberText(goal?.targetAmount),
    savedAmount: numberText(goal?.savedAmount),
    targetDate: goal?.targetDate ?? '',
    ownerId: goal?.ownerId ?? '',
    priority: goal?.priority ?? 'medium',
    expectedReturn: numberText(goal?.expectedReturn),
    notes: goal?.notes ?? '',
  }));
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = (key: keyof Values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const parsed = goalInputSchema.safeParse(toInput(values));
  const months = parsed.success ? monthsUntil(todayISODate(), parsed.data.targetDate) : null;
  const required =
    parsed.success && months !== null
      ? calculateRequiredMonthlyContribution(parsed.data.targetAmount, parsed.data.savedAmount, parsed.data.expectedReturn ?? 0, months)
      : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const input = toInput(values);
    const result = goalInputSchema.safeParse(input);
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

  const field = (key: ErrorKey, id: string) => ({ id, 'aria-invalid': !!errors[key], className: inputClass });
  const ownerOptions = members.filter((m) => m.isActive || m.id === values.ownerId);

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
      <FormField id="goal-name" label="Name" required error={errors.name}>
        <input
          {...field('name', 'goal-name')}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Example car in 2030"
          autoFocus
          autoComplete="off"
          maxLength={120}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="goal-type" label="Goal type" required error={errors.type}>
          <select {...field('type', 'goal-type')} value={values.type} onChange={(e) => set('type', e.target.value)}>
            <option value="">Choose…</option>
            {GOAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="goal-owner" label="For" hint="Optional: blank means the family" error={errors.ownerId}>
          <select {...field('ownerId', 'goal-owner')} value={values.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
            <option value="">Whole family</option>
            {ownerOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="goal-priority" label="Priority" required error={errors.priority}>
          <select {...field('priority', 'goal-priority')} value={values.priority} onChange={(e) => set('priority', e.target.value)}>
            {GOAL_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="goal-target" label="Target amount (₹)" required error={errors.targetAmount} hint={amountHint(values.targetAmount)}>
          <input {...field('targetAmount', 'goal-target')} inputMode="decimal" value={values.targetAmount} onChange={(e) => set('targetAmount', e.target.value)} />
        </FormField>
        <FormField
          id="goal-saved"
          label="Saved so far (₹)"
          error={errors.savedAmount}
          hint={amountHint(values.savedAmount) ?? 'Blank means nothing saved yet'}
        >
          <input {...field('savedAmount', 'goal-saved')} inputMode="decimal" value={values.savedAmount} onChange={(e) => set('savedAmount', e.target.value)} />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="goal-date" label="Target date" required error={errors.targetDate}>
          <input {...field('targetDate', 'goal-date')} type="date" value={values.targetDate} onChange={(e) => set('targetDate', e.target.value)} />
        </FormField>
        <FormField
          id="goal-return"
          label="Expected return (% a year)"
          error={errors.expectedReturn}
          hint="Optional: on money saved for this goal. Blank means 0%"
        >
          <input {...field('expectedReturn', 'goal-return')} inputMode="decimal" value={values.expectedReturn} onChange={(e) => set('expectedReturn', e.target.value)} />
        </FormField>
      </div>

      {required !== undefined && (
        <p data-testid="goal-preview" className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900 dark:bg-teal-950 dark:text-teal-100">
          {required === null
            ? 'The target date has passed, so no monthly amount can reach it.'
            : required === 0
              ? 'Already on track: no monthly saving needed.'
              : `Save ${formatINRExact(required)} a month for ${months} months to reach this goal.`}
        </p>
      )}

      <FormField id="goal-notes" label="Notes" hint="Optional" error={errors.notes}>
        <textarea {...field('notes', 'goal-notes')} rows={2} value={values.notes} onChange={(e) => set('notes', e.target.value)} maxLength={1000} />
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
          {goal ? 'Save changes' : 'Add goal'}
        </Button>
      </div>
    </form>
  );
}
