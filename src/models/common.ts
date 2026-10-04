import { z } from 'zod';
import { todayISODate } from '../utils/date';

/** A YYYY-MM-DD date string. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00`).getTime()), 'Enter a valid date');

export const pastOrTodayDateSchema = (message: string) => isoDateSchema.refine((v) => v <= todayISODate(), message);

/** Optional free text: trimmed, and empty becomes undefined. */
export const optionalTextSchema = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .optional()
    .transform((v) => v || undefined);
