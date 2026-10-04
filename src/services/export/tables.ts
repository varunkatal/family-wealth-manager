/**
 * The tables used for CSV and Excel export, built once so both formats show the same columns.
 * Member and asset IDs are replaced by names so the files are readable.
 */
import type { Asset } from '../../models/asset';
import type { Expense, Income } from '../../models/cashFlow';
import type { Contribution } from '../../models/contribution';
import type { FamilyMember } from '../../models/familyMember';
import type { Goal } from '../../models/goal';
import type { AssetValuation, Snapshot } from '../../models/history';
import type { Liability } from '../../models/liability';
import type { AssetOwnership } from '../../models/ownership';
import { calculateFamilyOwnedValue } from '../finance/allocation';
import { annualAmount } from '../finance/cashFlow';
import { calculateFamilyWealth } from '../finance/netWorth';
import { FREQUENCY_LABELS, monthlyEquivalent } from '../finance/sip';
import type { Column, SheetValue } from './xlsx';

export type ExportData = {
  members: FamilyMember[];
  assets: Asset[];
  ownerships: AssetOwnership[];
  liabilities: Liability[];
  contributions: Contribution[];
  incomes: Income[];
  expenses: Expense[];
  goals: Goal[];
  snapshots: Snapshot[];
  valuations: AssetValuation[];
};

export type ExportTable = { key: string; title: string; columns: Column[]; rows: SheetValue[][] };

const yesNo = (b: boolean | undefined) => (b ? 'Yes' : '');

