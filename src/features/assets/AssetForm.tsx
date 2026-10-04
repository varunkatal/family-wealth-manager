import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { FormField, inputClass } from '../../components/FormField';
import { SegmentedControl } from '../../components/SegmentedControl';
import {
  assetInputSchema,
  LIQUIDITY_OPTIONS,
  type Asset,
  type AssetInput,
  type Liquidity,
  type ValuationMethod,
} from '../../models/asset';
import { getAssetClassOptions, getSubcategoryOptions } from '../../models/assetCategories';
import type { FamilyMember } from '../../models/familyMember';
import type { AssetOwnership } from '../../models/ownership';
import { calculateQuantityValue } from '../../services/finance/assetValuation';
import { formatINRExact, parseAmountInput } from '../../utils/currency';
import { amountHint, numberText } from '../../utils/formInput';
import { todayISODate } from '../../utils/date';
import { defaultOwnerRows, OwnershipFields, parsePercent, type OwnerRow } from './OwnershipFields';

const CUSTOM = '__custom__';

type FormValues = {
  name: string;
  classChoice: string; // a listed class, CUSTOM, or ''
  customClass: string;
  subChoice: string; // a listed subcategory, CUSTOM, or ''
  customSub: string;
  institution: string;
  valuationMethod: ValuationMethod;
  currentValue: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  purchaseValue: string;
  valuationDate: string;
  conservativeGrowthRate: string;
  baseGrowthRate: string;
  optimisticGrowthRate: string;
  liquidity: Liquidity | '';
  notes: string;
};

type ErrorKey = keyof AssetInput;
type FieldErrors = Partial<Record<ErrorKey, string>>;


function toFormValues(asset?: Asset): FormValues {
  return {
    name: asset?.name ?? '',
    classChoice: asset?.assetClass ?? '',
    customClass: '',
    subChoice: asset?.subcategory ?? '',
    customSub: '',
    institution: asset?.institution ?? '',
    valuationMethod: asset?.valuationMethod ?? 'manual',
    currentValue: asset?.valuationMethod === 'manual' ? numberText(asset.currentValue) : '',
    quantity: numberText(asset?.quantity),
    unit: asset?.unit ?? '',
    unitPrice: numberText(asset?.unitPrice),
    purchaseValue: numberText(asset?.purchaseValue),
    valuationDate: asset?.valuationDate ?? todayISODate(),
    conservativeGrowthRate: numberText(asset?.conservativeGrowthRate),
    baseGrowthRate: numberText(asset?.baseGrowthRate),
    optimisticGrowthRate: numberText(asset?.optimisticGrowthRate),
    liquidity: asset?.liquidity ?? '',
    notes: asset?.notes ?? '',
  };
}

function toInput(v: FormValues, owners: OwnerRow[]): AssetInput {
  return {
    name: v.name,
    assetClass: v.classChoice === CUSTOM ? v.customClass : v.classChoice,
    subcategory: v.subChoice === CUSTOM ? v.customSub : v.subChoice,
    institution: v.institution,
    valuationMethod: v.valuationMethod,
    currentValue: parseAmountInput(v.currentValue),
    quantity: parseAmountInput(v.quantity),
    unit: v.unit,
    unitPrice: parseAmountInput(v.unitPrice),
    purchaseValue: parseAmountInput(v.purchaseValue),
    valuationDate: v.valuationDate,
    conservativeGrowthRate: parsePercent(v.conservativeGrowthRate),
    baseGrowthRate: parsePercent(v.baseGrowthRate),
    optimisticGrowthRate: parsePercent(v.optimisticGrowthRate),
    liquidity: v.liquidity as Liquidity,
    notes: v.notes,
    owners: owners.map((o) => ({ familyMemberId: o.memberId, percentage: parsePercent(o.percentage) as number })),
  };
}

const validAmount = (text: string) => {
  const n = parseAmountInput(text);
  return n === undefined || Number.isNaN(n) ? undefined : n;
};

type AssetFormProps = {
  asset?: Asset;
  existingAssets: Asset[];
  members: FamilyMember[];
  /** Ownership records of the asset being edited. */
  ownerships?: AssetOwnership[];
  onSubmit: (input: AssetInput) => Promise<void>;
  onCancel: () => void;
};

