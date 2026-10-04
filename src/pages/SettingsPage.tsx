import { Link } from 'react-router-dom';
import { useSettings } from '../app/SettingsContext';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { ProjectionSettings } from '../features/settings/ProjectionSettings';
import { useWealthData } from '../hooks/useWealthData';
import { getAssetClassOptions } from '../models/assetCategories';
import type { NumberFormat, ThemePreference } from '../models/settings';
import { formatINR } from '../utils/currency';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const NUMBER_FORMAT_OPTIONS: { value: NumberFormat; label: string }[] = [
  { value: 'exact', label: 'Exact' },
  { value: 'compact', label: 'Lakh / Crore' },
];

const SAMPLE_AMOUNT = 12500000;

export function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings();
  const { assets, loading: dataLoading } = useWealthData();

  return (
    <>
      <PageHeader title="Settings" description="Preferences are saved in this browser." />

      <Card>
        <h2 className="font-medium">Appearance</h2>
        <div className="mt-3">
          <SegmentedControl
            name="theme"
            label="Theme"
            options={THEME_OPTIONS}
            value={settings.theme}
            onChange={(theme) => void updateSettings({ theme })}
            disabled={loading}
          />
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="font-medium">Number format</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">How amounts are shown in lists and summaries.</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <SegmentedControl
            name="numberFormat"
            label="Number format"
            options={NUMBER_FORMAT_OPTIONS}
            value={settings.numberFormat}
            onChange={(numberFormat) => void updateSettings({ numberFormat })}
            disabled={loading}
          />
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Example: <span className="font-medium text-slate-900 dark:text-slate-100">{formatINR(SAMPLE_AMOUNT, settings.numberFormat)}</span>
          </span>
        </div>
      </Card>

      {loading || dataLoading ? (
        <p className="mt-6 text-sm text-slate-500">Loading…</p>
      ) : (
        <ProjectionSettings settings={settings} assetClasses={getAssetClassOptions(assets)} onSave={updateSettings} />
      )}

      <Card className="mt-6">
        <h2 className="font-medium">Your data</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Backup, restore, export and deletion are on the{' '}
          <Link to="/data" className="font-medium text-teal-700 underline dark:text-teal-400">
            Backup &amp; data
          </Link>{' '}
          page.
        </p>
      </Card>
    </>
  );
}
