import { z } from "zod";

export const selectBillingPlanSchema = z.object({ planCode: z.enum(["STARTER", "PRO"]) }).strict();
export const cancelBillingSchema = z.object({ immediately: z.boolean().default(false) }).strict();

export const billingWebhookSchema = z.object({
  type: z.string().min(1),
  action: z.string().optional(),
  data: z.object({ id: z.union([z.string(), z.number()]).transform(String) }),
}).passthrough();
