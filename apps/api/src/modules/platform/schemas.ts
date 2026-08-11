import { z } from "zod";

export const tenantIdSchema = z.string().trim().min(1).max(64);

export const updateTenantSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
}).strict();

export const updateSubscriptionSchema = z
  .object({
    planCode: z.enum(["FREE", "STARTER", "PRO"]).optional(),
    status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"]).optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, "Enviá al menos un cambio");
