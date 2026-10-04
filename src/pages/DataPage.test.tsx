import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildDemoData } from '../services/demo/demoData';
import { countRecords } from '../services/storage/backupRepository';
import { loadDemoData } from '../services/storage/demoRepository';
import { createFamilyMember, listFamilyMembers } from '../services/storage/familyMemberRepository';
import { renderApp } from '../test/renderApp';
import { downloadFile } from '../utils/download';

vi.mock('../utils/download', () => ({ downloadFile: vi.fn() }));
const download = vi.mocked(downloadFile);
beforeEach(() => download.mockClear());

const lastDownload = () => {
  const [name, data, type] = download.mock.calls.at(-1)!;
  return { name, data, type };
};

describe('Backup & data page (Phase 13)', () => {
  it('backs up, then restores after a preview and confirmation, replacing (not merging) data', async () => {
    await loadDemoData(buildDemoData());
    const user = userEvent.setup();
    renderApp('/data');

    await user.click(await screen.findByRole('button', { name: 'Download backup' }));
    await waitFor(() => expect(download).toHaveBeenCalled());
    const { name, data, type } = lastDownload();
    expect(name).toMatch(/^family-wealth-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(type).toBe('application/json');
    const backupText = data as string;
    expect(JSON.parse(backupText).data.assets).toHaveLength(4);

    // More data is added after the backup
    await createFamilyMember({ name: 'Person C', relationship: 'Son', isActive: true });

    await user.upload(screen.getByLabelText('Backup file'), new File([backupText], 'backup.json', { type: 'application/json' }));
    const contents = await screen.findByRole('table', { name: 'Backup contents' });
    expect(within(contents).getByRole('row', { name: /Family members/ })).toHaveTextContent('2');
    expect(within(contents).getByRole('row', { name: /^Assets/ })).toHaveTextContent('4');
    expect(screen.getByText(/Your current \d+ records will be replaced/)).toBeInTheDocument();
    expect(await listFamilyMembers()).toHaveLength(3); // nothing changed yet

    await user.click(screen.getByRole('button', { name: 'Replace all data with this backup' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Replace all data' }));
    expect(await screen.findByText(/Restored \d+ records from backup.json/)).toBeInTheDocument();
    expect((await listFamilyMembers()).map((m) => m.name)).toEqual(['Person A', 'Person B']);
  });

  it('rejects an invalid backup file without changing anything', async () => {
    await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true });
    const user = userEvent.setup();
    renderApp('/data');
    await user.upload(await screen.findByLabelText('Backup file'), new File(['{"hello":1}'], 'other.json', { type: 'application/json' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("This file can't be restored. Nothing was changed.");
    expect(alert).toHaveTextContent('This is not a Family Wealth Calculator backup.');
    expect(screen.queryByRole('button', { name: /Replace all data/ })).not.toBeInTheDocument();
    expect(await listFamilyMembers()).toHaveLength(1);
  });

  it('exports CSV files and an Excel workbook', async () => {
    await loadDemoData(buildDemoData());
    const user = userEvent.setup();
    renderApp('/data');

    await user.click(await screen.findByRole('button', { name: 'Download Assets CSV' }));
    let file = lastDownload();
    expect(file.name).toMatch(/^family-wealth-assets-.*\.csv$/);
    const csv = file.data as string;
    expect(csv.startsWith('﻿Name,Asset class,')).toBe(true);
    expect(csv).toContain('Example Property,Real Estate,Residential Property,,Person A 50%; Person B 50%,2500000,2500000');
    for (const t of ['Liabilities', 'Income', 'Expenses', 'Contributions', 'Goals', 'Snapshots']) {
      expect(screen.getByRole('button', { name: `Download ${t} CSV` })).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: 'Download Excel workbook' }));
    file = lastDownload();
    expect(file.name).toMatch(/\.xlsx$/);
    const text = new TextDecoder().decode(file.data as Uint8Array);
    expect(text.startsWith('PK')).toBe(true);
    expect(text).toContain('<sheet name="Assets"');
    expect(text).toContain('<sheet name="Snapshots"');
  });

  it('deletes all data only after typing DELETE', async () => {
    await loadDemoData(buildDemoData());
    const user = userEvent.setup();
    renderApp('/data');
    await user.click(await screen.findByRole('button', { name: 'Delete all data…' }));
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete everything' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'delete');
    expect(confirm).toBeDisabled();
    await user.clear(within(dialog).getByLabelText('Type DELETE to confirm'));
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(confirm);
    expect(await screen.findByText('All data has been deleted from this browser.')).toBeInTheDocument();
    expect(Object.values(await countRecords()).every((n) => n === 0)).toBe(true);
  });
});
