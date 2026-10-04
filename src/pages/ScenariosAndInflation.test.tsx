import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AssetInput } from '../models/asset';
import { DEFAULT_SETTINGS } from '../models/settings';
import { createAsset } from '../services/storage/assetRepository';
import { createFamilyMember } from '../services/storage/familyMemberRepository';
import { getSettings, saveSettings } from '../services/storage/settingsRepository';
import { renderApp } from '../test/renderApp';

let A = '';
beforeEach(async () => {
  A = (await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true })).id;
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

const comparison = () =>
  [...screen.getByRole('table', { name: 'Scenario comparison' }).querySelectorAll('tbody tr')].map((r) =>
    [...r.querySelectorAll('th,td')].map((c) => c.textContent),
  );

describe('Phase 9: scenarios and inflation', () => {
  it('asset-level scenario rates drive each scenario, and the comparison table reconciles', async () => {
    await asset({
      name: 'Example Equity Fund',
      currentValue: 1000000,
      conservativeGrowthRate: 8,
      baseGrowthRate: 10,
      optimisticGrowthRate: 12,
    });
    const user = userEvent.setup();
    renderApp('/projections');

    await waitFor(() => expect(screen.getByTestId('projected-total')).toHaveTextContent('₹25,93,742'));
    expect(comparison()).toEqual([
      ['Today', '₹10,00,000', '₹10,00,000', '₹10,00,000'],
      ['5 years', '₹14,69,328', '₹16,10,510', '₹17,62,342'],
      ['10 years', '₹21,58,925', '₹25,93,742', '₹31,05,848'],
      ['20 years', expect.any(String), expect.any(String), expect.any(String)],
    ]);

    await user.click(screen.getByRole('radio', { name: 'Conservative' }));
    expect(screen.getByTestId('projected-total')).toHaveTextContent('₹21,58,925');
    expect(screen.getByRole('table', { name: 'Projection by asset' })).toHaveTextContent('8%');
    await user.click(screen.getByRole('radio', { name: 'Optimistic' }));
    expect(screen.getByTestId('projected-total')).toHaveTextContent('₹31,05,848');

    // Chart: one line per scenario with a legend
    expect(screen.getByRole('img', { name: /Projected net worth by scenario over 10 years/ })).toBeInTheDocument();
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(within(legend).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Conservative', 'Base', 'Optimistic']);
    expect(document.querySelectorAll('svg polyline')).toHaveLength(3);
  });

  it("shows today's purchasing power using the inflation rate", async () => {
    await asset({ name: 'Example Equity Fund', currentValue: 1000000, baseGrowthRate: 10 });
    const user = userEvent.setup();
    renderApp('/projections');
    // ₹25,93,742 / 1.06^10
    await waitFor(() => expect(screen.getByTestId('projected-real')).toHaveTextContent('₹14,48,332'));
    expect(screen.getByTestId('projected-total')).toHaveTextContent('₹25,93,742'); // nominal stays

    await user.click(screen.getByRole('radio', { name: "Today's money" }));
    const rows = [...screen.getByRole('table', { name: 'Family total by year' }).querySelectorAll('tbody tr')];
    expect(rows[0]).toHaveTextContent('₹10,00,000'); // today is unchanged
    expect(rows[10]).toHaveTextContent('₹14,48,332');
    expect(comparison()[2]![2]).toBe('₹14,48,332');
  });

  it('uses Settings class defaults for assets without their own scenario rate', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, classDefaults: { 'Fixed Income': { conservative: 6 } } });
    await asset({ name: 'Example Equity Fund', currentValue: 1000000, conservativeGrowthRate: 8, baseGrowthRate: 10 });
    await asset({ name: 'Example FD', assetClass: 'Fixed Income', currentValue: 500000, baseGrowthRate: 7 });
    const user = userEvent.setup();
    renderApp('/projections');
    await user.click(await screen.findByRole('radio', { name: 'Conservative' }));
    expect(screen.getByTestId('projected-total')).toHaveTextContent('₹30,54,349');
    expect(screen.getByRole('table', { name: 'Projection by asset' })).toHaveTextContent('6%class default');

    // Optimistic: neither asset has a rate nor a default → flagged and held flat
    await user.click(screen.getByRole('radio', { name: 'Optimistic' }));
    expect(screen.getByRole('status')).toHaveTextContent('2 assets have no Optimistic growth rate');
    expect(screen.getByTestId('projected-total')).toHaveTextContent('₹15,00,000');
  });
});

describe('Settings: projection assumptions', () => {
  it('validates, saves and persists inflation and class defaults', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    const inflation = await screen.findByLabelText(/Inflation/);
    expect(inflation).toHaveValue('6');

    await user.clear(inflation);
    await user.type(inflation, '80');
    await user.type(screen.getByLabelText('Equity Conservative rate'), '12');
    await user.type(screen.getByLabelText('Equity Base rate'), '10');
    await user.click(screen.getByRole('button', { name: 'Save assumptions' }));
    expect(screen.getByText('Enter an inflation rate from 0% to 50%')).toBeInTheDocument();
    expect(screen.getByText('Use Conservative ≤ Base ≤ Optimistic')).toBeInTheDocument();
    expect((await getSettings()).inflationRate).toBe(6); // nothing saved

    await user.clear(inflation);
    await user.type(inflation, '5');
    await user.clear(screen.getByLabelText('Equity Conservative rate'));
    await user.type(screen.getByLabelText('Equity Conservative rate'), '8');
    await user.click(screen.getByRole('button', { name: 'Save assumptions' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    const stored = await getSettings();
    expect(stored.inflationRate).toBe(5);
    expect(stored.classDefaults).toEqual({ Equity: { conservative: 8, base: 10 } });
  });

  it('a changed inflation rate updates projections', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, inflationRate: 5 });
    await asset({ name: 'Example Equity Fund', currentValue: 1000000, baseGrowthRate: 10 });
    renderApp('/projections');
    await waitFor(() => expect(screen.getByTestId('projected-real')).toHaveTextContent('₹15,92,333'));
  });
});
