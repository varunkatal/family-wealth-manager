import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { FormField, inputClass } from '../../components/FormField';
import {
  EXPENSE_CATEGORIES,
  expenseInputSchema,
  INCOME_TYPES,
  incomeInputSchema,
  type Expense,
  type ExpenseInput,
  type Income,
  type IncomeInput,
} from '../../models/cashFlow';
import type { FamilyMember } from '../../models/familyMember';
import { FREQUENCIES, FREQUENCY_LABELS } from '../../services/finance/sip';
import { parseAmountInput } from '../../utils/currency';
import { amountHint, fieldErrors, numberText, parsePercent } from '../../utils/formInput';

type Values = {
  memberId: string;
  kindValue: string;
  description: string;
  amount: string;
  frequency: string;
  growthRate: string;
  startDate: string;
  endDate: string;
  notes: string;
};

type Props =
  | { kind: 'income'; item?: Income; members: FamilyMember[]; onSubmit: (input: IncomeInput) => Promise<void>; onCancel: () => void }
  | { kind: 'expense'; item?: Expense; members: FamilyMember[]; onSubmit: (input: ExpenseInput) => Promise<void>; onCancel: () => void };

/** Add/edit form for an income or an expense; they share most fields. */
export function CashFlowItemForm(props: Props) {
  const { kind, members, onCancel } = props;
  const isIncome = kind === 'income';
  const item = props.item;
  const active = members.filter((m) => m.isActive);
  const [values, setValues] = useState<Values>(() => ({
    memberId: item?.memberId ?? (isIncome && active.length === 1 ? active[0]!.id : ''),
    kindValue: item ? (isIncome ? (item as Income).type : (item as Expense).category) : '',
    description: item?.description ?? '',
    amount: numberText(item?.amount),
    frequency: item?.frequency ?? 'monthly',
    growthRate: isIncome ? numberText((item as Income | undefined)?.growthRate) : '',
    startDate: item?.startDate ?? '',
    endDate: item?.endDate ?? '',
    notes: item?.notes ?? '',
  }));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = (key: keyof Values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[key === 'kindValue' ? (isIncome ? 'type' : 'category') : key];
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const shared = {
      memberId: values.memberId,
      description: values.description,
      amount: parseAmountInput(values.amount),
      frequency: values.frequency,
      startDate: values.startDate,
      endDate: values.endDate,
      notes: values.notes,
    };
    const input = isIncome
      ? { ...shared, type: values.kindValue, growthRate: parsePercent(values.growthRate) }
      : { ...shared, category: values.kindValue };
    const parsed = (isIncome ? incomeInputSchema : expenseInputSchema).safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors<string>(parsed.error.issues));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (props.kind === 'income') await props.onSubmit(input as IncomeInput);
      else await props.onSubmit(input as ExpenseInput);
    } catch {
      setSaveError('Could not save. Please try again.');
      setSaving(false);
    }
  };

  if (isIncome && members.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Every income belongs to a family member.{' '}
        <Link to="/family" className="font-medium underline">
          Add a family member
        </Link>{' '}
        first.
      </p>
    );
  }

  const prefix = kind;
  const kindKey = isIncome ? 'type' : 'category';
  const field = (key: string, id: string) => ({ id, 'aria-invalid': !!errors[key], className: inputClass });
  const memberOptions = members.filter((m) => m.isActive || m.id === values.memberId);

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${prefix}-kind`} label={isIncome ? 'Income type' : 'Category'} required error={errors[kindKey]}>
          <select {...field(kindKey, `${prefix}-kind`)} value={values.kindValue} onChange={(e) => set('kindValue', e.target.value)} autoFocus>
            <option value="">Choose…</option>
            {(isIncome ? INCOME_TYPES : EXPENSE_CATEGORIES).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          id={`${prefix}-member`}
          label={isIncome ? 'Earned by' : 'For'}
          required={isIncome}
          error={errors.memberId}
          hint={isIncome ? undefined : 'Optional: blank means the whole family'}
        >
          <select {...field('memberId', `${prefix}-member`)} value={values.memberId} onChange={(e) => set('memberId', e.target.value)}>
            <option value="">{isIncome ? 'Choose member…' : 'Whole family'}</option>
            {memberOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField id={`${prefix}-description`} label="Description" hint="Optional" error={errors.description}>
        <input
          {...field('description', `${prefix}-description`)}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder={isIncome ? 'e.g. Salary from Example Ltd' : 'e.g. Monthly groceries'}
          maxLength={120}
          autoComplete="off"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${prefix}-amount`} label="Amount (₹)" required error={errors.amount} hint={amountHint(values.amount)}>
          <input {...field('amount', `${prefix}-amount`)} inputMode="decimal" value={values.amount} onChange={(e) => set('amount', e.target.value)} />
        </FormField>
        <FormField id={`${prefix}-frequency`} label="How often" required error={errors.frequency}>
          <select {...field('frequency', `${prefix}-frequency`)} value={values.frequency} onChange={(e) => set('frequency', e.target.value)}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className={`grid gap-4 ${isIncome ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {isIncome && (
          <FormField id="income-growth" label="Growth (% a year)" error={errors.growthRate} hint="Optional, e.g. increments">
            <input {...field('growthRate', 'income-growth')} inputMode="decimal" value={values.growthRate} onChange={(e) => set('growthRate', e.target.value)} />
          </FormField>
        )}
        <FormField id={`${prefix}-start`} label="Start date" error={errors.startDate} hint="Optional">
          <input {...field('startDate', `${prefix}-start`)} type="date" value={values.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </FormField>
        <FormField id={`${prefix}-end`} label="End date" error={errors.endDate} hint="Optional">
          <input {...field('endDate', `${prefix}-end`)} type="date" value={values.endDate} onChange={(e) => set('endDate', e.target.value)} />
        </FormField>
      </div>

      <FormField id={`${prefix}-notes`} label="Notes" hint="Optional" error={errors.notes}>
        <textarea {...field('notes', `${prefix}-notes`)} rows={2} value={values.notes} onChange={(e) => set('notes', e.target.value)} maxLength={1000} />
      </FormField>

      {!isIncome && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Only money spent. SIPs and other investments go on the Investments page, and loan EMIs on the Liabilities page.
        </p>
      )}

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
          {item ? 'Save changes' : isIncome ? 'Add income' : 'Add expense'}
        </Button>
      </div>
    </form>
  );
}
