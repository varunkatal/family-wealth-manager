import { z } from 'zod';
import { calculateMonthlyInterest, MAX_LOAN_MONTHS } from '../services/finance/loans';
import { formatINRExact } from '../utils/currency';
import { amountSchema, optionalTextSchema, pastOrTodayDateSchema } from './common';

export const LIABILITY_TYPES = [
  'Home Loan',
  'Car Loan',
  'Personal Loan',
  'Education Loan',
  'Portfolio Loan',
  'Credit Card',
  'Other',
] as const;

const optionalBlank = <T extends z.ZodType>(schema: T) =>
  z
    .union([z.literal(''), schema])
    .optional()
    .transform((v) => (v === '' ? undefined : v));

/**
 * A liability: what is owed today and by whom, plus optional loan terms (spec §14, §24).
 * The repayment schedule and debt-free date are calculated from the terms, not stored.
 */
export const liabilityInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120, 'Name must be 120 characters or fewer'),
    type: z.enum(LIABILITY_TYPES, { error: 'Choose a type' }),
    ownerId: z.string({ error: 'Choose who owes this' }).min(1, 'Choose who owes this'),
    originalAmount: amountSchema('Original amount').optional(),
    currentOutstanding: amountSchema('Outstanding amount'),
    interestRate: z
      .number({ error: 'Enter a valid interest rate' })
      .min(0, 'Interest rate cannot be negative')
      .max(100, 'Interest rate must be 100% or less')
      .optional(),
    monthlyEMI: amountSchema('EMI').gt(0, 'EMI must be more than 0').optional(),
    remainingMonths: z
      .number({ error: 'Enter a valid number of months' })
      .int('Enter whole months')
      .min(1, 'Enter at least 1 month')
      .max(MAX_LOAN_MONTHS, `Enter at most ${MAX_LOAN_MONTHS} months`)
      .optional(),
    startDate: optionalBlank(pastOrTodayDateSchema('Start date cannot be in the future')),
    notes: optionalTextSchema(1000, 'Notes'),
  })
  .superRefine((v, ctx) => {
    if (v.monthlyEMI !== undefined && v.interestRate !== undefined && v.currentOutstanding > 0) {
      const interest = calculateMonthlyInterest(v.currentOutstanding, v.interestRate);
      if (v.monthlyEMI <= interest) {
        ctx.addIssue({
          code: 'custom',
          path: ['monthlyEMI'],
          message: `EMI must be more than the monthly interest of ${formatINRExact(interest)}, or the loan is never repaid`,
        });
      }
    }
  });
export type LiabilityInput = z.input<typeof liabilityInputSchema>;

export const liabilitySchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  originalAmount: z.number().optional(),
  currentOutstanding: z.number(),
  interestRate: z.number().optional(),
  monthlyEMI: z.number().optional(),
  remainingMonths: z.number().optional(),
  startDate: z.string().optional(),
  notes: z.string().optional(),
  /** Fake data created with demo data; removed by "Clear demo data". */
  isDemo: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Liability = z.infer<typeof liabilitySchema>;
