import { z } from 'zod';
import { calculateQuantityValue } from '../services/finance/assetValuation';
import { optionalTextSchema, pastOrTodayDateSchema } from './common';

export const LIQUIDITY_OPTIONS = [
  { value: 'liquid', label: 'Liquid', hint: 'Can be converted to cash within days' },
  { value: 'semi-liquid', label: 'Semi-liquid', hint: 'Can be accessed with some delay or penalty' },
  { value: 'illiquid', label: 'Illiquid', hint: 'Locked in or slow to sell' },
] as const;

export const liquiditySchema = z.enum(['liquid', 'semi-liquid', 'illiquid'], { error: 'Choose a liquidity level' });
export type Liquidity = z.infer<typeof liquiditySchema>;

export const valuationMethodSchema = z.enum(['manual', 'quantity_x_price']);
export type ValuationMethod = z.infer<typeof valuationMethodSchema>;

const MAX_AMOUNT = 1e13; // ₹10 lakh crore: far above any household asset, guards against typos

const amountSchema = (label: string) =>
  z
    .number({ error: `Enter a valid ${label.toLowerCase()}` })
    .min(0, `${label} cannot be negative`)
    .max(MAX_AMOUNT, `${label} is too large`);

const growthRateSchema = z
  .number({ error: 'Enter a valid percentage' })
  .min(-100, 'Rate must be between -100% and 100%')
  .max(100, 'Rate must be between -100% and 100%');

/** Fields the user edits. Numbers are already parsed from the form. */
export const assetInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Asset name is required').max(120, 'Name must be 120 characters or fewer'),
    assetClass: z.string().trim().min(1, 'Choose an asset class').max(50, 'Category must be 50 characters or fewer'),
    subcategory: optionalTextSchema(50, 'Subcategory'),
    institution: optionalTextSchema(100, 'Institution'),
    valuationMethod: valuationMethodSchema,
    quantity: z.number({ error: 'Enter a valid quantity' }).positive('Quantity must be more than 0').optional(),
    unit: optionalTextSchema(20, 'Unit'),
    unitPrice: amountSchema('Unit price').optional(),
    purchaseValue: amountSchema('Purchase value').optional(),
    currentValue: amountSchema('Current value').optional(),
    valuationDate: pastOrTodayDateSchema('Valuation date cannot be in the future'),
    conservativeGrowthRate: growthRateSchema.optional(),
    baseGrowthRate: growthRateSchema.optional(),
    optimisticGrowthRate: growthRateSchema.optional(),
    liquidity: liquiditySchema,
    notes: optionalTextSchema(1000, 'Notes'),
  })
  .superRefine((v, ctx) => {
    if (v.valuationMethod === 'manual' && v.currentValue === undefined) {
      ctx.addIssue({ code: 'custom', path: ['currentValue'], message: 'Current value is required' });
    }
    if (v.valuationMethod === 'quantity_x_price') {
      if (v.quantity === undefined) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Quantity is required' });
      if (v.unitPrice === undefined)
        ctx.addIssue({ code: 'custom', path: ['unitPrice'], message: 'Unit price is required' });
    }
    const { conservativeGrowthRate: c, baseGrowthRate: b, optimisticGrowthRate: o } = v;
    if (c !== undefined && b !== undefined && c > b) {
      ctx.addIssue({ code: 'custom', path: ['conservativeGrowthRate'], message: 'Conservative should not exceed Base' });
    }
    if (b !== undefined && o !== undefined && b > o) {
      ctx.addIssue({ code: 'custom', path: ['optimisticGrowthRate'], message: 'Optimistic should not be below Base' });
    }
    if (c !== undefined && o !== undefined && c > o) {
      ctx.addIssue({ code: 'custom', path: ['optimisticGrowthRate'], message: 'Optimistic should not be below Conservative' });
    }
  })
  .transform((v) => {
    if (v.valuationMethod === 'quantity_x_price') {
      return { ...v, currentValue: calculateQuantityValue(v.quantity!, v.unitPrice!) };
    }
    // Manual valuation: quantity fields don't apply, so they aren't stored.
    return { ...v, currentValue: v.currentValue!, quantity: undefined, unit: undefined, unitPrice: undefined };
  });
export type AssetInput = z.input<typeof assetInputSchema>;

/** A stored asset. */
export const assetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  assetClass: z.string().min(1),
  subcategory: z.string().optional(),
  institution: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  unitPrice: z.number().optional(),
  purchaseValue: z.number().optional(),
  currentValue: z.number(),
  valuationMethod: valuationMethodSchema,
  valuationDate: z.string(),
  conservativeGrowthRate: z.number().optional(),
  baseGrowthRate: z.number().optional(),
  optimisticGrowthRate: z.number().optional(),
  liquidity: liquiditySchema,
  notes: z.string().optional(),
  /** Fake data loaded with "Load demo assets"; removed by "Clear demo data". */
  isDemo: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Asset = z.infer<typeof assetSchema>;

export function liquidityLabel(value: Liquidity): string {
  return LIQUIDITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