export function AssetForm({ asset, existingAssets, members, ownerships = [], onSubmit, onCancel }: AssetFormProps) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(asset));
  const [owners, setOwners] = useState<OwnerRow[]>(() =>
    ownerships.length > 0
      ? ownerships.map((o) => ({ memberId: o.familyMemberId, percentage: String(o.percentage) }))
      : defaultOwnerRows(members),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K], clears: ErrorKey[] = []) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of [key as ErrorKey, ...clears]) delete next[k];
      return next;
    });
  };

  const classOptions = getAssetClassOptions(existingAssets);
  const selectedClass = values.classChoice === CUSTOM ? values.customClass.trim() : values.classChoice;
  const subOptions = selectedClass ? getSubcategoryOptions(selectedClass, existingAssets) : [];

  const quantity = parseAmountInput(values.quantity);
  const unitPrice = parseAmountInput(values.unitPrice);
  const computedValue =
    quantity !== undefined && unitPrice !== undefined && !Number.isNaN(quantity) && !Number.isNaN(unitPrice)
      ? calculateQuantityValue(quantity, unitPrice)
      : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const input = toInput(values, owners);
    const parsed = assetInputSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as ErrorKey;
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
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

  const errorProps = (key: ErrorKey, id: string) => ({
    'aria-invalid': !!errors[key],
    'aria-describedby': errors[key] ? `${id}-error` : undefined,
  });

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-6">
      <Section title="Details">
        <FormField id="asset-name" label="Asset name" required error={errors.name}>
          <input
            id="asset-name"
            className={inputClass}
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            autoFocus
            autoComplete="off"
            maxLength={120}
            {...errorProps('name', 'asset-name')}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="asset-class" label="Asset class" required error={errors.assetClass}>
            <select
              id="asset-class"
              className={inputClass}
              value={values.classChoice}
              onChange={(e) => {
                // Subcategories belong to a class, so changing class resets the subcategory.
                set('classChoice', e.target.value, ['subcategory']);
                setValues((v) => ({ ...v, subChoice: '', customSub: '' }));
              }}
              {...errorProps('assetClass', 'asset-class')}
            >
              <option value="">Choose…</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={CUSTOM}>Custom…</option>
            </select>
            {values.classChoice === CUSTOM && (
              <input
                aria-label="Custom asset class"
                placeholder="e.g. Crypto"
                className={`${inputClass} mt-2`}
                value={values.customClass}
                onChange={(e) => set('customClass', e.target.value, ['assetClass'])}
                maxLength={50}
              />
            )}
          </FormField>

          <FormField id="asset-subcategory" label="Subcategory" error={errors.subcategory}>
            <select
              id="asset-subcategory"
              className={inputClass}
              value={values.subChoice}
              onChange={(e) => set('subChoice', e.target.value, ['subcategory'])}
              disabled={!selectedClass}
            >
              <option value="">{selectedClass ? 'None' : 'Choose a class first'}</option>
              {subOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {selectedClass && <option value={CUSTOM}>Custom…</option>}
            </select>
            {values.subChoice === CUSTOM && (
              <input
                aria-label="Custom subcategory"
                className={`${inputClass} mt-2`}
                value={values.customSub}
                onChange={(e) => set('customSub', e.target.value, ['subcategory'])}
                maxLength={50}
              />
            )}
          </FormField>
        </div>

        <FormField id="asset-institution" label="Institution" hint="Optional. Bank, AMC, broker, etc." error={errors.institution}>
          <input
            id="asset-institution"
            className={inputClass}
            value={values.institution}
            onChange={(e) => set('institution', e.target.value)}
            autoComplete="off"
            maxLength={100}
          />
        </FormField>
      </Section>

      <Section title="Valuation">
        <SegmentedControl
          name="valuationMethod"
          label="Valuation method"
          options={[
            { value: 'manual', label: 'Enter value' },
            { value: 'quantity_x_price', label: 'Quantity × price' },
          ]}
          value={values.valuationMethod}
          onChange={(m) => set('valuationMethod', m, ['currentValue', 'quantity', 'unitPrice'])}
        />

        {values.valuationMethod === 'manual' ? (
          <FormField
            id="asset-current"
            label="Current value (₹)"
            required
            error={errors.currentValue}
            hint={amountHint(values.currentValue)}
          >
            <input
              id="asset-current"
              inputMode="decimal"
              className={inputClass}
              value={values.currentValue}
              onChange={(e) => set('currentValue', e.target.value)}
              placeholder="e.g. 10,00,000"
              {...errorProps('currentValue', 'asset-current')}
            />
          </FormField>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="asset-quantity" label="Quantity" required error={errors.quantity}>
                <input
                  id="asset-quantity"
                  inputMode="decimal"
                  className={inputClass}
                  value={values.quantity}
                  onChange={(e) => set('quantity', e.target.value)}
                  {...errorProps('quantity', 'asset-quantity')}
                />
              </FormField>
              <FormField id="asset-unit" label="Unit" hint="e.g. g, units" error={errors.unit}>
                <input
                  id="asset-unit"
                  className={inputClass}
                  value={values.unit}
                  onChange={(e) => set('unit', e.target.value)}
                  maxLength={20}
                />
              </FormField>
              <FormField id="asset-unit-price" label="Price per unit (₹)" required error={errors.unitPrice}>
                <input
                  id="asset-unit-price"
                  inputMode="decimal"
                  className={inputClass}
                  value={values.unitPrice}
                  onChange={(e) => set('unitPrice', e.target.value)}
                  {...errorProps('unitPrice', 'asset-unit-price')}
                />
              </FormField>
            </div>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60" aria-live="polite">
              Current value:{' '}
              <span className="font-semibold">
                {computedValue === undefined ? '—' : formatINRExact(computedValue)}
              </span>
            </p>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="asset-purchase"
            label="Purchase value (₹)"
            error={errors.purchaseValue}
            hint={amountHint(values.purchaseValue) ?? 'Optional'}
          >
            <input
              id="asset-purchase"
              inputMode="decimal"
              className={inputClass}
              value={values.purchaseValue}
              onChange={(e) => set('purchaseValue', e.target.value)}
              {...errorProps('purchaseValue', 'asset-purchase')}
            />
          </FormField>
          <FormField id="asset-valuation-date" label="Valuation date" required error={errors.valuationDate}>
            <input
              id="asset-valuation-date"
              type="date"
              className={inputClass}
              value={values.valuationDate}
              max={todayISODate()}
              onChange={(e) => set('valuationDate', e.target.value)}
              {...errorProps('valuationDate', 'asset-valuation-date')}
            />
          </FormField>
        </div>
      </Section>

      <Section title="Ownership" description="Who owns this asset, and in what share. Shares can total less than 100% if part is owned outside the family.">
        <OwnershipFields
          rows={owners}
          onChange={(rows) => {
            setOwners(rows);
            setErrors((e) => {
              const next = { ...e };
              delete next.owners;
              return next;
            });
          }}
          members={members}
          assetValue={values.valuationMethod === 'manual' ? validAmount(values.currentValue) : computedValue}
          error={errors.owners}
        />
      </Section>

      <Section title="Expected annual growth" description="Optional. Your own assumptions, used for projections in later steps.">
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ['conservativeGrowthRate', 'Conservative'],
              ['baseGrowthRate', 'Base'],
              ['optimisticGrowthRate', 'Optimistic'],
            ] as const
          ).map(([key, label]) => (
            <FormField key={key} id={`asset-${key}`} label={`${label} %`} error={errors[key]}>
              <input
                id={`asset-${key}`}
                inputMode="decimal"
                className={inputClass}
                value={values[key]}
                onChange={(e) =>
                  set(key, e.target.value, ['conservativeGrowthRate', 'baseGrowthRate', 'optimisticGrowthRate'])
                }
                {...errorProps(key, `asset-${key}`)}
              />
            </FormField>
          ))}
        </div>
      </Section>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          Liquidity<span className="text-red-600"> *</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {LIQUIDITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`cursor-pointer rounded-lg border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-500 ${
                values.liquidity === opt.value
                  ? 'border-teal-600 bg-teal-50 dark:bg-teal-950'
                  : 'border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                name="liquidity"
                value={opt.value}
                checked={values.liquidity === opt.value}
                onChange={() => set('liquidity', opt.value)}
                className="sr-only"
              />
              <span className="block font-medium">{opt.label}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{opt.hint}</span>
            </label>
          ))}
        </div>
        {errors.liquidity && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.liquidity}</p>}
      </fieldset>

      <FormField id="asset-notes" label="Notes" hint="Optional" error={errors.notes}>
        <textarea
          id="asset-notes"
          rows={2}
          className={inputClass}
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          maxLength={1000}
        />
      </FormField>

      {Object.keys(errors).length > 0 && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Please fix the highlighted fields.
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
          {asset ? 'Save changes' : 'Add asset'}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <div>
        <legend className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</legend>
        {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {children}
    </fieldset>
  );
}
