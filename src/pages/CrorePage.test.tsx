import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AssetInput } from '../models/asset';
import { createAsset } from '../services/storage/assetRepository';
import { createContribution } from '../services/storage/contributionRepository';
import { createFamilyMember } from '../services/storage/familyMemberRepository';
import { getSettings } from '../services/storage/settingsRepository';
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

const asset = (o: Partial<AssetInput> & { name: string; currentValue: number }) =>
  createAsset({
    assetClass: 'Equity',
    valuationMethod: 'manual',
    valuationDate: '2026-01-01',
    liquidity: 'liquid',
    owners: [{ familyMemberId: A, percentage: 100 }],
    ...o,
  });
const fund = () => asset({ name: 'Example Equity Fund', currentValue: 1000000, conservativeGrowthRate: 10, baseGrowthRate: 12, optimisticGrowthRate: 14 });
const property = () =>
  asset({ name: 'Example Property', assetClass: 'Real Estate', currentValue: 5000000, liquidity: 'illiquid', baseGrowthRate: 8 });

const headline = () => screen.getByTestId('plan-headline');
const field = (name: string) => screen.getByRole('textbox', { name });

describe('₹1 Cr Planner page', () => {
  it('works from ₹0 with no assets, using a 12% return until one is typed', async () => {
    renderApp('/crore');
    expect(await screen.findByText(/No assets yet, so the plan starts from ₹0/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /₹1 Cr Planner/ }).length).toBeGreaterThan(0);
    // ₹1 Cr × 0.01 / (1.01^120 − 1) ≈ ₹43,471 a month
    expect(headline()).toHaveTextContent('Invest ₹43,471/month for 10 yr at 12% → ₹1 Crore by Oct 2036.');
  });

  it('solves for monthly, years and return; faster options; ticking assets; persists', async () => {
    const user = userEvent.setup();
    await fund();
    await property();
    renderApp('/crore');

    // Monthly: ₹10L start, 10 years at 12% (the fund's rate) → ≈ ₹29,970 a month
    expect(await screen.findByRole('checkbox', { name: 'Example Property' })).not.toBeChecked();
    expect(screen.getByTestId('starting-corpus')).toHaveTextContent('₹10,00,000');
    expect(headline()).toHaveTextContent(/Invest ₹29,9[67]\d\/month for 10 yr at 12% → ₹1 Crore by Oct 2036/);
    expect(field('Monthly investment (₹)')).toHaveValue(headline().textContent!.match(/₹[\d,]+/)![0]);

    const options = screen.getByRole('table', { name: 'Monthly investment needed by plan length' });
    const rows = within(options).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(6);
    expect(rows[3]).toHaveTextContent(/10 yrs\s*Your plan/);

    // Pick 7 years: more per month
    await user.clear(field('Years'));
    await user.type(field('Years'), '7');
    await waitFor(() => expect(headline()).toHaveTextContent(/for 7 yr at 12% → ₹1 Crore by Oct 2033/));
    expect(rows[2]).toHaveTextContent('Your plan');

    // Years: the monthly amount just worked out carries over, so it takes ~7 years
    await user.click(screen.getByRole('radio', { name: 'Years' }));
    expect(headline()).toHaveTextContent(/\/month at 12% reaches ₹1 Crore in (6 yr 11 mo|7 yr)/);
    await user.clear(field('Monthly investment (₹)'));
    await user.type(field('Monthly investment (₹)'), '25000');
    await waitFor(() => expect(headline()).toHaveTextContent(/₹25,000\/month at 12% reaches ₹1 Crore in \d+ yr/));

    // Return: the 11 years just worked out carry over
    await user.click(screen.getByRole('radio', { name: 'Return %' }));
    expect(headline()).toHaveTextContent(/You need [\d.]+% a year to reach ₹1 Crore in 11 yr with ₹25,000\/month/);
    const rateBefore = parseFloat(headline().textContent!.match(/need ([\d.]+)%/)![1]!);

    // Ticking the property raises the start, so less return is needed
    await user.click(screen.getByRole('checkbox', { name: 'Example Property' }));
    expect(screen.getByTestId('starting-corpus')).toHaveTextContent('₹60,00,000');
    const rateAfter = parseFloat(headline().textContent!.match(/need ([\d.]+)%/)![1]!);
    expect(rateAfter).toBeLessThan(rateBefore);

    await waitFor(async () => {
      const saved = (await getSettings()).crorePlanner;
      expect(saved.solveFor).toBe('return');
      expect(saved.selectedAssetIds).toHaveLength(2);
    });
    cleanup();
    renderApp('/crore');
    expect(await screen.findByRole('checkbox', { name: 'Example Property' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Return %' })).toBeChecked();
    expect(field('Monthly investment (₹)')).toHaveValue('25000');
  });

  it('starts the monthly amount from saved SIPs; unreachable plans say so', async () => {
    const user = userEvent.setup();
    const f = await fund();
    await createContribution({ name: 'Example SIP', ownerId: A, linkedAssetId: f.id, amount: 15000, frequency: 'monthly', startDate: '2026-11-01' });
    renderApp('/crore');
    expect(await screen.findByTestId('existing-sips')).toHaveTextContent('₹15,000/mo');

    await user.click(screen.getByRole('radio', { name: 'Years' }));
    expect(headline()).toHaveTextContent(/₹(15,000|[\d,]+)\/month at 12% reaches ₹1 Crore in/);

    await user.click(screen.getByRole('radio', { name: 'Return %' }));
    await user.clear(field('Years'));
    await user.type(field('Years'), '1');
    await user.clear(field('Monthly investment (₹)'));
    await user.type(field('Monthly investment (₹)'), '100');
    await waitFor(() => expect(headline()).toHaveTextContent('Not reachable in 1 yr even at 100% a year.'));
  });
});
