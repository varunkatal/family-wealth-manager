import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../app/AppRoutes';
import { SettingsProvider } from '../app/SettingsContext';
import { buildDemoData } from '../services/demo/demoData';
import { listAssets } from '../services/storage/assetRepository';
import { createContribution } from '../services/storage/contributionRepository';
import { loadDemoData } from '../services/storage/demoRepository';
import { listFamilyMembers } from '../services/storage/familyMemberRepository';

function renderApp(path: string) {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </SettingsProvider>,
  );
}

describe('Family member details', () => {
  it('opens from the member’s name and shows their net worth, holdings with shares, loans and SIPs', async () => {
    await loadDemoData(buildDemoData());
    const a = (await listFamilyMembers()).find((m) => m.name === 'Person A')!;
    const gold = (await listAssets()).find((x) => x.name === 'Example Gold')!;
    await createContribution({ name: 'Example Gold SIP', ownerId: a.id, linkedAssetId: gold.id, amount: 5000, frequency: 'monthly', startDate: '2020-01-01' });

    const user = userEvent.setup();
    renderApp('/family');
    await user.click(await screen.findByRole('link', { name: 'Person A' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Person A' })).toBeInTheDocument();
    // Net worth = their share of assets (12,50,000 + 10,00,000 + 3,00,000) − their loan (2,00,000).
    expect(screen.getByText('₹23,50,000')).toBeInTheDocument();
    expect(screen.getAllByText('₹25,50,000').length).toBeGreaterThan(0);

    const table = screen.getByRole('table', { name: 'Assets owned by Person A' });
    const rows = within(table).getAllByRole('row').slice(1, -1); // without header and total
    expect(rows.map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))).toEqual([
      [expect.stringContaining('Example Property'), '50%', '₹12,50,000', '₹25,00,000'],
      [expect.stringContaining('Example Gold'), '100%', '₹10,00,000', '₹10,00,000'],
      [expect.stringContaining('Example FD'), '60%', '₹3,00,000', '₹5,00,000'],
    ]);
    expect(within(rows[0]!).getByText('Shared with Person B 50%')).toBeInTheDocument();
    expect(within(table).queryByText(/Example Equity Fund/)).not.toBeInTheDocument(); // owned by Person B only

    expect(screen.getByText('Example Home Loan')).toBeInTheDocument();
    expect(screen.getByText('Example Gold SIP')).toBeInTheDocument();
    expect(screen.getByText('Into Example Gold')).toBeInTheDocument();
    expect(screen.getAllByText('₹5,000').length).toBeGreaterThan(0); // investing per month

    await user.click(screen.getByRole('link', { name: '← Family' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Family' })).toBeInTheDocument();
  });

  it('shows a clear message for someone without assets, and for an unknown member', async () => {
    await loadDemoData(buildDemoData());
    const { createFamilyMember } = await import('../services/storage/familyMemberRepository');
    const c = await createFamilyMember({ name: 'Person C', relationship: 'Child', isActive: true });
    const { unmount } = renderApp(`/family/${c.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Person C' })).toBeInTheDocument();
    expect(screen.getByText(/doesn’t own any assets yet/)).toBeInTheDocument();
    expect(screen.getByText('No loans or other liabilities.')).toBeInTheDocument();
    unmount();

    renderApp('/family/no-such-id');
    expect(await screen.findByRole('heading', { name: 'Family member not found' })).toBeInTheDocument();
  });
});