export function buildExportTables(d: ExportData): ExportTable[] {
  const member = new Map(d.members.map((m) => [m.id, m.name]));
  const asset = new Map(d.assets.map((a) => [a.id, a.name]));
  const name = (id?: string, fallback = '') => (id ? (member.get(id) ?? 'Unknown') : fallback);
  const wealth = calculateFamilyWealth(d.members.map((m) => m.id), d.assets, d.ownerships, d.liabilities);

  return [
    {
      key: 'summary',
      title: 'Summary',
      columns: [{ header: 'Item', width: 28 }, { header: 'Value', type: 'inr', width: 20 }],
      rows: [
        ['Total assets', wealth.totalAssets],
        ['Total liabilities', wealth.totalLiabilities],
        ['Net worth', wealth.netWorth],
        ...wealth.byMember.map((w): SheetValue[] => [`Net worth: ${name(w.memberId)}`, w.netWorth]),
      ],
    },
    {
      key: 'family',
      title: 'Family',
      columns: [{ header: 'Name', width: 24 }, { header: 'Relationship' }, { header: 'Date of birth', type: 'date' }, { header: 'Active' }, { header: 'Notes', width: 30 }, { header: 'Demo' }],
      rows: d.members.map((m) => [m.name, m.relationship, m.dateOfBirth, m.isActive ? 'Yes' : 'No', m.notes, yesNo(m.isDemo)]),
    },
    {
      key: 'assets',
      title: 'Assets',
      columns: [
        { header: 'Name', width: 28 },
        { header: 'Asset class', width: 16 },
        { header: 'Subcategory', width: 18 },
        { header: 'Institution', width: 18 },
        { header: 'Owners', width: 30 },
        { header: 'Current value', type: 'inr', width: 16 },
        { header: 'Family share value', type: 'inr', width: 18 },
        { header: 'Purchase value', type: 'inr', width: 16 },
        { header: 'Valuation date', type: 'date' },
        { header: 'Valuation method', width: 16 },
        { header: 'Quantity', type: 'number' },
        { header: 'Unit' },
        { header: 'Unit price', type: 'inr' },
        { header: 'Conservative %', type: 'percent' },
        { header: 'Base %', type: 'percent' },
        { header: 'Optimistic %', type: 'percent' },
        { header: 'Liquidity' },
        { header: 'Notes', width: 30 },
        { header: 'Demo' },
      ],
      rows: d.assets.map((a) => [
        a.name,
        a.assetClass,
        a.subcategory,
        a.institution,
        d.ownerships
          .filter((o) => o.assetId === a.id)
          .map((o) => ({ who: name(o.familyMemberId), pct: o.percentage }))
          // Largest share first, then by name, so the column is stable between exports.
          .sort((x, y) => y.pct - x.pct || x.who.localeCompare(y.who))
          .map((o) => `${o.who} ${o.pct}%`)
          .join('; '),
        a.currentValue,
        calculateFamilyOwnedValue(a, d.ownerships),
        a.purchaseValue,
        a.valuationDate,
        a.valuationMethod === 'manual' ? 'Manual' : 'Quantity × price',
        a.quantity,
        a.unit,
        a.unitPrice,
        a.conservativeGrowthRate,
        a.baseGrowthRate,
        a.optimisticGrowthRate,
        a.liquidity,
        a.notes,
        yesNo(a.isDemo),
      ]),
    },
    {
      key: 'liabilities',
      title: 'Liabilities',
      columns: [
        { header: 'Name', width: 28 },
        { header: 'Type', width: 16 },
        { header: 'Owed by', width: 18 },
        { header: 'Outstanding', type: 'inr', width: 16 },
        { header: 'Original amount', type: 'inr', width: 16 },
        { header: 'Interest rate %', type: 'percent' },
        { header: 'Monthly EMI', type: 'inr' },
        { header: 'Remaining months', type: 'number' },
        { header: 'Start date', type: 'date' },
        { header: 'Notes', width: 30 },
        { header: 'Demo' },
      ],
      rows: d.liabilities.map((l) => [l.name, l.type, name(l.ownerId), l.currentOutstanding, l.originalAmount, l.interestRate, l.monthlyEMI, l.remainingMonths, l.startDate, l.notes, yesNo(l.isDemo)]),
    },
    {
      key: 'income',
      title: 'Income',
      columns: [
        { header: 'Type', width: 16 },
        { header: 'Description', width: 26 },
        { header: 'Family member', width: 18 },
        { header: 'Amount', type: 'inr' },
        { header: 'Frequency' },
        { header: 'Monthly amount', type: 'inr' },
        { header: 'Annual amount', type: 'inr' },
        { header: 'Growth %', type: 'percent' },
        { header: 'Start date', type: 'date' },
        { header: 'End date', type: 'date' },
        { header: 'Notes', width: 30 },
      ],
      rows: d.incomes.map((i) => [i.type, i.description, name(i.memberId), i.amount, FREQUENCY_LABELS[i.frequency], monthlyEquivalent(i.amount, i.frequency), annualAmount(i), i.growthRate, i.startDate, i.endDate, i.notes]),
    },
    {
      key: 'expenses',
      title: 'Expenses',
      columns: [
        { header: 'Category', width: 16 },
        { header: 'Description', width: 26 },
        { header: 'For', width: 18 },
        { header: 'Amount', type: 'inr' },
        { header: 'Frequency' },
        { header: 'Monthly amount', type: 'inr' },
        { header: 'Annual amount', type: 'inr' },
        { header: 'Start date', type: 'date' },
        { header: 'End date', type: 'date' },
        { header: 'Notes', width: 30 },
      ],
      rows: d.expenses.map((e) => [e.category, e.description, name(e.memberId, 'Whole family'), e.amount, FREQUENCY_LABELS[e.frequency], monthlyEquivalent(e.amount, e.frequency), annualAmount(e), e.startDate, e.endDate, e.notes]),
    },
    {
      key: 'contributions',
      title: 'Contributions',
      columns: [
        { header: 'Name', width: 26 },
        { header: 'Invested by', width: 18 },
        { header: 'Linked asset', width: 24 },
        { header: 'Amount', type: 'inr' },
        { header: 'Frequency' },
        { header: 'Start date', type: 'date' },
        { header: 'End date', type: 'date' },
        { header: 'Expected return %', type: 'percent' },
        { header: 'Annual increase %', type: 'percent' },
        { header: 'Notes', width: 30 },
      ],
      rows: d.contributions.map((c) => [c.name, name(c.ownerId), c.linkedAssetId ? (asset.get(c.linkedAssetId) ?? '') : '', c.amount, FREQUENCY_LABELS[c.frequency], c.startDate, c.endDate, c.expectedReturn, c.annualIncrease, c.notes]),
    },
    {
      key: 'goals',
      title: 'Goals',
      columns: [
        { header: 'Name', width: 26 },
        { header: 'Type', width: 16 },
        { header: 'For', width: 18 },
        { header: 'Priority' },
        { header: 'Target amount', type: 'inr', width: 16 },
        { header: 'Saved amount', type: 'inr', width: 16 },
        { header: 'Target date', type: 'date' },
        { header: 'Expected return %', type: 'percent' },
        { header: 'Notes', width: 30 },
      ],
      rows: d.goals.map((g) => [g.name, g.type, name(g.ownerId, 'Whole family'), g.priority, g.targetAmount, g.savedAmount, g.targetDate, g.expectedReturn, g.notes]),
    },
    {
      key: 'snapshots',
      title: 'Snapshots',
      columns: [
        { header: 'Date', type: 'date' },
        { header: 'Total assets', type: 'inr', width: 16 },
        { header: 'Total liabilities', type: 'inr', width: 16 },
        { header: 'Net worth', type: 'inr', width: 16 },
        { header: 'Source' },
        { header: 'Notes', width: 30 },
        { header: 'Demo' },
      ],
      rows: d.snapshots.map((s) => [s.date, s.totalAssets, s.totalLiabilities, s.netWorth, s.source === 'captured' ? 'Saved in app' : 'Entered', s.notes, yesNo(s.isDemo)]),
    },
    {
      key: 'asset-values',
      title: 'Asset values',
      columns: [{ header: 'Asset', width: 26 }, { header: 'Date', type: 'date' }, { header: 'Value', type: 'inr', width: 16 }, { header: 'Source', width: 18 }, { header: 'Notes', width: 30 }],
      rows: d.valuations.map((v) => [asset.get(v.assetId) ?? 'Unknown', v.date, v.value, v.source === 'manual' ? 'Added manually' : 'Asset value updated', v.notes]),
    },
  ];
}

/** Tables offered as separate CSV files (spec §19). */
export const CSV_TABLES = ['assets', 'liabilities', 'income', 'expenses', 'contributions', 'goals', 'snapshots'] as const;
