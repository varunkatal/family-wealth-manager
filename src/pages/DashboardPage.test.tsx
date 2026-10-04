import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAsset } from '../services/storage/assetRepository';
import { createFamilyMember } from '../services/storage/familyMemberRepository';
import { createLiability } from '../services/storage/liabilityRepository';
import { renderApp } from '../test/renderApp';

const asset = (name: string, value: number, owners: { familyMemberId: string; percentage: number }[]) =>
  createAsset({
    name,
    assetClass: 'Fixed Income',
    valuationMethod: 'manual',
    currentValue: value,
    valuationDate: '2026-01-01',
    liquidity: 'semi-liquid',
    owners,
  });

describe('Dashboard totals', () => {
  it('shows zero totals and a getting-started hint with no data', async () => {
    renderApp('/');
    await waitFor(() => expect(screen.getByTestId('net-worth')).toHaveTextContent('₹0'));
    expect(screen.getByText(/Start by adding your/)).toBeInTheDocument();
  });

  it('spec Test 3: ₹10,00,000 + ₹5,00,000 assets, ₹2,00,000 liability → net worth ₹13,00,000', async () => {
    const a = await createFamilyMember({ name: 'Person A', relationship: '', isActive: true });
    const b = await createFamilyMember({ name: 'Person B', relationship: '', isActive: true });
    await asset('Example FD', 1000000, [
      { familyMemberId: a.id, percentage: 50 },
      { familyMemberId: b.id, percentage: 50 },
    ]);
    await asset('Example Bond', 500000, [{ familyMemberId: b.id, percentage: 100 }]);
    await createLiability({ name: 'Loan', type: 'Personal Loan', ownerId: a.id, currentOutstanding: 200000 });

    renderApp('/');
    await waitFor(() => expect(screen.getByTestId('total-assets')).toHaveTextContent('₹15,00,000'));
    expect(screen.getByTestId('total-liabilities')).toHaveTextContent('₹2,00,000');
    expect(screen.getByTestId('net-worth')).toHaveTextContent('₹13,00,000');
  });
});

