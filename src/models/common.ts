import { z } from 'zod';
import { todayISODate } from '../utils/date';

/** A YYYY-MM-DD date string. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00`).getTime()), 'Enter a valid date');

export const pastOrTodayDateSchema = (message: string) => isoDateSchema.refine((v) => v <= todayISODate(), message);

const MAX_AMOUNT = 1e13; // ₹10 lakh crore: far above any household amount, guards against typos

/** A rupee amount: zero or more, with a sanity upper bound. */
export const amountSchema = (label: string) =>
  z
    .number({ error: `Enter a valid ${label.toLowerCase()}` })
    .min(0, `${label} cannot be negative`)
    .max(MAX_AMOUNT, `${label} is too large`);

/** Optional free text: trimmed, and empty becomes undefined. */
export const optionalTextSchema = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .optional()
    .transform((v) => v || undefined);
