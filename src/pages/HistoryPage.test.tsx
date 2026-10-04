import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAsset, updateAsset } from '../services/storage/assetRepository';
import { createFamilyMember } from '../services/storage/familyMemberRepository';
import { addManualSnapshot } from '../services/storage/historyRepository';
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

const fund = {
  name: 'Example Equity Fund',
  assetClass: 'Equity',
  valuationMethod: 'manual' as const,
  valuationDate: '2026-01-01',
  liquidity: 'liquid' as const,
};

const tableRows = (name: string) =>
  [...screen.getByRole('table', { name }).querySelectorAll('tbody tr')].map((r) => [...r.querySelectorAll('th,td')].map((c) => c.textContent));

describe('History page (Phase 12 acceptance)', () => {
  it('fake snapshots: changes, percentages, month over month and chart come from history', async () => {
    const user = userEvent.setup();
    renderApp('/history');
    expect(await screen.findByText('No snapshots yet')).toBeInTheDocument();

    for (const [date, assets, liabilities] of [
      ['2026-07-01', '10,00,000', '0'],
      ['2026-08-01', '11,00,000', '0'],
      ['2026-08-20', '12,00,000', '1,00,000'],
      ['2026-09-01', '13,20,000', '1,10,000'],
    ] as const) {
      await user.click(screen.getByRole('button', { name: 'Add past snapshot' }));
      const dialog = screen.getByRole('dialog', { name: 'Add past snapshot' });
      await user.type(within(dialog).getByLabelText(/Date/), date);
      await user.type(within(dialog).getByLabelText(/Total assets/), assets);
      await user.type(within(dialog).getByLabelText(/Total liabilities/), liabilities);
      await user.click(within(dialog).getByRole('button', { name: 'Add snapshot' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    }

    // Latest: ₹12,10,000, up ₹1,10,000 (10%) from ₹11,00,000
    expect(screen.getByTestId('latest-net-worth')).toHaveTextContent('₹12,10,000');
    expect(screen.getByTestId('latest-change')).toHaveTextContent('+₹1,10,000 +10.0%');
    expect(tableRows('Snapshots').map((r) => [r[0]!.replace('Entered', ''), r[3], r[4]])).toEqual([
      ['1 Sept 2026', '₹12,10,000', '+₹1,10,000+10.0%'],
      ['20 Aug 2026', '₹11,00,000', '+₹0+0.0%'],
      ['1 Aug 2026', '₹11,00,000', '+₹1,00,000+10.0%'],
      ['1 Jul 2026', '₹10,00,000', '——'],
    ]);
    // Month over month uses the latest snapshot in each month
    expect(tableRows('Month over month')).toEqual([
      ['Sept 2026', '₹12,10,000', '+₹1,10,000', '+10.0%'],
      ['Aug 2026', '₹11,00,000', '+₹1,00,000', '+10.0%'],
      ['Jul 2026', '₹10,00,000', '—', '—'],
    ]);
    // The chart plots the 4 historical values
    const chart = screen.getByRole('img', { name: /^Net worth across 4 snapshots/ });
    expect(chart.querySelector('polyline')!.getAttribute('points')!.split(' ')).toHaveLength(4);
  });

  it('a saved snapshot keeps its values when current values change', async () => {
    const asset = await createAsset({ ...fund, currentValue: 1000000, owners: [{ familyMemberId: A, percentage: 100 }] });
    const user = userEvent.setup();
    renderApp('/history');
    await user.click(await screen.findByRole('button', { name: 'Save wealth snapshot' }));
    expect(await screen.findByText(/Snapshot saved: net worth ₹10,00,000/)).toBeInTheDocument();

    vi.setSystemTime(new Date('2026-10-05T11:00:00')); // saved later the same day
    await updateAsset(asset.id, { ...fund, currentValue: 1250000, valuationDate: '2026-10-01', owners: [{ familyMemberId: A, percentage: 100 }] });
    await user.click(screen.getByRole('button', { name: 'Save wealth snapshot' }));
    await waitFor(() => expect(screen.getByTestId('latest-net-worth')).toHaveTextContent('₹12,50,000'));
    const rows = tableRows('Snapshots');
    expect(rows.map((r) => r[3])).toEqual(['₹12,50,000', '₹10,00,000']); // the old snapshot is unchanged
    expect(rows[0]![4]).toBe('+₹2,50,000+25.0%');

    // Asset value history recorded both values; add a manual past value
    const history = () => tableRows('Example Equity Fund value history').map((r) => [r[0], r[1]]);
    expect(history()).toEqual([
      ['1 Oct 2026', '₹12,50,000'],
      ['1 Jan 2026', '₹10,00,000'],
    ]);
    await user.click(screen.getByRole('button', { name: 'Add past value' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Date/), '2025-06-30');
    await user.type(within(dialog).getByLabelText(/Value/), '8,00,000');
    await user.click(within(dialog).getByRole('button', { name: 'Add value' }));
    await waitFor(() => expect(history()).toHaveLength(3));
    expect(tableRows('Example Equity Fund value history')[1]![2]).toBe('+₹2,00,000 +25.0%'); // 8L → 10L
  });

  it('deletes a snapshot after confirmation', async () => {
    await addManualSnapshot({ date: '2026-01-01', totalAssets: 500000, totalLiabilities: 0 });
    const user = userEvent.setup();
    renderApp('/history');
    await user.click(await screen.findByRole('button', { name: 'Delete snapshot of 1 Jan 2026' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('No snapshots yet')).toBeInTheDocument();
  });
});
