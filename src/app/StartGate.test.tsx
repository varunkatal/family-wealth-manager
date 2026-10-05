import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { buildDemoData } from '../services/demo/demoData';
import { backupToTabs } from '../services/google/sheetFormat';
import { readRememberedSheet, readStorageMode } from '../services/google/sheetSync';
import { deleteAllData, exportBackup } from '../services/storage/backupRepository';
import { loadDemoData } from '../services/storage/demoRepository';
import { createFamilyMember, listFamilyMembers } from '../services/storage/familyMemberRepository';
import { fakeAuth, fakeDrive } from '../test/fakeGoogle';
import { AppRoutes } from './AppRoutes';
import { SettingsProvider } from './SettingsContext';
import { StartGate } from './StartGate';
import { SyncProvider } from './SyncContext';
import type { GoogleAuth } from '../services/google/googleAuth';

function renderApp(drive = fakeDrive(), auth: GoogleAuth | null = fakeAuth(), path = '/family') {
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
  return { drive, auth };
}

async function sheetWithDemoData(drive: ReturnType<typeof fakeDrive>) {
  await loadDemoData(buildDemoData());
  const file = drive.seed(backupToTabs(await exportBackup(), 'other-device'));
  await deleteAllData();
  return file;
}

describe('Start screen and connecting Google', () => {
  it('asks where to keep data first, and remembers "this browser only"', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByRole('heading', { name: 'Family Wealth Calculator' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use in this browser only' }));
    expect(await screen.findByRole('heading', { name: 'Family' })).toBeInTheDocument();
    expect(screen.getAllByText('Stored on this device only').length).toBeGreaterThan(0);
    expect(readStorageMode()).toBe('browser');
  });

  it('disables Google when no Client ID is configured', () => {
    renderApp(fakeDrive(), null);
    expect(screen.getByRole('button', { name: 'Connect Google Sheet' })).toBeDisabled();
    expect(screen.getByText(/not set up for this copy/)).toBeInTheDocument();
  });

  it('creates the sheet on first connect and saves the (empty) browser data to it', async () => {
    const user = userEvent.setup();
    const { drive, auth } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Connect Google Sheet' }));
    expect(await screen.findByRole('heading', { name: 'Family' })).toBeInTheDocument();
    expect(auth!.signIn).toHaveBeenCalledTimes(1);
    expect(drive.client.createAppSpreadsheet).toHaveBeenCalledTimes(1);
    expect(drive.client.writeTabs).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/Saved to Google Sheet/).length).toBeGreaterThan(0);
    expect(readStorageMode()).toBe('google');
    expect(readRememberedSheet()?.spreadsheetId).toBe(drive.files[0]!.id);
  });

  it('loads an existing sheet into an empty browser (another device signing in)', async () => {
    const user = userEvent.setup();
    const drive = fakeDrive();
    await sheetWithDemoData(drive);
    renderApp(drive);
    await user.click(screen.getByRole('button', { name: 'Connect Google Sheet' }));
    expect(await screen.findByText('Person A')).toBeInTheDocument();
    expect(screen.getByText('Person B')).toBeInTheDocument();
    expect(drive.client.writeTabs).not.toHaveBeenCalled();
  });

  it('asks which copy to keep when both differ, and changes nothing on Cancel', async () => {
    const user = userEvent.setup();
    const drive = fakeDrive();
    await sheetWithDemoData(drive);
    await createFamilyMember({ name: 'Person C', relationship: 'Other', isActive: true });
    renderApp(drive);
    await user.click(screen.getByRole('button', { name: 'Connect Google Sheet' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Which data do you want to keep?' });
    expect(within(dialog).getByRole('columnheader', { name: 'Google Sheet' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect((await listFamilyMembers()).map((m) => m.name)).toEqual(['Person C']);
    expect(drive.client.writeTabs).not.toHaveBeenCalled();
    expect(readStorageMode()).toBeNull(); // still on the start screen

    await user.click(screen.getByRole('button', { name: 'Connect Google Sheet' }));
    await user.click(await screen.findByRole('button', { name: 'Use the Google Sheet (replace this browser)' }));
    expect(await screen.findByText('Person A')).toBeInTheDocument();
    expect(screen.queryByText('Person C')).not.toBeInTheDocument();
    expect(drive.client.writeTabs).not.toHaveBeenCalled();
  });

  it('can keep this browser’s data instead, replacing the sheet', async () => {
    const user = userEvent.setup();
    const drive = fakeDrive();
    const file = await sheetWithDemoData(drive);
    await createFamilyMember({ name: 'Person C', relationship: 'Other', isActive: true });
    renderApp(drive);
    await user.click(screen.getByRole('button', { name: 'Connect Google Sheet' }));
    await user.click(await screen.findByRole('button', { name: 'Keep this browser’s data (replace the sheet)' }));
    expect(await screen.findByText('Person C')).toBeInTheDocument();
    await waitFor(() => expect(drive.client.writeTabs).toHaveBeenCalledTimes(1));
    expect(drive.sheets[file.id]!.Family).toHaveLength(2); // header + Person C
  });

  it('shows why a sheet cannot be read, and changes nothing', async () => {
    const user = userEvent.setup();
    const drive = fakeDrive();
    const file = await sheetWithDemoData(drive);
    drive.sheets[file.id]!.Family!.splice(1, 1);
    renderApp(drive);
    await user.click(screen.getByRole('button', { name: 'Connect Google Sheet' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be read, so nothing was changed');
    expect(await listFamilyMembers()).toEqual([]);
    expect(readStorageMode()).toBeNull();
  });

  it('after a reload in Google mode, asks to sign in again; Disconnect returns to browser only', async () => {
    const user = userEvent.setup();
    localStorage.setItem('fwc-storage-mode', 'google');
    const drive = fakeDrive();
    renderApp(drive, fakeAuth(), '/data');
    expect(await screen.findByRole('heading', { name: 'Backup & data' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Sign in to (Google|connect)/ })[0]!);
    expect(await screen.findByRole('button', { name: 'Save now' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save now' }));
    await waitFor(() => expect(drive.client.writeTabs).toHaveBeenCalledTimes(2)); // first connect + manual save

    await user.click(screen.getByRole('button', { name: 'Disconnect…' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Disconnect' }));
    expect(await screen.findByRole('button', { name: 'Connect Google Sheet' })).toBeInTheDocument();
    expect(readStorageMode()).toBe('browser');
    expect(readRememberedSheet()).toBeNull();
  });
});
