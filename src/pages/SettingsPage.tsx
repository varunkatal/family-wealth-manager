import { useSettings } from '../app/SettingsContext';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import type { ThemePreference } from '../models/settings';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings();

  return (
    <>
      <PageHeader title="Settings" description="Preferences are saved in this browser." />

      <Card>
        <fieldset disabled={loading}>
          <legend className="font-medium">Appearance</legend>
          <div className="mt-3 inline-flex rounded-lg border border-slate-200 p-1 dark:border-slate-700" role="radiogroup">
            {THEME_OPTIONS.map((opt) => {
              const selected = settings.theme === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-500 ${
                    selected
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={opt.value}
                    checked={selected}
                    onChange={() => void updateSettings({ theme: opt.value })}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      </Card>

      <Card className="mt-6">
        <h2 className="font-medium">More settings coming</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Default growth rates, inflation, number format, backup and data deletion will be added in later phases.
        </p>
      </Card>
    </>
  );
}
