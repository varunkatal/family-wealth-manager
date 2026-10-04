import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAsset } from '../services/storage/assetRepository';
import { createContribution } from '../services/storage/contributionRepository';
import { createFamilyMember } from '../services/storage/familyMemberRepository';
import { renderApp } from '../test/renderApp';

let A = '';
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-04T10:00:00'));
  A = (await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true })).id;
});
afterEach(() => {
  vi.useRealTimers();
});

const fund = (baseGrowthRate?: number) =>
  createAsset({
    name: 'Example Equity Fund',
    assetClass: 'Equity',
    valuationMethod: 'manual',
    currentValue: 1000000,
    valuationDate: '2026-01-01',
    liquidity: 'liquid',
    baseGrowthRate,
    owners: [{ familyMemberId: A, percentage: 100 }],
  });

describe('Investments page', () => {
  it('adds, edits and deletes a regular investment with validation', async () => {
    await fund(12);
    const user = userEvent.setup();
    renderApp('/investments');

    await user.click(await screen.findByRole('button', { name: 'Add an investment' }));
    let dialog = screen.getByRole('dialog', { name: 'Add investment' });
    await user.click(within(dialog).getByRole('button', { name: 'Add investment' }));
    expect(within(dialog).getByText('Name is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a valid amount')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Name/), 'Example SIP');
    await user.selectOptions(within(dialog).getByLabelText(/Linked asset/), 'Example Equity Fund');
    expect(within(dialog).getByText(/uses Example Equity Fund's Base rate \(12%\)/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Amount/), '10,000');
    await user.type(within(dialog).getByLabelText(/End date/), '2020-01-01');
    await user.click(within(dialog).getByRole('button', { name: 'Add investment' }));
    expect(within(dialog).getByText('End date must be on or after the start date')).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText(/End date/));
    await user.click(within(dialog).getByRole('button', { name: 'Add investment' }));

    await waitFor(() => expect(screen.getByTestId('monthly-contributions')).toHaveTextContent('₹10,000'));
    const row = screen.getByRole('row', { name: /Example SIP/ });
    expect(row).toHaveTextContent('Into Example Equity Fund');
    expect(row).toHaveTextContent("12%asset's rate");

    // Quarterly ₹30,000 is ₹10,000 a month; own rate overrides the asset's
    await user.click(screen.getByRole('button', { name: 'Edit Example SIP' }));
    dialog = screen.getByRole('dialog', { name: 'Edit investment' });
    const amount = within(dialog).getByLabelText(/Amount/);
    await user.clear(amount);
    await user.type(amount, '45000');
    await user.selectOptions(within(dialog).getByLabelText(/Frequency/), 'Quarterly');
    await user.type(within(dialog).getByLabelText(/Expected return/), '10');
    await user.type(within(dialog).getByLabelText(/Annual increase/), '5');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByTestId('monthly-contributions')).toHaveTextContent('₹15,000'));
    expect(screen.getByRole('row', { name: /Example SIP/ })).toHaveTextContent('Quarterly · +5%/yr');

    await user.click(screen.getByRole('button', { name: 'Delete Example SIP' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('No regular investments')).toBeInTheDocument();
  });

  it('SIP calculator: ₹10,000 a month at 12% for 10 years, with step-up and lump sum', async () => {
    const user = userEvent.setup();
    renderApp('/investments');
    await user.type(await screen.findByLabelText(/SIP amount/), '10000');
    await user.type(screen.getByLabelText(/Expected return/), '12');
    expect(screen.getByTestId('calc-invested')).toHaveTextContent('₹12,00,000');
    expect(screen.getByTestId('calc-value')).toHaveTextContent('₹23,00,387');

    await user.type(screen.getByLabelText(/Annual increase/), '10');
    expect(screen.getByTestId('calc-value')).toHaveTextContent('₹33,40,917');

    await user.clear(screen.getByLabelText(/Annual increase/));
    await user.type(screen.getByLabelText(/Initial lump sum/), '1,00,000');
    expect(screen.getByTestId('calc-value')).toHaveTextContent('₹26,10,972');
  });

  it('flags investments without any rate', async () => {
    await createContribution({ name: 'Example RD', ownerId: A, amount: 5000, frequency: 'monthly', startDate: '2026-11-04' });
    renderApp('/investments');
    expect(await screen.findByRole('row', { name: /Example RD/ })).toHaveTextContent('No rate');
  });
});

describe('Projections with regular investments', () => {
  it('adds future contributions to the family total', async () => {
    const asset = await fund(10);
    await createContribution({
      name: 'Example SIP',
      ownerId: A,
      linkedAssetId: asset.id,
      amount: 10000,
      frequency: 'monthly',
      startDate: '2026-11-04',
      expectedReturn: 12,
    });
    const user = userEvent.setup();
    renderApp('/projections');
    await user.click(await screen.findByRole('radio', { name: '1Y' }));
    // ₹10L × 1.10 + ₹10,000 × [((1.01)^12 − 1) / 0.01]
    expect(screen.getByTestId('projected-total')).toHaveTextContent('₹12,26,825');
    expect(screen.getByTestId('projected-contributions')).toHaveTextContent('₹1,26,825from ₹1,20,000 invested');
    expect(screen.getByRole('table', { name: 'Projection by regular investment' })).toHaveTextContent('Example SIP12%');
  });

  it('applies the saved annual increase (step-up) in projections', async () => {
    await createContribution({
      name: 'Example Step-up SIP',
      ownerId: A,
      amount: 10000,
      frequency: 'monthly',
      startDate: '2025-10-04', // started a year ago: next 11 payments are ₹11,000, then ₹12,100
      expectedReturn: 12,
      annualIncrease: 10,
    });
    const user = userEvent.setup();
    renderApp('/projections');
    await user.click(await screen.findByRole('radio', { name: '1Y' }));
    expect(screen.getByTestId('projected-contributions')).toHaveTextContent('₹1,40,608from ₹1,33,100 invested');
  });

  it('projects contributions even with no assets yet', async () => {
    await createContribution({ name: 'Example RD', ownerId: A, amount: 5000, frequency: 'monthly', startDate: '2026-11-04' });
    const user = userEvent.setup();
    renderApp('/projections');
    await user.click(await screen.findByRole('radio', { name: '1Y' }));
    expect(screen.getByTestId('projected-total')).toHaveTextContent('₹60,000');
    expect(screen.getByRole('status')).toHaveTextContent('1 regular investment has no expected return');
  });
});
