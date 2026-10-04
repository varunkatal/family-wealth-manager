import { z } from 'zod';
import { amountSchema, optionalTextSchema } from './common';

export const LIABILITY_TYPES = [
  'Home Loan',
  'Car Loan',
  'Personal Loan',
  'Education Loan',
  'Portfolio Loan',
  'Credit Card',
  'Other',
] as const;

/**
 * Simple liability (Phase 4): what is owed today and by whom.
 * Loan details such as interest, EMI and tenure are added in Phase 8.
 */
export const liabilityInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name must be 120 characters or fewer'),
  type: z.enum(LIABILITY_TYPES, { error: 'Choose a type' }),
  ownerId: z.string({ error: 'Choose who owes this' }).min(1, 'Choose who owes this'),
  currentOutstanding: amountSchema('Outstanding amount'),
  notes: optionalTextSchema(1000, 'Notes'),
});
export type LiabilityInput = z.input<typeof liabilityInputSchema>;

export const liabilitySchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  currentOutstanding: z.number(),
  notes: z.string().optional(),
  /** Fake data created with demo data; removed by "Clear demo data". */
  isDemo: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Liability = z.infer<typeof liabilitySchema>;
