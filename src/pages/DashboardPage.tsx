import { Link } from 'react-router-dom';
import { useSettings } from '../app/SettingsContext';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { useWealthData } from '../hooks/useWealthData';
import { formatINR } from '../utils/currency';

export function DashboardPage() {
  const { assets, members, wealth, loading, error } = useWealthData();
  const { settings } = useSettings();
  const fmt = (n: number) => formatINR(n, settings.numberFormat);
  const unowned = wealth.unownedAssetIds.length;

  const tiles = [
    { label: 'Total Assets', value: wealth.totalAssets, testId: 'total-assets' },
    { label: 'Total Liabilities', value: wealth.totalLiabilities, testId: 'total-liabilities' },
    { label: 'Net Worth', value: wealth.netWorth, testId: 'net-worth' },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="An overview of your family's wealth." />

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label}>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.label}</p>
            <p
              data-testid={t.testId}
              className={`mt-2 text-2xl font-semibold tabular-nums ${loading ? 'text-slate-300 dark:text-slate-600' : t.value < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
            >
              {loading ? '—' : fmt(t.value)}
            </p>
          </Card>
        ))}
      </div>

      {!loading && unowned > 0 && (
        <p role="status" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {unowned} {unowned === 1 ? 'asset has' : 'assets have'} no owner and {unowned === 1 ? "isn't" : "aren't"} included
          above.{' '}
          <Link to="/assets" className="font-medium underline">
            Assign owners
          </Link>
        </p>
      )}

      {!loading && assets.length === 0 && (
        <Card className="mt-6">
          <h2 className="font-medium">No data yet</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {members.length === 0 ? (
              <>
                Start by adding your <Link to="/family" className="font-medium text-teal-700 underline dark:text-teal-400">family members</Link>, then
                their assets.
              </>
            ) : (
              <>
                Add <Link to="/assets" className="font-medium text-teal-700 underline dark:text-teal-400">assets</Link> and{' '}
                <Link to="/liabilities" className="font-medium text-teal-700 underline dark:text-teal-400">liabilities</Link> to see your net worth.
              </>
            )}{' '}
            Everything you enter stays in this browser on this device.
          </p>
        </Card>
      )}
    </>
  );
}
