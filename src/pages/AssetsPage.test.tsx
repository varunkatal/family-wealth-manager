import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../app/AppRoutes';
import { SettingsProvider } from '../app/SettingsContext';
import { closeDb } from '../services/storage/db';
import { saveSettings } from '../services/storage/settingsRepository';

type User = ReturnType<typeof userEvent.setup>;

function renderAssets() {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={['/assets']}>
        <AppRoutes />
      </MemoryRouter>
    </SettingsProvider>,
  );
}

const rowNames = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('button')[0]!.textContent);

async function addManualAsset(user: User, opts: { name: string; cls: string; value: string; liquidity: string; open: RegExp }) {
  await user.click(await screen.findByRole('button', { name: opts.open }));
  const dialog = screen.getByRole('dialog', { name: 'Add asset' });
  await user.type(within(dialog).getByLabelText(/Asset name/), opts.name);
  await user.selectOptions(within(dialog).getByLabelText(/Asset class/), opts.cls);
  await user.type(within(dialog).getByLabelText(/Current value/), opts.value);
  await user.click(within(dialog).getByRole('radio', { name: new RegExp(`^${opts.liquidity}`) }));
  await user.click(within(dialog).getByRole('button', { name: 'Add asset' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

describe('Assets page', () => {
  it('creates, views, edits, searches, filters and deletes assets, and persists them', async () => {
    const user = userEvent.setup();
    const { unmount } = renderAssets();

    // Create (shows Indian currency formatting)
    await addManualAsset(user, { name: 'Example FD', cls: 'Fixed Income', value: '500000', liquidity: 'Semi-liquid', open: /Add your first asset/ });
    expect(screen.getByRole('cell', { name: '₹5,00,000' })).toBeInTheDocument();

    // Create with a subcategory and the quantity × price method
    await user.click(screen.getByRole('button', { name: /^Add asset$/ }));
    let dialog = screen.getByRole('dialog', { name: 'Add asset' });
    await user.type(within(dialog).getByLabelText(/Asset name/), 'Example Gold');
    await user.selectOptions(within(dialog).getByLabelText(/Asset class/), 'Precious Metals');
    await user.selectOptions(within(dialog).getByLabelText('Subcategory'), 'Physical Gold');
    await user.click(within(dialog).getByRole('radio', { name: 'Quantity × price' }));
    await user.type(within(dialog).getByRole('textbox', { name: /^Quantity/ }), '100');
    await user.type(within(dialog).getByLabelText(/Price per unit/), '10000');
    expect(within(dialog).getByText('₹10,00,000')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: /^Semi-liquid/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add asset' }));
    await waitFor(() => expect(rowNames()).toEqual(['Example Gold', 'Example FD']));
    expect(screen.getByTestId('visible-total')).toHaveTextContent('₹15,00,000');

    // View details
    await user.click(screen.getByRole('button', { name: 'Example Gold' }));
    dialog = screen.getByRole('dialog', { name: 'Example Gold' });
    expect(within(dialog).getByText('Precious Metals › Physical Gold')).toBeInTheDocument();
    expect(within(dialog).getByText('100 units × ₹10,000')).toBeInTheDocument();

    // Edit from the details view
    await user.click(within(dialog).getByRole('button', { name: 'Edit' }));
    dialog = screen.getByRole('dialog', { name: 'Edit asset' });
    const price = within(dialog).getByLabelText(/Price per unit/);
    await user.clear(price);
    await user.type(price, '9000');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByTestId('visible-total')).toHaveTextContent('₹14,00,000'));

    // Search
    await user.type(screen.getByRole('searchbox', { name: 'Search assets' }), 'fd');
    expect(rowNames()).toEqual(['Example FD']);
    await user.clear(screen.getByRole('searchbox', { name: 'Search assets' }));

    // Filter
    await user.selectOptions(screen.getByLabelText('Filter by asset class'), 'Precious Metals');
    expect(rowNames()).toEqual(['Example Gold']);
    expect(screen.getByText(/Showing 1 of 2 assets/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filter by asset class'), '');

    // Delete needs confirmation
    await user.click(screen.getByRole('button', { name: 'Example FD' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(rowNames()).toEqual(['Example Gold']));

    // Refresh
    unmount();
    await closeDb();
    renderAssets();
    await waitFor(() => expect(rowNames()).toEqual(['Example Gold']));
  });

  it('supports a custom category', async () => {
    const user = userEvent.setup();
    renderAssets();
    await user.click(await screen.findByRole('button', { name: /Add your first asset/ }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Asset name/), 'Example Coin');
    await user.selectOptions(within(dialog).getByLabelText(/Asset class/), 'Custom…');
    await user.type(within(dialog).getByLabelText('Custom asset class'), 'Crypto');
    await user.type(within(dialog).getByLabelText(/Current value/), '25,000');
    await user.click(within(dialog).getByRole('radio', { name: /^Liquid/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add asset' }));
    await waitFor(() => expect(rowNames()).toEqual(['Example Coin']));
    expect(within(screen.getByLabelText('Filter by asset class')).getByRole('option', { name: 'Crypto' })).toBeInTheDocument();
  });

  it('shows validation errors and saves nothing', async () => {
    const user = userEvent.setup();
    renderAssets();
    await user.click(await screen.findByRole('button', { name: /Add your first asset/ }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Current value/), 'abc');
    await user.click(within(dialog).getByRole('button', { name: 'Add asset' }));
    expect(within(dialog).getByText('Asset name is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose an asset class')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a valid current value')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a liquidity level')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('No assets yet')).toBeInTheDocument();
  });

  it('loads demo data, labels it, and clears only demo data', async () => {
    const user = userEvent.setup();
    renderAssets();
    await addManualAsset(user, { name: 'My FD', cls: 'Fixed Income', value: '100000', liquidity: 'Semi-liquid', open: /Add your first asset/ });

    // The "Load demo" button is on the empty state, so clear and re-add order: delete then load
    await user.click(screen.getByRole('button', { name: 'My FD' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Load demo assets' }));
    await waitFor(() => expect(rowNames()).toHaveLength(4));
    expect(screen.getAllByText('Demo')).toHaveLength(4);
    expect(screen.getByText(/Includes/)).toHaveTextContent('Includes 4 demo assets');

    await addManualAsset(user, { name: 'My FD', cls: 'Fixed Income', value: '100000', liquidity: 'Semi-liquid', open: /^Add asset$/ });
    await user.click(screen.getByRole('button', { name: 'Clear demo data' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Clear demo data' }));
    await waitFor(() => expect(rowNames()).toEqual(['My FD']));
  });

  it('uses the lakh/crore number format when chosen in Settings', async () => {
    await saveSettings({ theme: 'system', numberFormat: 'compact' });
    const user = userEvent.setup();
    renderAssets();
    await addManualAsset(user, { name: 'Example Property', cls: 'Real Estate', value: '25,00,000', liquidity: 'Illiquid', open: /Add your first asset/ });
    expect(screen.getByRole('cell', { name: '₹25 Lakh' })).toBeInTheDocument();
  });
});
