import { z } from 'zod';
import { FREQUENCIES } from '../services/finance/sip';
import { amountSchema, isoDateSchema, optionalTextSchema } from './common';

const rateSchema = (label: string) =>
  z
    .number({ error: `Enter a valid ${label.toLowerCase()}` })
    .min(-100, `${label} must be between -100% and 100%`)
    .max(100, `${label} must be between -100% and 100%`);

/** A recurring investment such as a SIP (spec §13). Fields the user edits. */
export const contributionInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120, 'Name must be 120 characters or fewer'),
    ownerId: z.string({ error: 'Choose who invests' }).min(1, 'Choose who invests'),
    linkedAssetId: optionalTextSchema(100, 'Linked asset'),
    amount: amountSchema('Amount').gt(0, 'Amount must be more than 0'),
    frequency: z.enum(FREQUENCIES, { error: 'Choose a frequency' }),
    startDate: isoDateSchema,
    endDate: z
      .union([z.literal(''), isoDateSchema])
      .optional()
      .transform((v) => v || undefined),
    /** Blank: use the linked asset's growth rate. */
    expectedReturn: rateSchema('Expected return').optional(),
    annualIncrease: rateSchema('Annual increase').min(0, 'Annual increase cannot be negative').optional(),
    notes: optionalTextSchema(1000, 'Notes'),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after the start date' });
    }
  });
export type ContributionInput = z.input<typeof contributionInputSchema>;

export const contributionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ownerId: z.string().min(1),
  linkedAssetId: z.string().optional(),
  amount: z.number(),
  frequency: z.enum(FREQUENCIES),
  startDate: z.string(),
  endDate: z.string().optional(),
  expectedReturn: z.number().optional(),
  annualIncrease: z.number().optional(),
  notes: z.string().optional(),
  isDemo: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Contribution = z.infer<typeof contributionSchema>;