describe('Phase 5 dashboard', () => {
  const nav = () => screen.getByRole('navigation', { name: 'Main' });

  async function loadDemo() {
    const { loadDemoData } = await import('../services/storage/demoRepository');
    const { buildDemoData } = await import('../services/demo/demoData');
    await loadDemoData(buildDemoData());
  }

  it('charts match their tables, and joint ownership is reflected', async () => {
    await loadDemo();
    renderApp('/');
    const allocation = await screen.findByRole('list', { name: 'Asset allocation by class' });

    // Every bar segment's value equals the matching table row
    const segments = within(allocation).getAllByRole('listitem').map((s) => s.getAttribute('aria-label'));
    const table = screen.getByRole('table', { name: 'Asset allocation by class' });
    const rows = [...table.querySelectorAll('tbody tr')]
      .map((r) => r as HTMLElement)
      .map((r) => {
        const [value, share] = within(r).getAllByRole('cell').map((c) => c.textContent);
        return `${within(r).getByRole('rowheader').textContent}: ${value}, ${Math.round(parseFloat(share!))}%`;
      });
    expect(segments).toEqual(rows);
    // Fixed class order (Equity, Fixed Income, Precious Metals, Real Estate, …), not ranked by size
    expect(segments).toEqual([
      'Equity: ₹5,00,000, 11%',
      'Fixed Income: ₹5,00,000, 11%',
      'Precious Metals: ₹10,00,000, 22%',
      'Real Estate: ₹25,00,000, 56%',
    ]);
    expect(within(table).getByText('Total assets').closest('tr')).toHaveTextContent('₹45,00,000');

    // Liquidity in liquid → illiquid order, reconciling to the total
    const liquidity = screen.getByRole('list', { name: 'Assets by liquidity' });
    expect(within(liquidity).getAllByRole('listitem').map((s) => s.getAttribute('aria-label'))).toEqual([
      'Liquid: ₹5,00,000, 11%',
      'Semi-liquid: ₹15,00,000, 33%',
      'Illiquid: ₹25,00,000, 56%',
    ]);

    // Joint ownership: the ₹25L property is split 50/50, the FD 60/40
    const memberBars = screen.getByRole('list', { name: 'Net worth by family member' });
    expect(within(memberBars).getByLabelText('Person A: ₹23,50,000')).toBeInTheDocument();
    expect(within(memberBars).getByLabelText('Person B: ₹19,50,000')).toBeInTheDocument();
    const personA = screen.getByRole('list', { name: 'Person A by asset class' });
    expect(within(personA).getAllByRole('listitem').map((s) => s.getAttribute('aria-label'))).toEqual([
      'Fixed Income: ₹3,00,000, 12%',
      'Precious Metals: ₹10,00,000, 39%',
      'Real Estate: ₹12,50,000, 49%',
    ]);

    // Top assets and recent changes
    const top = screen.getByRole('table', { name: 'Top assets' });
    expect(within(top).getAllByRole('rowheader')[0]).toHaveTextContent('Example Property');
    expect(screen.getByText('Recent changes')).toBeInTheDocument();
  });

  it('updates after adding, editing and deleting an asset', async () => {
    await loadDemo();
    const user = userEvent.setup();
    renderApp('/');
    await waitFor(() => expect(screen.getByTestId('total-assets')).toHaveTextContent('₹45,00,000'));

    // Edit: gold price 10,000 → 12,000 per g (100 g) adds ₹2,00,000
    await user.click(within(nav()).getByRole('link', { name: 'Assets' }));
    await user.click(await screen.findByRole('button', { name: 'Example Gold' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit' }));
    const price = within(screen.getByRole('dialog')).getByLabelText(/Price per unit/);
    await user.clear(price);
    await user.type(price, '12000');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(within(nav()).getByRole('link', { name: 'Dashboard' }));
    await waitFor(() => expect(screen.getByTestId('total-assets')).toHaveTextContent('₹47,00,000'));
    expect(screen.getByRole('list', { name: 'Asset allocation by class' })).toContainElement(
      screen.getByLabelText('Precious Metals: ₹12,00,000, 26%'),
    );
    const recent = screen.getByRole('heading', { name: 'Recent changes' }).closest('section')!;
    expect(within(recent).getByText('Example Gold').closest('li')).toHaveTextContent('Updated · Asset');

    // Add: a ₹3,00,000 cash asset owned by Person B
    await user.click(within(nav()).getByRole('link', { name: 'Assets' }));
    await user.click(await screen.findByRole('button', { name: 'Add asset' }));
    let dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Asset name/), 'Example Savings');
    await user.selectOptions(within(dialog).getByLabelText(/Asset class/), 'Cash');
    await user.type(within(dialog).getByLabelText(/Current value/), '300000');
    await user.click(within(dialog).getByRole('radio', { name: /^Liquid/ }));
    await user.selectOptions(within(dialog).getByLabelText('Owner 1'), 'Person B');
    await user.click(within(dialog).getByRole('button', { name: 'Add asset' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(within(nav()).getByRole('link', { name: 'Dashboard' }));
    await waitFor(() => expect(screen.getByTestId('total-assets')).toHaveTextContent('₹50,00,000'));
    expect(screen.getByLabelText('Person B: ₹22,50,000')).toBeInTheDocument();
    expect(screen.getByLabelText('Cash: ₹3,00,000, 6%')).toBeInTheDocument();

    // Delete it again
    await user.click(within(nav()).getByRole('link', { name: 'Assets' }));
    await user.click(await screen.findByRole('button', { name: 'Example Savings' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await user.click(within(nav()).getByRole('link', { name: 'Dashboard' }));
    await waitFor(() => expect(screen.getByTestId('total-assets')).toHaveTextContent('₹47,00,000'));
    expect(screen.queryByLabelText(/^Cash:/)).not.toBeInTheDocument();
  });

  it('shows a tooltip on keyboard focus', async () => {
    await loadDemo();
    const user = userEvent.setup();
    renderApp('/');
    await screen.findByRole('list', { name: 'Asset allocation by class' });
    await user.tab();
    while (!document.activeElement?.getAttribute('aria-label')?.startsWith('Real Estate')) await user.tab();
    expect(screen.getByRole('tooltip')).toHaveTextContent('₹25,00,000');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Real Estate');
  });
});
