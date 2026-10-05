import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { buildDemoData } from '../services/demo/demoData';
import { backupToTabs, readSaveId, tabsToBackup } from '../services/google/sheetFormat';
import { exportBackup } from '../services/storage/backupRepository';
import { loadDemoData } from '../services/storage/demoRepository';
import { createFamilyMember, listFamilyMembers } from '../services/storage/familyMemberRepository';
import { fakeAuth, fakeDrive } from '../test/fakeGoogle';
import { AppRoutes } from './AppRoutes';
import { SettingsProvider } from './SettingsContext';
import { StartGate } from './StartGate';
import { AUTOSAVE_DELAY_MS, SyncProvider } from './SyncContext';

const SAVE_WAIT = { timeout: AUTOSAVE_DELAY_MS + 2500 };
const addMember = (name: string) => createFamilyMember({ name, relationship: 'Other', isActive: true });

/** Renders the app, connects to a (new, empty) Google Sheet and waits until connected. */
async function connectedApp(path = '/family') {
  const drive = fakeDrive();
  const auth = fakeAuth();
  const user = userEvent.setup();
  render(
    <SettingsProvider>
      <SyncProvider auth={auth} createClient={() => drive.client}>
        <MemoryRouter initialEntries={[path]}>
          <StartGate>
            <AppRoutes />
          </StartGate>
        </MemoryRouter>
      </SyncProvider>
    </SettingsProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Connect Google Sheet' }));
  await screen.findAllByText(/Saved to Google Sheet/);
  const fileId = drive.files[0]!.id;
  const sheetMembers = () => {
    const parsed = tabsToBackup(drive.sheets[fileId]!);
    return parsed.ok ? parsed.backup.data.familyMembers.map((m) => m.name).sort() : null;
  };
  return { drive, auth, user, fileId, sheetMembers, writes: () => (drive.client.writeTabs as ReturnType<typeof vi.fn>).mock.calls.length };
}

describe('Auto-save to Google Sheet', () => {
  it('saves every change within a few seconds, and a burst of changes as one save', async () => {
    const { writes, sheetMembers } = await connectedApp();
    expect(writes()).toBe(1); // the first connect
    await addMember('Person A');
    await addMember('Person B');
    await addMember('Person C');
    expect(await screen.findByText('Saving…')).toBeInTheDocument();
    await waitFor(() => expect(sheetMembers()).toEqual(['Person A', 'Person B', 'Person C']), SAVE_WAIT);
    expect(writes()).toBe(2);
    expect(screen.getAllByText(/Saved to Google Sheet/).length).toBeGreaterThan(0);
  });

  it('saves changes made through the pages too (settings included)', async () => {
    const { user, sheetMembers, drive, fileId } = await connectedApp();
    await user.click(await screen.findByRole('button', { name: 'Add your first member' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Name/), 'Person A');
    await user.click(within(dialog).getByRole('button', { name: 'Add member' }));
    await waitFor(() => expect(sheetMembers()).toEqual(['Person A']), SAVE_WAIT);
    expect(drive.sheets[fileId]!.Settings!.length).toBeGreaterThan(1);
  });

  it('stops and asks when the sheet was saved from another device meanwhile', async () => {
    const { drive, fileId, writes, user } = await connectedApp();
    // Another device saves different data.
    await loadDemoData(buildDemoData());
    const otherDevice = backupToTabs(await exportBackup(), 'phone-save');
    for (const t of otherDevice) drive.sheets[fileId]![t.title] = t.rows;
    await addMember('Person C'); // ...while this browser also changes: the copies now differ
    const dialog = await screen.findByRole('alertdialog', { name: 'Your Google Sheet was changed on another device' }, SAVE_WAIT);
    expect(writes()).toBe(1); // nothing overwritten
    expect(readSaveId(drive.sheets[fileId]!.About)).toBe('phone-save');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getAllByText(/changed on another device/).length).toBeGreaterThan(0);
    await addMember('Person D'); // more local changes: still not saved while in conflict
    await new Promise((r) => setTimeout(r, AUTOSAVE_DELAY_MS + 300));
    expect(writes()).toBe(1);

    await user.click(screen.getAllByRole('button', { name: /Choose|Changed elsewhere/ })[0]!);
    await user.click(await screen.findByRole('button', { name: 'Use the Google Sheet (replace this browser)' }));
    await waitFor(async () => expect((await listFamilyMembers()).map((m) => m.name).sort()).toEqual(['Person A', 'Person B']));
    expect(writes()).toBe(1);
    // Loading the sheet's data is not itself a change to save back.
    await new Promise((r) => setTimeout(r, AUTOSAVE_DELAY_MS + 300));
    expect(writes()).toBe(1);
  }, 20000);

  it('keeps changes in the browser when the Google sign-in expired, and saves them after signing in', async () => {
    const { auth, sheetMembers, user } = await connectedApp();
    auth.expire();
    await addMember('Person A');
    const signIn = await screen.findByRole('button', { name: /Sign in to Google|Sign in to save/ });
    expect(sheetMembers()).toEqual([]);
    await user.click(signIn);
    await waitFor(() => expect(sheetMembers()).toEqual(['Person A']), SAVE_WAIT);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(); // sheet unchanged meanwhile: no question needed
  });

  it('shows a failed save with Retry, keeping the change', async () => {
    const { drive, sheetMembers, user } = await connectedApp();
    (drive.client.writeTabs as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await addMember('Person A');
    expect(await screen.findByRole('alert', {}, SAVE_WAIT)).toHaveTextContent('Not saved to Google Sheet. Could not reach Google');
    await user.click(screen.getAllByRole('button', { name: /Retry/ })[0]!);
    await waitFor(() => expect(sheetMembers()).toEqual(['Person A']), SAVE_WAIT);
  });

  it('disconnecting can also delete this browser’s copy, leaving the sheet untouched', async () => {
    const { user, sheetMembers, writes } = await connectedApp('/data');
    await addMember('Person A');
    await waitFor(() => expect(sheetMembers()).toEqual(['Person A']), SAVE_WAIT);
    await user.click(screen.getByRole('button', { name: 'Disconnect…' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Disconnect Google Sheet?' });
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
    await waitFor(async () => expect(await listFamilyMembers()).toEqual([]));
    expect(sheetMembers()).toEqual(['Person A']);
    // Browser-only now: changes are not sent anywhere.
    await addMember('Person B');
    await new Promise((r) => setTimeout(r, AUTOSAVE_DELAY_MS + 300));
    expect(writes()).toBe(2);
  });
});
