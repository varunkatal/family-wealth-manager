/**
 * Full backup, restore and deletion (spec §19, §27).
 * A restore replaces all data in one transaction, only after the whole file has been
 * validated: every record against its schema, unique IDs, and every reference resolving.
 */
import type { ZodType } from 'zod';
import { assetSchema } from '../../models/asset';
import { expenseSchema, incomeSchema } from '../../models/cashFlow';
import { contributionSchema } from '../../models/contribution';
import { familyMemberSchema } from '../../models/familyMember';
import { goalSchema } from '../../models/goal';
import { assetValuationSchema, snapshotSchema } from '../../models/history';
import { liabilitySchema } from '../../models/liability';
import { assetOwnershipSchema } from '../../models/ownership';
import { appSettingsSchema, type AppSettings } from '../../models/settings';
import { getDb, type WealthDB } from './db';

export const BACKUP_APP = 'family-wealth-calculator';
export const BACKUP_FORMAT_VERSION = 1;

/** Record stores (everything except settings), in a safe write order. */
export const RECORD_STORES = {
  familyMembers: familyMemberSchema,
  assets: assetSchema,
  assetOwnerships: assetOwnershipSchema,
  liabilities: liabilitySchema,
  contributions: contributionSchema,
  incomes: incomeSchema,
  expenses: expenseSchema,
  goals: goalSchema,
  snapshots: snapshotSchema,
  assetValuations: assetValuationSchema,
} satisfies Partial<Record<keyof WealthDB, ZodType>>;
export type RecordStore = keyof typeof RECORD_STORES;
export const STORE_NAMES = Object.keys(RECORD_STORES) as RecordStore[];
const ALL_STORES = ['settings', ...STORE_NAMES] as const;

export const STORE_LABELS: Record<RecordStore, string> = {
  familyMembers: 'Family members',
  assets: 'Assets',
  assetOwnerships: 'Ownership records',
  liabilities: 'Liabilities',
  contributions: 'Regular investments',
  incomes: 'Income',
  expenses: 'Expenses',
  goals: 'Goals',
  snapshots: 'Snapshots',
  assetValuations: 'Asset values',
};

type Records = { [K in RecordStore]: WealthDB[K]['value'][] };
export type Backup = {
  app: typeof BACKUP_APP;
  formatVersion: number;
  exportedAt: string;
  settings: AppSettings;
  data: Records;
};

export async function exportBackup(): Promise<Backup> {
  const db = await getDb();
  const tx = db.transaction([...ALL_STORES], 'readonly');
  const data = {} as Records;
  for (const store of STORE_NAMES) (data as Record<string, unknown[]>)[store] = await tx.objectStore(store).getAll();
  const settings = appSettingsSchema.parse((await tx.objectStore('settings').get('app')) ?? {});
  await tx.done;
  return { app: BACKUP_APP, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: new Date().toISOString(), settings, data };
}

export type ParsedBackup = { ok: true; backup: Backup; counts: Record<RecordStore, number> } | { ok: false; errors: string[] };

/** Validates a backup file's text. Nothing is written. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['This file is not valid JSON.'] };
  }
  return validateBackup(raw);
}

/** Validates backup data already read into an object (from a file or a Google Sheet). Nothing is written. */
export function validateBackup(raw: unknown): ParsedBackup {
  const obj = raw as Partial<Backup> | null;
  if (!obj || typeof obj !== 'object' || obj.app !== BACKUP_APP) {
    return { ok: false, errors: ['This is not a Family Wealth Calculator backup.'] };
  }
  if (obj.formatVersion !== BACKUP_FORMAT_VERSION) {
    return { ok: false, errors: [`Unsupported backup version (${String(obj.formatVersion)}).`] };
  }
  const errors: string[] = [];
  const settings = appSettingsSchema.safeParse(obj.settings ?? {});
  if (!settings.success) errors.push('Settings are not valid.');

  const data = {} as Records;
  const input = (obj.data ?? {}) as Record<string, unknown>;
  for (const store of STORE_NAMES) {
    const rows = input[store] ?? [];
    if (!Array.isArray(rows)) {
      errors.push(`${STORE_LABELS[store]}: expected a list.`);
      continue;
    }
    const valid: unknown[] = [];
    const ids = new Set<string>();
    rows.forEach((row, i) => {
      const r = RECORD_STORES[store].safeParse(row);
      if (!r.success) {
        errors.push(`${STORE_LABELS[store]}: record ${i + 1} is not valid.`);
        return;
      }
      const id = (r.data as { id: string }).id;
      if (ids.has(id)) errors.push(`${STORE_LABELS[store]}: duplicate ID ${id}.`);
      ids.add(id);
      valid.push(r.data);
    });
    (data as Record<string, unknown[]>)[store] = valid;
  }
  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 20) };

  // Every reference must point at a record in the same backup.
  const members = new Set(data.familyMembers.map((m) => m.id));
  const assets = new Set(data.assets.map((a) => a.id));
  const check = (ok: boolean, message: string) => ok || errors.push(message);
  data.assetOwnerships.forEach((o) => {
    check(assets.has(o.assetId), 'An ownership record refers to a missing asset.');
    check(members.has(o.familyMemberId), 'An ownership record refers to a missing family member.');
  });
  data.liabilities.forEach((l) => check(members.has(l.ownerId), `Liability "${l.name}" refers to a missing family member.`));
  data.contributions.forEach((c) => {
    check(members.has(c.ownerId), `Investment "${c.name}" refers to a missing family member.`);
    check(!c.linkedAssetId || assets.has(c.linkedAssetId), `Investment "${c.name}" refers to a missing asset.`);
  });
  data.incomes.forEach((i) => check(members.has(i.memberId), 'An income refers to a missing family member.'));
  data.expenses.forEach((e) => check(!e.memberId || members.has(e.memberId), 'An expense refers to a missing family member.'));
  data.goals.forEach((g) => check(!g.ownerId || members.has(g.ownerId), `Goal "${g.name}" refers to a missing family member.`));
  data.assetValuations.forEach((v) => check(assets.has(v.assetId), 'An asset value refers to a missing asset.'));
  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)].slice(0, 20) };

  const counts = Object.fromEntries(STORE_NAMES.map((s) => [s, data[s].length])) as Record<RecordStore, number>;
  return {
    ok: true,
    backup: { app: BACKUP_APP, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: String(obj.exportedAt ?? ''), settings: settings.data!, data },
    counts,
  };
}

/** Number of records currently stored, per store. */
export async function countRecords(): Promise<Record<RecordStore, number>> {
  const db = await getDb();
  const entries = await Promise.all(STORE_NAMES.map(async (s) => [s, await db.count(s)] as const));
  return Object.fromEntries(entries) as Record<RecordStore, number>;
}

/** Replaces ALL data with a validated backup, in one transaction (all or nothing). */
export async function restoreBackup(backup: Backup): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([...ALL_STORES], 'readwrite');
  try {
    for (const store of ALL_STORES) await tx.objectStore(store).clear();
    await tx.objectStore('settings').put(backup.settings, 'app');
    for (const store of STORE_NAMES) {
      for (const row of backup.data[store]) await tx.objectStore(store).add(row as never);
    }
    await tx.done;
  } catch (err) {
    try {
      tx.abort();
    } catch {
      // already finished
    }
    await tx.done.catch(() => undefined);
    throw err;
  }
}

/** Permanently deletes every record and setting stored by the app. */
export async function deleteAllData(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([...ALL_STORES], 'readwrite');
  for (const store of ALL_STORES) await tx.objectStore(store).clear();
  await tx.done;
}
