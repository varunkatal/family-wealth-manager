import { z } from 'zod';
import { optionalTextSchema, pastOrTodayDateSchema } from './common';

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

/** Fields the user edits. */
export const familyMemberInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  relationship: z.string().trim().max(50),
  dateOfBirth: z
    .union([z.literal(''), pastOrTodayDateSchema('Date of birth cannot be in the future')])
    .optional()
    .transform((v) => (v ? v : undefined)),
  notes: optionalTextSchema(1000, 'Notes'),
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
