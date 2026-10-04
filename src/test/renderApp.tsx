import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../app/AppRoutes';
import { SettingsProvider } from '../app/SettingsContext';

/** Renders the whole app at a route, as a user would see it. */
export function renderApp(path = '/') {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </SettingsProvider>,
  );
}
