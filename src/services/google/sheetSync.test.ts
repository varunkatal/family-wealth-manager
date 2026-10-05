import { fakeDrive } from '../../test/fakeGoogle';
import { buildDemoData } from '../demo/demoData';
import { exportBackup } from '../storage/backupRepository';
import { loadDemoData } from '../storage/demoRepository';
import { createFamilyMember, listFamilyMembers } from '../storage/familyMemberRepository';
import { ABOUT_TAB, backupToTabs, readSaveId } from './sheetFormat';
import {
  loadSheetIntoBrowser,
  openFamilySheet,
  planConnection,
  readRememberedSheet,
  saveBrowserToSheet,
  SheetChangedError,
  totalRecords,
  writeRememberedSheet,
} from './sheetSync';

/** A sheet holding the demo data, as another device would have saved it (browser left empty). */
async function demoSheetTabs(saveId = 'other-device') {
  await loadDemoData(buildDemoData());
  const tabs = backupToTabs(await exportBackup(), saveId);
  const { deleteAllData } = await import('../storage/backupRepository');
  await deleteAllData();
  return tabs;
}

describe('Connecting to the Google Sheet', () => {
  it('uploads silently when both the sheet and the browser are empty', async () => {
    const drive = fakeDrive();
    const file = await openFamilySheet(drive.client, null);
    expect(drive.client.createAppSpreadsheet).toHaveBeenCalledTimes(1);
    expect(await planConnection(await drive.client.readTabs(file.id), null)).toEqual({ kind: 'upload' });
  });

  it('asks before uploading when the sheet is empty but the browser has data', async () => {
    await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true });
    const drive = fakeDrive();
    const file = await openFamilySheet(drive.client, null);
    const plan = await planConnection(await drive.client.readTabs(file.id), null);
    expect(plan.kind).toBe('ask-upload');
    expect(plan.kind === 'ask-upload' && plan.local.familyMembers).toBe(1);
  });

  it('loads the sheet into an empty browser', async () => {
    const drive = fakeDrive();
    const file = drive.seed(await demoSheetTabs());
    const plan = await planConnection(await drive.client.readTabs(file.id), null);
    expect(plan.kind).toBe('load');
    if (plan.kind !== 'load') return;
    expect(plan.saveId).toBe('other-device');
    await loadSheetIntoBrowser(plan.backup);
    expect((await listFamilyMembers()).map((m) => m.name).sort()).toEqual(['Person A', 'Person B']);
    // Connecting again: nothing to do.
    expect(await planConnection(await drive.client.readTabs(file.id), 'other-device')).toEqual({ kind: 'in-sync', saveId: 'other-device' });
  });

  it('asks which copy to keep when both hold different data', async () => {
    const drive = fakeDrive();
    const file = drive.seed(await demoSheetTabs());
    await createFamilyMember({ name: 'Person C', relationship: 'Other', isActive: true });
    const plan = await planConnection(await drive.client.readTabs(file.id), null);
    expect(plan.kind).toBe('choose');
    if (plan.kind !== 'choose') return;
    expect(plan.sheet.familyMembers).toBe(2);
    expect(plan.local.familyMembers).toBe(1);
    expect(totalRecords(plan.sheet)).toBeGreaterThan(totalRecords(plan.local));
  });

  it('uploads without asking when the sheet is unchanged since this browser last saved it', async () => {
    const drive = fakeDrive();
    const file = await openFamilySheet(drive.client, null);
    const saveId = await saveBrowserToSheet(drive.client, file.id);
    await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true }); // changed offline afterwards
    expect(await planConnection(await drive.client.readTabs(file.id), saveId)).toEqual({ kind: 'upload' });
    // A different (or unknown) last save means another device saved: ask instead.
    expect((await planConnection(await drive.client.readTabs(file.id), 'something-else')).kind).toBe('choose');
  });

  it('refuses a sheet it cannot read, without changing anything', async () => {
    const drive = fakeDrive();
    const tabs = await demoSheetTabs();
    tabs.find((t) => t.title === 'Family')!.rows.splice(1, 1); // remove a member that others refer to
    const file = drive.seed(tabs);
    const plan = await planConnection(await drive.client.readTabs(file.id), null);
    expect(plan.kind).toBe('invalid');
    expect(totalRecords(await (await import('../storage/backupRepository')).countRecords())).toBe(0);
  });

  it('reopens the remembered sheet, or finds/creates one when it is gone', async () => {
    const drive = fakeDrive();
    const existing = drive.seed([]);
    expect((await openFamilySheet(drive.client, existing.id)).id).toBe(existing.id);
    expect((await openFamilySheet(drive.client, 'deleted-id')).id).toBe(existing.id); // 404 → search
    expect(drive.client.createAppSpreadsheet).not.toHaveBeenCalled();
  });
});

describe('Saving to the Google Sheet', () => {
  it('writes everything with a new Save ID, and will not overwrite a save from another device', async () => {
    await loadDemoData(buildDemoData());
    const drive = fakeDrive();
    const file = await openFamilySheet(drive.client, null);
    const first = await saveBrowserToSheet(drive.client, file.id, null);
    expect(readSaveId(drive.sheets[file.id]![ABOUT_TAB])).toBe(first);
    expect(drive.sheets[file.id]!.Assets).toHaveLength(5);

    const second = await saveBrowserToSheet(drive.client, file.id, first);
    expect(second).not.toBe(first);

    drive.sheets[file.id]![ABOUT_TAB] = backupToTabs(await exportBackup(), 'from-phone')[0]!.rows;
    await expect(saveBrowserToSheet(drive.client, file.id, second)).rejects.toBeInstanceOf(SheetChangedError);
  });

  it('remembers only the sheet and save IDs in this browser', () => {
    writeRememberedSheet({ spreadsheetId: 's1', saveId: 'v1' });
    expect(readRememberedSheet()).toEqual({ spreadsheetId: 's1', saveId: 'v1' });
    expect(localStorage.getItem('fwc-google-sheet')).toBe('{"spreadsheetId":"s1","saveId":"v1"}');
    writeRememberedSheet(null);
    expect(readRememberedSheet()).toBeNull();
  });
});
