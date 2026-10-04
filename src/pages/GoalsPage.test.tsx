import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAsset } from '../services/storage/assetRepository';
import { createFamilyMember } from '../services/storage/familyMemberRepository';
import { createGoal } from '../services/storage/goalRepository';
import { renderApp } from '../test/renderApp';

let A = '';
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T10:00:00'));
  A = (await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true })).id;
});
afterEach(() => {
  vi.useRealTimers();
});

const card = (name: string) => screen.getByRole('heading', { name }).closest('li')!;

describe('Goals page (Phase 11)', () => {
  it('adds, edits and deletes a goal; remaining amount and required monthly saving', async () => {
    const user = userEvent.setup();
    renderApp('/goals');

    await user.click(await screen.findByRole('button', { name: 'Add a goal' }));
    let dialog = screen.getByRole('dialog', { name: 'Add goal' });
    await user.click(within(dialog).getByRole('button', { name: 'Add goal' }));
    expect(within(dialog).getByText('Name is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a goal type')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a valid target amount')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Name/), 'Example Car');
    await user.selectOptions(within(dialog).getByLabelText(/Goal type/), 'Car');
    await user.selectOptions(within(dialog).getByLabelText(/^For/), 'Person A');
    await user.type(within(dialog).getByLabelText(/Target amount/), '10,00,000');
    await user.type(within(dialog).getByLabelText(/Saved so far/), '2,00,000');
    await user.type(within(dialog).getByLabelText(/Target date/), '2030-02-05'); // 40 months away
    // Remaining ₹8,00,000 over 40 months, no return assumed
    expect(within(dialog).getByTestId('goal-preview')).toHaveTextContent('Save ₹20,000 a month for 40 months');
    await user.click(within(dialog).getByRole('button', { name: 'Add goal' }));

    await waitFor(() => expect(screen.getByTestId('required-Example Car')).toHaveTextContent('₹20,000'));
    expect(card('Example Car')).toHaveTextContent('Remaining₹8,00,000');
    expect(card('Example Car')).toHaveTextContent('Car · Person A');
    expect(within(card('Example Car')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
    expect(screen.getByTestId('total-required')).toHaveTextContent('₹20,000');

    // With a 12% return on savings, less is needed
    await user.click(screen.getByRole('button', { name: 'Edit Example Car' }));
    dialog = screen.getByRole('dialog', { name: 'Edit goal' });
    await user.type(within(dialog).getByLabelText(/Expected return/), '12');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(card('Example Car')).toHaveTextContent('Assumes 12% a year on savings.'));
    const required = Number(screen.getByTestId('required-Example Car').textContent!.replace(/[₹,]/g, ''));
    expect(required).toBeLessThan(20000);

    // Persists across a reload
    cleanup();
    renderApp('/goals');
    expect(await screen.findByRole('heading', { name: 'Example Car' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Example Car' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('No goals yet')).toBeInTheDocument();
  });

  it('required monthly contribution with a return, on track, and overdue goals', async () => {
    await createGoal({ name: 'Example Education', type: 'Education', targetAmount: 1000000, savedAmount: 100000, targetDate: '2031-10-05', priority: 'high', expectedReturn: 12 });
    await createGoal({ name: 'Example Emergency Fund', type: 'Emergency Fund', targetAmount: 300000, savedAmount: 300000, targetDate: '2027-01-01', priority: 'medium' });
    await createGoal({ name: 'Example Trip', type: 'Travel', targetAmount: 200000, savedAmount: 50000, targetDate: '2026-01-01', priority: 'low' });
    renderApp('/goals');
    // ₹1L grows to ₹1,76,234.17 at 12%; the rest over 60 months at 1% a month
    await waitFor(() => expect(screen.getByTestId('required-Example Education')).toHaveTextContent('₹10,086.56'));
    expect(screen.getByTestId('required-Example Emergency Fund')).toHaveTextContent('On track');
    expect(screen.getByTestId('required-Example Trip')).toHaveTextContent('Overdue');
    // Listed by priority
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Example Education',
      'Example Emergency Fund',
      'Example Trip',
    ]);
  });

  it('estimates milestone dates under each scenario, including a custom milestone', async () => {
    await createAsset({
      name: 'Example Equity Fund',
      assetClass: 'Equity',
      valuationMethod: 'manual',
      currentValue: 2000000,
      valuationDate: '2026-01-01',
      liquidity: 'liquid',
      conservativeGrowthRate: 8,
      baseGrowthRate: 10,
      optimisticGrowthRate: 12,
      owners: [{ familyMemberId: A, percentage: 100 }],
    });
    const user = userEvent.setup();
    renderApp('/goals');
    const table = await screen.findByRole('table', { name: 'Wealth milestones' });
    const row = (label: string) => within(table).getByRole('row', { name: new RegExp(`^${label}`) });
    // en-IN abbreviates September as "Sept"
    expect([...row('₹25 Lakh').querySelectorAll('td')].map((c) => c.textContent)).toEqual(['~Sept 2029', '~Feb 2029', '~Oct 2028']);
    expect(row('₹50 Lakh')).toHaveTextContent('~');

    await user.type(screen.getByLabelText(/Custom milestone/), '15,00,000');
    expect([...row('₹15 Lakh').querySelectorAll('td')].map((c) => c.textContent)).toEqual(['Reached', 'Reached', 'Reached']);
  });
});
