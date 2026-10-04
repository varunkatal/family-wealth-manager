import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';

const SUMMARY_TILES = ['Total Assets', 'Total Liabilities', 'Net Worth'];

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="An overview of your family's wealth." />

      <div className="grid gap-4 sm:grid-cols-3">
        {SUMMARY_TILES.map((label) => (
          <Card key={label}>
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-300 dark:text-slate-600">—</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="font-medium">No data yet</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Family members, assets and liabilities will appear here once those sections are added. Everything you enter
          stays in this browser on this device.
        </p>
      </Card>
    </>
  );
}
