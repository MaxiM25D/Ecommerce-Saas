import { z } from "zod";

export const tenantIdSchema = z.string().trim().min(1).max(64);

export const planCodeSchema = z.literal("PRO");

export const updateCommercialPlanSchema = z
  .object({
    priceInCents: z.number().int().min(100).max(2_000_000_000).optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
    syncExistingSubscriptions: z.boolean().default(true),
  })
  .strict()
  .refine(
    (input) => input.priceInCents !== undefined || input.trialDays !== undefined,
    "Enviá un precio o una duración de prueba",
  );

export const updateTenantSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
}).strict();

export const updateSubscriptionSchema = z
  .object({
    planCode: z.literal("PRO").optional(),
    status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"]).optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, "Enviá al menos un cambio");
