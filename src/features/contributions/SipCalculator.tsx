import { useState } from 'react';
import { Card } from '../../components/Card';
import { FormField, inputClass } from '../../components/FormField';
import { FREQUENCIES, FREQUENCY_LABELS, projectGrowingSIPByYear, type Frequency } from '../../services/finance/sip';
import { parseAmountInput } from '../../utils/currency';
import { amountHint, parsePercent } from '../../utils/formInput';

const MAX_YEARS = 50;

type Values = { initial: string; payment: string; frequency: Frequency; rate: string; increase: string; years: string };

const valid = (n: number | undefined, min: number, max: number) => n !== undefined && !Number.isNaN(n) && n >= min && n <= max;

/** A what-if SIP calculator. Nothing here is saved. */
export function SipCalculator({ fmt }: { fmt: (n: number) => string }) {
  const [v, setV] = useState<Values>({ initial: '', payment: '', frequency: 'monthly', rate: '', increase: '', years: '10' });
  const set = (key: keyof Values, value: string) => setV((prev) => ({ ...prev, [key]: value }));

  const initial = parseAmountInput(v.initial) ?? 0;
  const payment = parseAmountInput(v.payment) ?? 0;
  const rate = parsePercent(v.rate);
  const increase = parsePercent(v.increase) ?? 0;
  const years = Number(v.years);
  const errors = {
    initial: valid(initial, 0, 1e13) ? undefined : 'Enter a valid amount',
    payment: valid(payment, 0, 1e13) ? undefined : 'Enter a valid amount',
    rate: rate === undefined ? undefined : valid(rate, -100, 100) ? undefined : 'Enter a rate between -100% and 100%',
    increase: valid(increase, 0, 100) ? undefined : 'Enter 0% to 100%',
    years: Number.isInteger(years) && years >= 1 && years <= MAX_YEARS ? undefined : `Enter whole years from 1 to ${MAX_YEARS}`,
  };
  const ready = rate !== undefined && (initial > 0 || payment > 0) && Object.values(errors).every((e) => !e);
  const rows = ready
    ? projectGrowingSIPByYear({ payment, frequency: v.frequency, annualRatePct: rate, years, annualIncrease: increase, initialAmount: initial })
    : [];
  const final = rows.at(-1);
  const whole = (n: number) => fmt(Math.round(n));

  return (
    <Card>
      <h2 className="font-semibold">SIP calculator</h2>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Try out an investment plan. Nothing here is saved.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField id="calc-initial" label="Initial lump sum (₹)" hint={amountHint(v.initial) ?? 'Optional'} error={errors.initial}>
          <input id="calc-initial" inputMode="decimal" className={inputClass} value={v.initial} onChange={(e) => set('initial', e.target.value)} aria-invalid={!!errors.initial} />
        </FormField>
        <FormField id="calc-payment" label="SIP amount (₹)" hint={amountHint(v.payment) ?? 'Per contribution'} error={errors.payment}>
          <input id="calc-payment" inputMode="decimal" className={inputClass} value={v.payment} onChange={(e) => set('payment', e.target.value)} aria-invalid={!!errors.payment} />
        </FormField>
        <FormField id="calc-frequency" label="Frequency">
          <select id="calc-frequency" className={inputClass} value={v.frequency} onChange={(e) => set('frequency', e.target.value)}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="calc-rate" label="Expected return (% a year)" error={errors.rate}>
          <input id="calc-rate" inputMode="decimal" className={inputClass} value={v.rate} onChange={(e) => set('rate', e.target.value)} aria-invalid={!!errors.rate} />
        </FormField>
        <FormField id="calc-increase" label="Annual increase (%)" hint="Optional step-up each year" error={errors.increase}>
          <input id="calc-increase" inputMode="decimal" className={inputClass} value={v.increase} onChange={(e) => set('increase', e.target.value)} aria-invalid={!!errors.increase} />
        </FormField>
        <FormField id="calc-years" label="Years" error={errors.years}>
          <input id="calc-years" inputMode="numeric" className={inputClass} value={v.years} onChange={(e) => set('years', e.target.value.trim())} aria-invalid={!!errors.years} />
        </FormField>
      </div>

      {final ? (
        <>
          <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Invested</dt>
              <dd data-testid="calc-invested" className="text-lg font-semibold tabular-nums">{whole(final.invested)}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Gains</dt>
              <dd className="text-lg font-semibold tabular-nums">{whole(final.value - final.invested)}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Value in {years}Y</dt>
              <dd data-testid="calc-value" className="text-lg font-semibold tabular-nums">{whole(final.value)}</dd>
            </div>
          </dl>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium text-teal-700 dark:text-teal-400">Year by year</summary>
            <table className="mt-2 w-full">
              <caption className="sr-only">SIP calculator by year</caption>
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="pb-1 text-left font-normal">Year</th>
                  <th scope="col" className="pb-1 text-right font-normal">Invested</th>
                  <th scope="col" className="pb-1 text-right font-normal">Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year} className="border-t border-slate-100 dark:border-slate-800">
                    <th scope="row" className="py-1.5 text-left font-normal">{r.year === 0 ? 'Today' : `Year ${r.year}`}</th>
                    <td className="py-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{whole(r.invested)}</td>
                    <td className="py-1.5 text-right tabular-nums">{whole(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Contributions at the end of each period, with the yearly return divided across periods (e.g. 12% → 1% a month).
            The lump sum compounds once a year.
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Enter an amount and an expected return to see the result.</p>
      )}
    </Card>
  );
}
