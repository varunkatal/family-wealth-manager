import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAsset } from '../services/storage/assetRepository';
import { createFamilyMember } from '../services/storage/familyMemberRepository';
import { createLiability } from '../services/storage/liabilityRepository';
import { renderApp } from '../test/renderApp';

describe('Liabilities page', () => {
  it('asks for a family member first when there are none', async () => {
    const user = userEvent.setup();
    renderApp('/liabilities');
    await user.click(await screen.findByRole('button', { name: 'Add a liability' }));
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'Add a family member' })).toBeInTheDocument();
  });

  it('adds, edits and deletes a liability with validation', async () => {
    await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true });
    const user = userEvent.setup();
    renderApp('/liabilities');

    await user.click(await screen.findByRole('button', { name: 'Add a liability' }));
    let dialog = screen.getByRole('dialog', { name: 'Add liability' });
    await user.click(within(dialog).getByRole('button', { name: 'Add liability' }));
    expect(within(dialog).getByText('Name is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a type')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a valid outstanding amount')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Name/), 'Example Home Loan');
    await user.selectOptions(within(dialog).getByLabelText(/Type/), 'Home Loan');
    expect(within(dialog).getByLabelText(/Owed by/)).toHaveDisplayValue('Person A'); // only member, pre-selected
    await user.type(within(dialog).getByLabelText(/Outstanding/), '2,00,000');
    await user.click(within(dialog).getByRole('button', { name: 'Add liability' }));
    await waitFor(() => expect(screen.getByTestId('liabilities-total')).toHaveTextContent('₹2,00,000'));

    await user.click(screen.getByRole('button', { name: 'Edit Example Home Loan' }));
    dialog = screen.getByRole('dialog', { name: 'Edit liability' });
    const amount = within(dialog).getByLabelText(/Outstanding/);
    await user.clear(amount);
    await user.type(amount, '150000');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByTestId('liabilities-total')).toHaveTextContent('₹1,50,000'));

    await user.click(screen.getByRole('button', { name: 'Delete Example Home Loan' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('No liabilities')).toBeInTheDocument();
  });

  it('Phase 8 acceptance: a fake loan’s EMI, interest/principal split, net worth impact and debt reduction', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T10:00:00'));
    try {
      const a = await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true });
      await createAsset({
        name: 'Example FD',
        assetClass: 'Fixed Income',
        valuationMethod: 'manual',
        currentValue: 2500000,
        valuationDate: '2026-01-01',
        liquidity: 'semi-liquid',
        owners: [{ familyMemberId: a.id, percentage: 100 }],
      });
      const user = userEvent.setup();
      renderApp('/liabilities');

      await user.click(await screen.findByRole('button', { name: 'Add a liability' }));
      const dialog = screen.getByRole('dialog', { name: 'Add liability' });
      await user.type(within(dialog).getByLabelText(/Name/), 'Example Car Loan');
      await user.selectOptions(within(dialog).getByLabelText(/Type/), 'Car Loan');
      await user.type(within(dialog).getByLabelText(/Outstanding/), '10,00,000');
      await user.type(within(dialog).getByLabelText(/Interest rate/), '10');

      // An EMI that doesn't cover the interest is rejected
      await user.type(within(dialog).getByLabelText(/Monthly EMI/), '8000');
      await user.click(within(dialog).getByRole('button', { name: 'Add liability' }));
      expect(within(dialog).getByText(/EMI must be more than the monthly interest of ₹8,333.33/)).toBeInTheDocument();

      // Leave EMI blank: it is worked out from the months left
      await user.clear(within(dialog).getByLabelText(/Monthly EMI/));
      await user.type(within(dialog).getByLabelText(/Remaining months/), '60');
      expect(within(dialog).getByTestId('loan-preview')).toHaveTextContent(
        'EMI ₹21,247.04 · Debt-free by Oct 2031 (60 months) · Total interest ₹2,74,822.84',
      );
      await user.click(within(dialog).getByRole('button', { name: 'Add liability' }));

      await waitFor(() => expect(screen.getByTestId('total-emi')).toHaveTextContent('₹21,247.04'));
      expect(screen.getByTestId('liabilities-total')).toHaveTextContent('₹10,00,000');

      // Details: interest/principal split and schedule
      await user.click(screen.getByRole('button', { name: 'Example Car Loan' }));
      const details = screen.getByRole('dialog', { name: 'Example Car Loan' });
      expect(details).toHaveTextContent('This month₹8,333.33 interest · ₹12,913.71 principal');
      expect(details).toHaveTextContent('Debt-free byOct 2031');
      const schedule = within(details).getByRole('table', { name: 'Repayment schedule' });
      expect(schedule.querySelectorAll('tbody tr')).toHaveLength(5);
      expect(schedule.querySelector('tbody tr')).toHaveTextContent('Year 1');
      expect(schedule.querySelector('tbody tr:last-child')).toHaveTextContent('₹0');
      await user.click(within(details).getByRole('radio', { name: 'By month' }));
      expect(schedule.querySelectorAll('tbody tr')).toHaveLength(60);
      await user.keyboard('{Escape}');

      // Net worth impact on the dashboard
      await user.click(screen.getByRole('link', { name: 'Dashboard' }));
      await waitFor(() => expect(screen.getByTestId('net-worth')).toHaveTextContent('₹15,00,000'));

      // Projected debt reduction: after 1 year ₹8,37,732 is left; after 5 years nothing
      await user.click(screen.getByRole('link', { name: 'Projections' }));
      await user.click(await screen.findByRole('radio', { name: '1Y' }));
      expect(screen.getByTestId('projected-debt')).toHaveTextContent('₹8,37,732');
      expect(screen.getByTestId('projected-net-worth')).toHaveTextContent('₹16,62,268');
      await user.click(screen.getByRole('radio', { name: '5Y' }));
      expect(screen.getByTestId('projected-debt')).toHaveTextContent('₹0');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps simple liabilities without loan terms, flat in projections', async () => {
    const a = await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true });
    await createLiability({ name: 'Example Card', type: 'Credit Card', ownerId: a.id, currentOutstanding: 25000 });
    const user = userEvent.setup();
    renderApp('/liabilities');
    await user.click(await screen.findByRole('button', { name: 'Example Card' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Add the interest rate and the EMI');
  });
});
