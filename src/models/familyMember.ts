import { z } from 'zod';
import { todayISODate } from '../utils/date';

export const RELATIONSHIPS = [
  'Self',
  'Spouse',
  'Son',
  'Daughter',
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Grandfather',
  'Grandmother',
  'Other',
] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00`).getTime()), 'Enter a valid date');

/** Fields the user edits. */
export const familyMemberInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  relationship: z.string().trim().max(50),
  dateOfBirth: z
    .union([z.literal(''), isoDate.refine((v) => v <= todayISODate(), 'Date of birth cannot be in the future')])
    .optional()
    .transform((v) => (v ? v : undefined)),
  notes: z.string().trim().max(1000, 'Notes must be 1000 characters or fewer').optional().transform((v) => v || undefined),
  isActive: z.boolean(),
});
export type FamilyMemberInput = z.input<typeof familyMemberInputSchema>;

/** A stored family member. */
export const familyMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  relationship: z.string(),
  dateOfBirth: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FamilyMember = z.infer<typeof familyMemberSchema>;
