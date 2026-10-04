import { screen, waitFor } from '@testing-library/react';
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
