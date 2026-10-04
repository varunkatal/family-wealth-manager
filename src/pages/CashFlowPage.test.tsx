import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createExpense, createIncome } from '../services/storage/cashFlowRepository';
import { createContribution } from '../services/storage/contributionRepository';
import { createFamilyMember } from '../services/storage/familyMemberRepository';
import { createLiability } from '../services/storage/liabilityRepository';
import { renderApp } from '../test/renderApp';

let A = '';
let B = '';
beforeEach(async () => {
  A = (await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true })).id;
  B = (await createFamilyMember({ name: 'Person B', relationship: 'Spouse', isActive: true })).id;
});

const cell = (id: string) => screen.getByTestId(id).textContent;

describe('Cash flow page (Phase 10 acceptance)', () => {
  it('adds income and expenses and calculates monthly/annual totals and free cash flow', async () => {
    const user = userEvent.setup();
    renderApp('/cash-flow');

    // Income: Person A salary ₹1,00,000 a month
    await user.click(await screen.findByRole('button', { name: 'Add income' }));
    let dialog = screen.getByRole('dialog', { name: 'Add income' });
    await user.click(within(dialog).getByRole('button', { name: 'Add income' }));
    expect(within(dialog).getByText('Choose an income type')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose who earns this')).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText(/Income type/), 'Salary');
    await user.selectOptions(within(dialog).getByLabelText(/Earned by/), 'Person A');
    await user.type(within(dialog).getByLabelText(/Amount/), '1,00,000');
    await user.type(within(dialog).getByLabelText(/Growth/), '8');
    await user.click(within(dialog).getByRole('button', { name: 'Add income' }));
    await waitFor(() => expect(cell('monthly-income')).toBe('₹1,00,000'));

    // Income: Person B rent ₹2,40,000 a year = ₹20,000 a month
    await user.click(screen.getByRole('button', { name: 'Add income' }));
    dialog = screen.getByRole('dialog', { name: 'Add income' });
    await user.selectOptions(within(dialog).getByLabelText(/Income type/), 'Rent');
    await user.selectOptions(within(dialog).getByLabelText(/Earned by/), 'Person B');
    await user.type(within(dialog).getByLabelText(/Description/), 'Example flat');
    await user.type(within(dialog).getByLabelText(/Amount/), '240000');
    await user.selectOptions(within(dialog).getByLabelText(/How often/), 'Yearly');
    await user.click(within(dialog).getByRole('button', { name: 'Add income' }));
    await waitFor(() => expect(cell('monthly-income')).toBe('₹1,20,000'));
    expect(cell('annual-income')).toBe('₹14,40,000');

    // Expenses: groceries ₹15,000/month (family) and insurance ₹60,000/year (Person A)
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    dialog = screen.getByRole('dialog', { name: 'Add expense' });
    await user.selectOptions(within(dialog).getByLabelText(/Category/), 'Grocery');
    await user.type(within(dialog).getByLabelText(/Amount/), '15000');
    await user.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(cell('monthly-expenses')).toBe('₹15,000'));

    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    dialog = screen.getByRole('dialog', { name: 'Add expense' });
    await user.selectOptions(within(dialog).getByLabelText(/Category/), 'Insurance');
    await user.selectOptions(within(dialog).getByLabelText(/^For/), 'Person A');
    await user.type(within(dialog).getByLabelText(/Amount/), '60000');
    await user.selectOptions(within(dialog).getByLabelText(/How often/), 'Yearly');
    await user.click(within(dialog).getByRole('button', { name: 'Add expense' }));

    await waitFor(() => expect(cell('monthly-expenses')).toBe('₹20,000'));
    expect(cell('annual-expenses')).toBe('₹2,40,000');
    expect(cell('monthly-free-cash-flow')).toBe('₹1,00,000');
    expect(cell('annual-free-cash-flow')).toBe('₹12,00,000');

    // Family-member income
    const byMember = [...screen.getByRole('table', { name: 'Income by family member' }).querySelectorAll('tbody tr')].map((r) => r.textContent);
    expect(byMember).toEqual(['Person A₹1,00,000₹12,00,000', 'Person B₹20,000₹2,40,000']);

    // Edit and delete
    await user.click(screen.getByRole('button', { name: 'Edit Grocery' }));
    dialog = screen.getByRole('dialog', { name: 'Edit expense' });
    await user.clear(within(dialog).getByLabelText(/Amount/));
    await user.type(within(dialog).getByLabelText(/Amount/), '25000');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(cell('monthly-expenses')).toBe('₹30,000'));
    await user.click(screen.getByRole('button', { name: 'Delete Insurance' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(cell('monthly-expenses')).toBe('₹25,000'));

    // Persistence: a fresh load shows the same figures
    cleanup();
    renderApp('/cash-flow');
    await waitFor(() => expect(cell('monthly-free-cash-flow')).toBe('₹95,000'));
    expect(screen.getByRole('table', { name: 'Income' })).toHaveTextContent('Rent: Example flat');
  });

  it('keeps investments and EMIs out of expenses, and excludes inactive items', async () => {
    await createIncome({ memberId: A, type: 'Salary', amount: 100000, frequency: 'monthly' });
    await createIncome({ memberId: B, type: 'Salary', amount: 50000, frequency: 'monthly', endDate: '2020-12-31' }); // ended
    await createExpense({ category: 'Household', amount: 30000, frequency: 'monthly' });
    await createContribution({ name: 'Example SIP', ownerId: A, amount: 20000, frequency: 'monthly', startDate: '2020-01-01' });
    await createLiability({
      name: 'Example Car Loan',
      type: 'Car Loan',
      ownerId: A,
      currentOutstanding: 1000000,
      interestRate: 10,
      monthlyEMI: 21247.04,
    });
    renderApp('/cash-flow');
    await waitFor(() => expect(cell('monthly-income')).toBe('₹1,00,000'));
    expect(cell('monthly-expenses')).toBe('₹30,000'); // SIP and EMI are not expenses
    expect(cell('monthly-free-cash-flow')).toBe('₹70,000');
    expect(screen.getByTestId('left-over')).toHaveTextContent('₹28,752.96 a month'); // 70,000 − 20,000 − 21,247.04
    expect(screen.getByRole('row', { name: /Salary.*Person B/ })).toHaveTextContent('Ended');
  });

  it('shows a negative free cash flow', async () => {
    await createIncome({ memberId: A, type: 'Pension', amount: 20000, frequency: 'monthly' });
    await createExpense({ category: 'Medical', amount: 25000, frequency: 'monthly' });
    renderApp('/cash-flow');
    await waitFor(() => expect(cell('monthly-free-cash-flow')).toBe('-₹5,000'));
  });
});
