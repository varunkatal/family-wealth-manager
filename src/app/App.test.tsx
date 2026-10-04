import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { getSettings } from '../services/storage/settingsRepository';
import { AppRoutes } from './AppRoutes';
import { SettingsProvider } from './SettingsContext';

function renderApp(path = '/') {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </SettingsProvider>,
  );
}

describe('App shell', () => {
  it('renders the dashboard with navigation and disclaimer', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByText(/not guaranteed returns or financial advice/)).toBeInTheDocument();
  });

  it('navigates between Dashboard and Settings', async () => {
    const user = userEvent.setup();
    renderApp();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('link', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    await user.click(within(nav).getByRole('link', { name: 'Dashboard' }));
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('loads a route directly (as on refresh)', async () => {
    renderApp('/settings');
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('shows a not-found page for unknown routes', () => {
    renderApp('/nope');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('opens and closes the mobile menu', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('navigation', { name: 'Mobile' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).not.toBeInTheDocument();
  });

  it('changes theme and persists it', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    const dark = screen.getByRole('radio', { name: 'Dark' });
    await waitFor(() => expect(dark).toBeEnabled());
    await user.click(dark);
    expect(document.documentElement).toHaveClass('dark');
    await waitFor(async () => expect((await getSettings()).theme).toBe('dark'));
  });
});
