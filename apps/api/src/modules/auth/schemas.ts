import { z } from "zod";

const email = z.email().trim().toLowerCase().max(254);
const password = z.string().min(10).max(72);
export const tenantSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usá letras minúsculas, números y guiones simples");

export const registerSchema = z
  .object({
    email,
    password,
    firstName: z.string().trim().min(2).max(60),
    lastName: z.string().trim().min(2).max(60),
    storeName: z.string().trim().min(2).max(100),
    storeSlug: tenantSlug,
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    password,
    tenantSlug: tenantSlug.optional(),
  })
  .strict();

export const selectTenantSchema = z.object({ tenantSlug }).strict();

const accountToken = z.string().trim().min(32).max(256);

export const forgotPasswordSchema = z.object({ email }).strict();

export const resetPasswordSchema = z.object({ token: accountToken, password }).strict();

export const verifyEmailSchema = z.object({ token: accountToken }).strict();

export const invitationTokenSchema = z.object({ token: accountToken }).strict();

export const acceptInvitationSchema = z
  .object({
    token: accountToken,
    password,
    firstName: z.string().trim().min(2).max(60).optional(),
    lastName: z.string().trim().min(2).max(60).optional(),
  })
  .strict();
