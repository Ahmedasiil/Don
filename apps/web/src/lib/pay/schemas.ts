import { z } from "zod";

// Request shapes shared by several Pay routes.

export const address = z.object({ line1: z.string().trim().min(3).max(120), city: z.string().trim().min(2).max(60), postal_code: z.string().trim().min(3).max(12), country: z.string().length(2), state: z.string().max(40).optional() });

export const rules = z.object({
  weeklyLimitCents: z.number().int().min(0).max(200_000),
  perPurchaseLimitCents: z.number().int().min(0).max(100_000).nullish(),
  approvalOverCents: z.number().int().min(0).max(100_000).nullish(),
  blockedGroups: z.array(z.string().max(20)).max(20).default([]),
  allowedMerchants: z.array(z.string().trim().min(2).max(60)).max(50).default([]),
  nightLock: z.boolean().default(false),
  onlineAllowed: z.boolean().default(true),
  countries: z.array(z.string().length(2)).max(50).default([]),
  allowanceCents: z.number().int().min(0).max(50_000).default(0),
  allowanceWeekday: z.number().int().min(0).max(6).default(0),
});
