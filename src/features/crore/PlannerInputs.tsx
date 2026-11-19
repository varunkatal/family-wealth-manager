import { useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { FormField, inputClass } from '../../components/FormField';
import { SegmentedControl } from '../../components/SegmentedControl';
import type { CrorePlannerSettings, SolveFor } from '../../models/settings';
import { formatINRCompact, parseAmountInput } from '../../utils/currency';
import { amountHint, numberText, parsePercent } from '../../utils/formInput';

type Patch = (patch: Partial<CrorePlannerSettings>) => void;

const QUICK_TARGETS = [5000000, 10000000, 20000000];
const MONTHLY_SLIDER_MAX = 300000;
const YEARS_SLIDER_MAX = 30;

/**
 * A text input that keeps what was typed and reports a valid number (or undefined when blank).
 * Invalid text is shown with an error and not reported.
 */
function NumberInput({
  id,
  label,
  value,
  onChange,
  parse,
  validate,
  hint,
  placeholder,
  required,
}: {
  /** Blank is not reported; the last valid value stays in use while the field is empty. */
  required?: boolean;
  id: string;
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  parse: (text: string) => number | undefined;
  validate: (n: number) => string | undefined;
  hint?: (text: string) => string | undefined;
  placeholder?: string;
}) {
  const [text, setText] = useState(numberText(value));
  const [shown, setShown] = useState(value);
  // Follow changes made elsewhere (quick buttons, slider).
  if (value !== shown) {
    setShown(value);
    if (parse(text) !== value) setText(numberText(value));
  }
  const n = parse(text);
  const error = n === undefined ? undefined : Number.isNaN(n) ? 'Enter a number' : validate(n);
  return (
    <FormField id={id} label={label} error={error} hint={hint?.(text)}>
      <input
        id={id}
        inputMode="decimal"
        className={inputClass}
        value={text}
        placeholder={placeholder}
        aria-invalid={error !== undefined}
        onChange={(e) => {
          setText(e.target.value);
          const next = parse(e.target.value);
          if (next === undefined ? !required : !Number.isNaN(next) && !validate(next)) {
            setShown(next);
            onChange(next);
          }
        }}
      />
    </FormField>
  );
}

/** A greyed-out field showing the value being worked out. */
function SolvedField({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <FormField id={id} label={label} hint="Worked out from the other two">
      <input
        id={id}
        readOnly
        className={`${inputClass} bg-slate-100 font-semibold text-teal-800 dark:bg-slate-800 dark:text-teal-300`}
        value={value}
      />
    </FormField>
  );
}

type PlanInputsProps = {
  plan: CrorePlannerSettings;
  onChange: Patch;
  onSolveForChange: (next: SolveFor) => void;
  /** Text of the solved value, shown in its greyed-out field. */
  solvedText: string;
  /** Used when the monthly amount or return has not been typed. */
  defaultMonthly: number;
  defaultRate: number;
  inflationRate: number;
};

export function PlanInputs({ plan, onChange, onSolveForChange, solvedText, defaultMonthly, defaultRate, inflationRate }: PlanInputsProps) {
  const monthly = plan.monthly ?? defaultMonthly;
  return (
    <Card>
      <h2 className="font-semibold">Your plan</h2>
      <div className="mt-3 space-y-4">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Solve for</p>
          <SegmentedControl
            name="crore-solve"
            label="Solve for"
            value={plan.solveFor}
            options={[
              { value: 'monthly', label: 'Monthly investment' },
              { value: 'years', label: 'Years' },
              { value: 'return', label: 'Return %' },
            ]}
            onChange={onSolveForChange}
          />
        </div>

        <div>
          <NumberInput
            id="crore-target"
            label="Target amount (₹)"
            value={plan.target}
            parse={parseAmountInput}
            validate={(n) => (n > 0 ? undefined : 'Enter an amount more than 0')}
            hint={amountHint}
            required
            onChange={(n) => n !== undefined && onChange({ target: n })}
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {QUICK_TARGETS.map((t) => (
              <Button key={t} variant="ghost" onClick={() => onChange({ target: t })} aria-pressed={plan.target === t}>
                {formatINRCompact(t).replace(' Lakh', ' L').replace(' Crore', ' Cr')}
              </Button>
            ))}
          </div>
        </div>

        {plan.solveFor === 'years' ? (
          <SolvedField id="crore-years" label="Years" value={solvedText} />
        ) : (
          <div>
            <NumberInput
              id="crore-years"
              label="Years"
              value={plan.years}
              parse={parseAmountInput}
              validate={(n) => (n > 0 && n <= 50 ? undefined : 'Between 0 and 50 years')}
              required
              onChange={(n) => n !== undefined && onChange({ years: n })}
            />
            <input
              type="range"
              min={1}
              max={YEARS_SLIDER_MAX}
              step={0.5}
              value={Math.min(plan.years, YEARS_SLIDER_MAX)}
              onChange={(e) => onChange({ years: Number(e.target.value) })}
              aria-label="Years slider"
              className="mt-2 w-full accent-teal-700"
            />
          </div>
        )}

        {plan.solveFor === 'monthly' ? (
          <SolvedField id="crore-monthly" label="Monthly investment (₹)" value={solvedText} />
        ) : (
          <div>
            <NumberInput
              id="crore-monthly"
              label="Monthly investment (₹)"
              value={plan.monthly}
              parse={parseAmountInput}
              validate={(n) => (n >= 0 ? undefined : 'Cannot be negative')}
              hint={(text) => amountHint(text) ?? (plan.monthly === undefined ? 'Blank: your saved SIPs for the ticked assets.' : undefined)}
              placeholder={String(defaultMonthly)}
              onChange={(n) => onChange({ monthly: n })}
            />
            <input
              type="range"
              min={0}
              max={MONTHLY_SLIDER_MAX}
              step={500}
              value={Math.min(monthly, MONTHLY_SLIDER_MAX)}
              onChange={(e) => onChange({ monthly: Number(e.target.value) })}
              aria-label="Monthly investment slider"
              className="mt-2 w-full accent-teal-700"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {plan.solveFor === 'return' ? (
            <SolvedField id="crore-return" label="Return % a year" value={solvedText} />
          ) : (
            <NumberInput
              id="crore-return"
              label="Return % a year"
              value={plan.ratePct}
              parse={parsePercent}
              validate={(n) => (n >= 0 && n <= 100 ? undefined : 'Between 0% and 100%')}
              placeholder={String(defaultRate)}
              hint={() => (plan.ratePct === undefined ? 'Blank: average rate of the ticked assets.' : undefined)}
              onChange={(n) => onChange({ ratePct: n })}
            />
          )}
          <NumberInput
            id="crore-stepup"
            label="Yearly increase (%)"
            value={plan.stepUpPct}
            parse={parsePercent}
            validate={(n) => (n >= 0 && n <= 100 ? undefined : 'Between 0% and 100%')}
            placeholder="0"
            hint={() => 'Raises the monthly amount every 12 months.'}
            onChange={(n) => onChange({ stepUpPct: n ?? 0 })}
          />
        </div>

        <div>
          <SegmentedControl
            name="crore-money"
            label="Target is in"
            value={plan.todaysMoney ? 'today' : 'future'}
            options={[
              { value: 'future', label: 'Future rupees' },
              { value: 'today', label: "Today's money" },
            ]}
            onChange={(v) => onChange({ todaysMoney: v === 'today' })}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {plan.todaysMoney
              ? `The target rises with inflation (${inflationRate}% a year, from Settings) so it keeps today's buying power.`
              : 'The target is exactly this amount on the day you reach it.'}
          </p>
        </div>
      </div>
    </Card>
  );
}

/** Saved SIPs linked to the ticked assets, as monthly equivalents. */
export function SavedSips({ sips, format }: { sips: { id: string; name: string; monthly: number }[]; format: (n: number) => string }) {
  if (sips.length === 0) return null;
  const total = sips.reduce((s, x) => s + x.monthly, 0);
  return (
    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50">
      <ul className="space-y-0.5">
        {sips.map((s) => (
          <li key={s.id} className="flex justify-between gap-2">
            <span className="truncate">{s.name}</span>
            <span className="tabular-nums">{format(s.monthly)}/mo</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-medium dark:border-slate-700">
        <span>Saved SIPs</span>
        <span data-testid="existing-sips" className="tabular-nums">
          {format(Math.round(total * 100) / 100)}/mo
        </span>
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Used as the monthly investment until you type your own.</p>
    </div>
  );
}
