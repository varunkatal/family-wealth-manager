import { z } from 'zod';
import { FREQUENCIES } from '../services/finance/sip';
import { amountSchema, isoDateSchema, optionalTextSchema } from './common';

export const INCOME_TYPES = [
  'Salary',
  'Pension',
  'Rent',
  'Interest',
  'Farm Income',
  'Business Income',
  'Trading Income',
  'Other',
] as const;

/** Consumption only. Investments and loan repayments are tracked separately (spec §25). */
export const EXPENSE_CATEGORIES = [
  'Household',
  'Grocery',
  'Utilities',
  'Medical',
  'Insurance',
  'Education',
  'Travel',
  'Shopping',
  'Family',
  'Other',
] as const;

const optionalDate = z
  .union([z.literal(''), isoDateSchema])
  .optional()
  .transform((v) => v || undefined);

const datesInOrder = (v: { startDate?: string; endDate?: string }, ctx: z.RefinementCtx) => {
  if (v.startDate && v.endDate && v.endDate < v.startDate) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after the start date' });
  }
};

const common = {
  description: optionalTextSchema(120, 'Description'),
  amount: amountSchema('Amount').gt(0, 'Amount must be more than 0'),
  frequency: z.enum(FREQUENCIES, { error: 'Choose how often' }),
  startDate: optionalDate,
  endDate: optionalDate,
  notes: optionalTextSchema(1000, 'Notes'),
};

export const incomeInputSchema = z
  .object({
    memberId: z.string({ error: 'Choose who earns this' }).min(1, 'Choose who earns this'),
    type: z.enum(INCOME_TYPES, { error: 'Choose an income type' }),
    ...common,
    /** Expected yearly growth %, e.g. salary increments. */
    growthRate: z
      .number({ error: 'Enter a valid growth %' })
      .min(-100, 'Growth must be between -100% and 100%')
      .max(100, 'Growth must be between -100% and 100%')
      .optional(),
  })
  .superRefine(datesInOrder);
export type IncomeInput = z.input<typeof incomeInputSchema>;

export const expenseInputSchema = z
  .object({
    /** Optional: blank means a family-wide expense. */
    memberId: optionalTextSchema(100, 'Member'),
    category: z.enum(EXPENSE_CATEGORIES, { error: 'Choose a category' }),
    ...common,
  })
  .superRefine(datesInOrder);
export type ExpenseInput = z.input<typeof expenseInputSchema>;

const stored = {
  id: z.string().min(1),
  description: z.string().optional(),
  amount: z.number(),
  frequency: z.enum(FREQUENCIES),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
  isDemo: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

export const incomeSchema = z.object({
  ...stored,
  memberId: z.string().min(1),
  type: z.string().min(1),
  growthRate: z.number().optional(),
});
export type Income = z.infer<typeof incomeSchema>;

export const expenseSchema = z.object({
  ...stored,
  memberId: z.string().optional(),
  category: z.string().min(1),
});
export type Expense = z.infer<typeof expenseSchema>;
