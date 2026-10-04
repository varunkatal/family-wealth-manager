import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { inputClass } from '../../components/FormField';
import type { AppSettings, ScenarioRates } from '../../models/settings';
import { SCENARIO_LABELS, SCENARIOS, type Scenario } from '../../services/finance/scenarios';
import { numberText, parsePercent } from '../../utils/formInput';

type Props = {
  settings: AppSettings;
  assetClasses: string[];
  onSave: (patch: Partial<AppSettings>) => Promise<void>;
};

type RateText = Record<Scenario, string>;
const validRate = (n: number | undefined, min: number, max: number) => n === undefined || (!Number.isNaN(n) && n >= min && n <= max);

/** Inflation and default growth rates per asset class, used by projections. */
export function ProjectionSettings({ settings, assetClasses, onSave }: Props) {
  const [inflation, setInflation] = useState(String(settings.inflationRate));
  const [rates, setRates] = useState<Record<string, RateText>>(() =>
    Object.fromEntries(
      assetClasses.map((c) => {
        const d = settings.classDefaults[c] ?? {};
        return [c, { conservative: numberText(d.conservative), base: numberText(d.base), optimistic: numberText(d.optimistic) }];
      }),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const setRate = (assetClass: string, scenario: Scenario, value: string) => {
    setSaved(false);
    setRates((r) => ({ ...r, [assetClass]: { ...(r[assetClass] ?? { conservative: '', base: '', optimistic: '' }), [scenario]: value } }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const inflationRate = parsePercent(inflation);
    if (inflationRate === undefined || !validRate(inflationRate, 0, 50)) next.inflation = 'Enter an inflation rate from 0% to 50%';

    const classDefaults: Record<string, ScenarioRates> = {};
    for (const [assetClass, text] of Object.entries(rates)) {
      const parsed = Object.fromEntries(SCENARIOS.map((s) => [s, parsePercent(text[s])])) as Record<Scenario, number | undefined>;
      if (!SCENARIOS.every((s) => validRate(parsed[s], -100, 100))) {
        next[assetClass] = 'Rates must be between -100% and 100%';
        continue;
      }
      const { conservative: c, base: b, optimistic: o } = parsed;
      if ((c !== undefined && b !== undefined && c > b) || (b !== undefined && o !== undefined && b > o) || (c !== undefined && o !== undefined && c > o)) {
        next[assetClass] = 'Use Conservative ≤ Base ≤ Optimistic';
        continue;
      }
      const defined = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined));
      if (Object.keys(defined).length > 0) classDefaults[assetClass] = defined;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    // Keep defaults for classes no longer shown (e.g. a custom class whose assets were deleted).
    const hidden = Object.fromEntries(Object.entries(settings.classDefaults).filter(([c]) => !(c in rates)));
    await onSave({ inflationRate: inflationRate!, classDefaults: { ...hidden, ...classDefaults } });
    setSaved(true);
  };

  return (
    <Card className="mt-6">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <h2 className="font-medium">Projection assumptions</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          These are your assumptions, not predictions. Nothing is filled in for you except the inflation default.
        </p>

        <div className="mt-4">
          <label htmlFor="inflation-rate" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Inflation (% a year)
          </label>
          <input
            id="inflation-rate"
            inputMode="decimal"
            className={`${inputClass} max-w-32`}
            value={inflation}
            onChange={(e) => {
              setSaved(false);
              setInflation(e.target.value);
            }}
            aria-invalid={!!errors.inflation}
          />
          {errors.inflation ? (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.inflation}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Used to show future values in today's money.</p>
          )}
        </div>

        <h3 className="mt-6 text-sm font-medium text-slate-700 dark:text-slate-200">Default growth rates by asset class (% a year)</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Used only for assets that have no rate of their own for that scenario. Leave blank for no default.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Default growth rates by asset class</caption>
            <thead className="text-xs text-slate-500 dark:text-slate-400">
              <tr>
                <th scope="col" className="pb-1 text-left font-normal">Asset class</th>
                {SCENARIOS.map((s) => (
                  <th key={s} scope="col" className="pb-1 pl-2 text-left font-normal">
                    {SCENARIO_LABELS[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assetClasses.map((c) => (
                <tr key={c} className="border-t border-slate-100 align-top dark:border-slate-800">
                  <th scope="row" className="whitespace-nowrap py-2 pr-2 text-left font-normal">
                    {c}
                    {errors[c] && <span className="block text-xs text-red-600 dark:text-red-400">{errors[c]}</span>}
                  </th>
                  {SCENARIOS.map((s) => (
                    <td key={s} className="py-1.5 pl-2">
                      <input
                        aria-label={`${c} ${SCENARIO_LABELS[s]} rate`}
                        inputMode="decimal"
                        className={`${inputClass} min-w-16`}
                        value={rates[c]?.[s] ?? ''}
                        onChange={(e) => setRate(c, s, e.target.value)}
                        aria-invalid={!!errors[c]}
                                  />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button type="submit">
            Save assumptions
          </Button>
          {saved && (
            <span role="status" className="text-sm text-teal-700 dark:text-teal-400">
              Saved
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
