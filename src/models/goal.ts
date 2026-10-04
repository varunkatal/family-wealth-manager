import { z } from 'zod';
import { amountSchema, isoDateSchema, optionalTextSchema } from './common';

export const GOAL_TYPES = ['Car', 'House', 'Marriage', 'Education', 'Retirement', 'Emergency Fund', 'Travel', 'Custom'] as const;
export const GOAL_PRIORITIES = ['high', 'medium', 'low'] as const;
export const PRIORITY_LABELS: Record<(typeof GOAL_PRIORITIES)[number], string> = { high: 'High', medium: 'Medium', low: 'Low' };

/**
 * A financial goal (spec §17). Fields the user edits.
 * The required monthly contribution is calculated from these, not stored.
 */
export const goalInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name must be 120 characters or fewer'),
  type: z.enum(GOAL_TYPES, { error: 'Choose a goal type' }),
  targetAmount: amountSchema('Target amount').gt(0, 'Target amount must be more than 0'),
  savedAmount: amountSchema('Saved amount'),
  targetDate: isoDateSchema,
  /** Optional: blank means a family goal. */
  ownerId: optionalTextSchema(100, 'Owner'),
  priority: z.enum(GOAL_PRIORITIES, { error: 'Choose a priority' }),
  /** Return expected on money saved for this goal. Blank = 0%. */
  expectedReturn: z
    .number({ error: 'Enter a valid return' })
    .min(-100, 'Return must be between -100% and 100%')
    .max(100, 'Return must be between -100% and 100%')
    .optional(),
  notes: optionalTextSchema(1000, 'Notes'),
});
export type GoalInput = z.input<typeof goalInputSchema>;

export const goalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  targetAmount: z.number(),
  savedAmount: z.number(),
  targetDate: z.string(),
  ownerId: z.string().optional(),
  priority: z.enum(GOAL_PRIORITIES),
  expectedReturn: z.number().optional(),
  notes: z.string().optional(),
  isDemo: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Goal = z.infer<typeof goalSchema>;
