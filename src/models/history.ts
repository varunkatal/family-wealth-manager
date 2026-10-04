import { z } from 'zod';
import { amountSchema, optionalTextSchema, pastOrTodayDateSchema } from './common';

/**
 * A wealth snapshot (spec §18): totals as they were on a date. Stored as plain numbers and
 * never recalculated, so later changes to assets or loans don't alter history.
 */
export const snapshotSchema = z.object({
  id: z.string().min(1),
  date: z.string(),
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  netWorth: z.number(),
  /** 'captured' = saved from the app's figures; 'manual' = typed in for a past date. */
  source: z.enum(['captured', 'manual']),
  notes: z.string().optional(),
  isDemo: z.boolean().optional(),
  createdAt: z.string(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

/** A past snapshot typed in by the user. Net worth is assets − liabilities. */
export const manualSnapshotInputSchema = z.object({
  date: pastOrTodayDateSchema('Date cannot be in the future'),
  totalAssets: amountSchema('Total assets'),
  totalLiabilities: amountSchema('Total liabilities'),
  notes: optionalTextSchema(500, 'Notes'),
});
export type ManualSnapshotInput = z.input<typeof manualSnapshotInputSchema>;

export const VALUATION_SOURCES = { 'asset-update': 'Asset value updated', manual: 'Added manually' } as const;

/** One recorded value of an asset on a date (spec §18). */
export const assetValuationSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  date: z.string(),
  value: z.number(),
  source: z.enum(['asset-update', 'manual']),
  notes: z.string().optional(),
  isDemo: z.boolean().optional(),
  createdAt: z.string(),
});
export type AssetValuation = z.infer<typeof assetValuationSchema>;

export const manualValuationInputSchema = z.object({
  date: pastOrTodayDateSchema('Date cannot be in the future'),
  value: amountSchema('Value'),
  notes: optionalTextSchema(500, 'Notes'),
});
export type ManualValuationInput = z.input<typeof manualValuationInputSchema>;
