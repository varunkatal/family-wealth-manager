import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SettingsProvider } from '../app/SettingsContext';
import { AppRoutes } from '../app/AppRoutes';
import { closeDb } from '../services/storage/db';

function renderFamily() {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={['/family']}>
        <AppRoutes />
      </MemoryRouter>
    </SettingsProvider>,
  );
}

async function addMember(user: ReturnType<typeof userEvent.setup>, name: string, buttonName: RegExp) {
  await user.click(await screen.findByRole('button', { name: buttonName }));
  const dialog = screen.getByRole('dialog', { name: 'Add family member' });
  await user.type(within(dialog).getByLabelText(/Name/), name);
  await user.click(within(dialog).getByRole('button', { name: 'Add member' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

const memberNames = () =>
  within(screen.getByRole('list', { name: 'Family members' }))
    .getAllByRole('heading')
    .map((h) => h.textContent);

describe('Family page', () => {
  it('runs the Phase 2 acceptance flow: add A, add B, edit A, delete B, refresh', async () => {
    const user = userEvent.setup();
    const { unmount } = renderFamily();

    await addMember(user, 'Person A', /Add your first member/);
    await addMember(user, 'Person B', /^Add member$/);
    expect(memberNames()).toEqual(['Person A', 'Person B']);

    // Edit Person A
    await user.click(screen.getByRole('button', { name: 'Edit Person A' }));
    const edit = screen.getByRole('dialog', { name: 'Edit family member' });
    const name = within(edit).getByLabelText(/Name/);
    await user.clear(name);
    await user.type(name, 'Person A (edited)');
    await user.selectOptions(within(edit).getByLabelText('Relationship'), 'Self');
    await user.click(within(edit).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(memberNames()).toEqual(['Person A (edited)', 'Person B']));
    expect(screen.getByText('Self')).toBeInTheDocument();

    // Delete requires confirmation: cancelling keeps Person B
    await user.click(screen.getByRole('button', { name: 'Delete Person B' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(memberNames()).toContain('Person B');

    await user.click(screen.getByRole('button', { name: 'Delete Person B' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(memberNames()).toEqual(['Person A (edited)']));

    // Refresh: unmount, drop the DB connection, render again
    unmount();
    await closeDb();
    renderFamily();
    await waitFor(() => expect(memberNames()).toEqual(['Person A (edited)']));
  });

  it('shows an error and does not save when the name is empty', async () => {
    const user = userEvent.setup();
    renderFamily();
    await user.click(await screen.findByRole('button', { name: /Add your first member/ }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Name/), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Add member' }));
    expect(within(dialog).getByText('Name is required')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Name/)).toHaveAttribute('aria-invalid', 'true');
    await user.keyboard('{Escape}');
    expect(screen.getByText('No family members yet')).toBeInTheDocument();
  });

  it('filters by active / inactive status', async () => {
    const user = userEvent.setup();
    renderFamily();
    await addMember(user, 'Person A', /Add your first member/);

    await user.click(screen.getByRole('button', { name: /^Add member$/ }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Name/), 'Person B');
    await user.click(within(dialog).getByRole('checkbox', { name: /Active/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add member' }));
    await waitFor(() => expect(memberNames()).toEqual(['Person A', 'Person B']));

    await user.click(screen.getByRole('tab', { name: /inactive/i }));
    expect(memberNames()).toEqual(['Person B']);
    await user.click(screen.getByRole('tab', { name: /^active/i }));
    expect(memberNames()).toEqual(['Person A']);
  });
});
