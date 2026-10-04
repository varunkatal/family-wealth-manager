import { useMemo, useState } from 'react';
import { useSettings } from '../app/SettingsContext';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { GoalForm } from '../features/goals/GoalForm';
import { Milestones } from '../features/goals/Milestones';
import { useWealthData } from '../hooks/useWealthData';
import { PRIORITY_LABELS, type Goal } from '../models/goal';
import { projectFamilyWealth } from '../services/finance/familyProjection';
import { calculateRemainingAmount, calculateRequiredMonthlyContribution, monthsUntil } from '../services/finance/goals';
import { SCENARIOS, type Scenario } from '../services/finance/scenarios';
import { createGoal, deleteGoal, updateGoal } from '../services/storage/goalRepository';
import { formatINR } from '../utils/currency';
import { formatISODate, todayISODate } from '../utils/date';

type Dialog = { kind: 'add' } | { kind: 'edit'; goal: Goal } | { kind: 'delete'; goal: Goal } | null;

/** How far milestones are searched for. */
const MILESTONE_YEARS = 50;

export function GoalsPage() {
  const { members, assets, ownerships, contributions, liabilities, goals, memberById, loading, error, run } = useWealthData();
  const { settings } = useSettings();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fmt = (n: number) => formatINR(n, settings.numberFormat);
  const close = () => setDialog(null);
  const today = todayISODate();

  const plans = goals.map((goal) => {
    const months = monthsUntil(today, goal.targetDate);
    return {
      goal,
      months,
      remaining: calculateRemainingAmount(goal.targetAmount, goal.savedAmount),
      required: calculateRequiredMonthlyContribution(goal.targetAmount, goal.savedAmount, goal.expectedReturn ?? 0, months),
      progress: Math.min(100, (goal.savedAmount / goal.targetAmount) * 100),
    };
  });
  const totalRequired = plans.reduce((s, p) => s + (p.required ?? 0), 0);

  // 50-year projections are recalculated only when the underlying data changes.
  const projections = useMemo(() => {
    const input = { assets, ownerships, contributions, liabilities, classDefaults: settings.classDefaults, today };
    return SCENARIOS.map((s) => projectFamilyWealth(input, s, MILESTONE_YEARS));
  }, [assets, ownerships, contributions, liabilities, settings.classDefaults, today]);
  const netWorthByScenario = Object.fromEntries(projections.map((p) => [p.scenario, p.netWorth])) as Record<Scenario, number[]>;
  const missing = new Set(projections.flatMap((p) => p.assets.filter((a) => a.rate === undefined).map((a) => a.asset.id))).size;
  const hasWealthData = assets.length > 0 || contributions.length > 0 || liabilities.length > 0;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Goals" description="What the family is saving for, and what it takes to get there." />
        {goals.length > 0 && (
          <Button className="shrink-0" onClick={() => setDialog({ kind: 'add' })}>
            Add goal
          </Button>
        )}
      </div>

      {(error || actionError) && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error ?? actionError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          {goals.length === 0 ? (
            <Card className="py-10 text-center">
              <h2 className="font-medium">No goals yet</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">
                Add goals such as a car, education, a house or an emergency fund to see how much to save each month.
              </p>
              <Button className="mt-5" onClick={() => setDialog({ kind: 'add' })}>
                Add a goal
              </Button>
            </Card>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                {goals.length} {goals.length === 1 ? 'goal' : 'goals'} · Together they need{' '}
                <span data-testid="total-required" className="font-semibold text-slate-900 dark:text-slate-100">
                  {fmt(Math.round(totalRequired * 100) / 100)}
                </span>{' '}
                a month
              </p>
              <ul className="grid gap-4 md:grid-cols-2">
                {plans.map(({ goal, months, remaining, required, progress }) => (
                  <li key={goal.id}>
                    <Card className="h-full">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{goal.name}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {goal.type} · {goal.ownerId ? (memberById.get(goal.ownerId)?.name ?? 'Unknown') : 'Whole family'}
                          </p>
                        </div>
                        <Badge tone={goal.priority === 'high' ? 'warning' : 'notice'}>{PRIORITY_LABELS[goal.priority]}</Badge>
                      </div>

                      <div className="mt-4 flex items-baseline justify-between text-sm">
                        <span className="tabular-nums">
                          <span className="font-semibold">{fmt(goal.savedAmount)}</span>
                          <span className="text-slate-500 dark:text-slate-400"> of {fmt(goal.targetAmount)}</span>
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">{Math.floor(progress)}%</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`${goal.name} progress`}
                        aria-valuenow={Math.floor(progress)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                      >
                        <div className="h-full rounded-full bg-teal-600" style={{ width: `${progress}%` }} />
                      </div>

                      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <dt className="text-xs text-slate-500 dark:text-slate-400">Remaining</dt>
                          <dd className="font-medium tabular-nums">{fmt(remaining)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500 dark:text-slate-400">By</dt>
                          <dd className="font-medium">
                            {formatISODate(goal.targetDate)}
                            <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                              {months > 0 ? `${months} months` : 'Date passed'}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500 dark:text-slate-400">Save monthly</dt>
                          <dd className="font-medium tabular-nums" data-testid={`required-${goal.name}`}>
                            {required === null ? <Badge tone="warning">Overdue</Badge> : required === 0 ? 'On track' : fmt(required)}
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {goal.expectedReturn !== undefined ? `Assumes ${goal.expectedReturn}% a year on savings.` : 'Assumes no return on savings.'}
                      </p>

                      <div className="mt-3 flex justify-end gap-1">
                        <Button variant="ghost" onClick={() => setDialog({ kind: 'edit', goal })} aria-label={`Edit ${goal.name}`}>
                          Edit
                        </Button>
                        <Button variant="danger-ghost" onClick={() => setDialog({ kind: 'delete', goal })} aria-label={`Delete ${goal.name}`}>
                          Delete
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-8">
            {hasWealthData ? (
              <Milestones netWorthByScenario={netWorthByScenario} today={today} assetsMissingRates={missing} />
            ) : (
              <Card>
                <h2 className="font-semibold">Wealth milestones</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add assets to estimate when family wealth reaches ₹25 lakh, ₹1 crore and more.</p>
              </Card>
            )}
          </div>
        </>
      )}

      {(dialog?.kind === 'add' || dialog?.kind === 'edit') && (
        <Modal title={dialog.kind === 'add' ? 'Add goal' : 'Edit goal'} onClose={close} size="lg">
          <GoalForm
            goal={dialog.kind === 'edit' ? dialog.goal : undefined}
            members={members}
            onCancel={close}
            onSubmit={async (goalInput) => {
              await run(() => (dialog.kind === 'edit' ? updateGoal(dialog.goal.id, goalInput) : createGoal(goalInput)));
              close();
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete goal?"
          message={
            <p>
              <strong className="text-slate-900 dark:text-slate-100">{dialog.goal.name}</strong> will be permanently removed.
              This can't be undone.
            </p>
          }
          confirmLabel="Delete"
          onCancel={close}
          onConfirm={async () => {
            try {
              await run(() => deleteGoal(dialog.goal.id));
              setActionError(null);
            } catch {
              setActionError('Could not delete the goal.');
            }
            close();
          }}
        />
      )}
    </>
  );
}
