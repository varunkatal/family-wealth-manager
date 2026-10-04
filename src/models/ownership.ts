import { z } from 'zod';

/** One family member's share of one asset (spec §10, §23). */
export const assetOwnershipSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  familyMemberId: z.string().min(1),
  percentage: z.number().gt(0).max(100),
});
export type AssetOwnership = z.infer<typeof assetOwnershipSchema>;

/** Allows for floating-point noise such as 33.33 + 33.33 + 33.34. */
const TOTAL_TOLERANCE = 0.001;

/**
 * Owners entered on the asset form. At least one is required; shares may total
 * less than 100% when part of the asset belongs to someone outside the family.
 */
export const ownersInputSchema = z
  .array(
    z.object({
      familyMemberId: z.string().min(1, 'Choose a family member for each owner'),
      percentage: z
        .number({ error: 'Enter a valid ownership %' })
        .gt(0, "Each owner's share must be more than 0%")
        .max(100, "An owner's share cannot exceed 100%"),
    }),
    { error: 'Add at least one owner' },
  )
  .min(1, 'Add at least one owner')
  .superRefine((owners, ctx) => {
    const ids = owners.map((o) => o.familyMemberId).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: 'Each family member can only be listed once' });
    }
    const total = owners.reduce((sum, o) => sum + (Number.isFinite(o.percentage) ? o.percentage : 0), 0);
    if (total > 100 + TOTAL_TOLERANCE) {
      ctx.addIssue({ code: 'custom', message: `Shares add up to ${Math.round(total * 100) / 100}%, which is more than 100%` });
    }
  });
export type OwnerInput = z.input<typeof ownersInputSchema>[number];
