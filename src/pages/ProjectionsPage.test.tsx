import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AssetInput } from '../models/asset';
import { createAsset } from '../services/storage/assetRepository';
import { createFamilyMember } from '../services/storage/familyMemberRepository';
import { renderApp } from '../test/renderApp';

let A = '';
let B = '';
beforeEach(async () => {
  A = (await createFamilyMember({ name: 'Person A', relationship: '', isActive: true })).id;
  B = (await createFamilyMember({ name: 'Person B', relationship: '', isActive: true })).id;
});

const asset = (o: Partial<AssetInput> & { name: string; currentValue: number }) =>
  createAsset({
    assetClass: 'Equity',
    valuationMethod: 'manual',
    valuationDate: '2026-01-01',
    liquidity: 'liquid',
    owners: [{ familyMemberId: A, percentage: 100 }],
    ...o,
  });

const tableRows = (name: string) =>
  [...screen.getByRole('table', { name }).querySelectorAll('tbody tr')].map((r) =>
    [...r.querySelectorAll('th,td')].map((c) => c.textContent),
  );

describe('Projections page', () => {
  it('spec test through the UI: ₹10,00,000 at 10% for 10 years → ₹25,93,742', async () => {
    await asset({ name: 'Example Fund', currentValue: 1000000, baseGrowthRate: 10 });
    renderApp('/projections');
    await waitFor(() => expect(screen.getByTestId('projected-total')).toHaveTextContent('₹25,93,742'));
    const rows = tableRows('Family total by year');
    expect(rows).toHaveLength(11); // today + 10 years
    expect(rows[0]).toEqual(['Today', '₹10,00,000', '—']);
    expect(rows[1]!.slice(1)).toEqual(['₹11,00,000', '+₹1,00,000']);
  });

  it('uses each asset’s own rate and the family share; switches periods', async () => {
    const user = userEvent.setup();
    await asset({ name: 'Example Equity', currentValue: 1000000, baseGrowthRate: 12 });
    await asset({
      name: 'Example FD',
      assetClass: 'Fixed Income',
      currentValue: 2000000,
      baseGrowthRate: 7,
      owners: [{ familyMemberId: B, percentage: 50 }], // family owns half: ₹10L
    });
    renderApp('/projections');

    await user.click(await screen.findByRole('radio', { name: '1Y' }));
    // 10L × 1.12 + 10L × 1.07 = 21.9L
    expect(screen.getByTestId('projected-total')).toHaveTextContent('₹21,90,000');
    expect(tableRows('Projection by asset')).toEqual([
      ['Example EquityEquity', '12%', '₹10,00,000', '₹11,20,000'],
      ['Example FDFixed Income', '7%', '₹10,00,000', '₹10,70,000'],
    ]);

    await user.click(screen.getByRole('radio', { name: '25Y' }));
    expect(tableRows('Family total by year')).toHaveLength(26);

    // Custom period with validation
    await user.click(screen.getByRole('radio', { name: 'Custom' }));
    const years = screen.getByLabelText('Custom number of years');
    await user.clear(years);
    await user.type(years, '0');
    expect(screen.getByText('Enter whole years from 1 to 50')).toBeInTheDocument();
    expect(screen.queryByTestId('projected-total')).not.toBeInTheDocument();
    await user.clear(years);
    await user.type(years, '2');
    // 10L × 1.12² + 10L × 1.07² = 12.544L + 11.449L
    expect(screen.getByTestId('projected-total')).toHaveTextContent('₹23,99,300');
  });

  it('shows the per-asset year table in the spec format', async () => {
    const user = userEvent.setup();
    await asset({ name: 'Example Fund', currentValue: 1000000, baseGrowthRate: 10 });
    renderApp('/projections');
    await user.click(await screen.findByRole('radio', { name: '3Y' }));
    await user.click(screen.getByRole('button', { name: 'Example Fund' }));
    const dialog = screen.getByRole('dialog', { name: 'Example Fund' });
    expect(within(dialog).getByRole('columnheader', { name: 'Asset value' })).toBeInTheDocument();
    expect(tableRows('Example Fund projection').map((r) => r.slice(1))).toEqual([
      ['₹10,00,000', '—'],
      ['₹11,00,000', '+₹1,00,000'],
      ['₹12,10,000', '+₹1,10,000'],
      ['₹13,31,000', '+₹1,21,000'],
    ]);
  });

  it('holds assets without a rate at today’s value and flags them', async () => {
    await asset({ name: 'Example Fund', currentValue: 1000000, baseGrowthRate: 10 });
    await asset({ name: 'Example Gold', assetClass: 'Precious Metals', currentValue: 500000 });
    renderApp('/projections');
    await waitFor(() => expect(screen.getByTestId('projected-total')).toHaveTextContent('₹30,93,742'));
    expect(screen.getByRole('status')).toHaveTextContent('1 asset has no Base growth rate');
    expect(screen.getByRole('status')).toHaveTextContent('Example Gold');
    expect(screen.getByText('No rate')).toBeInTheDocument();
  });

  it('explains what to do when there is nothing to project', async () => {
    renderApp('/projections');
    expect(await screen.findByText('Nothing to project yet')).toBeInTheDocument();
  });
});
