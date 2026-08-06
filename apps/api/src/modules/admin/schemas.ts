import { z } from "zod";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usá letras minúsculas, números y guiones simples");
const resourceId = z.string().trim().min(1).max(64);
const optionalUrl = z.url().trim().max(2048).nullable().optional();

export const resourceIdSchema = resourceId;

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    slug,
  })
  .strict();

export const updateCategorySchema = createCategorySchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, "Enviá al menos un campo");

export const createProductSchema = z
  .object({
    categoryId: resourceId.nullable().optional(),
    sku: z.string().trim().toUpperCase().min(2).max(64),
    slug,
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(4000).nullable().optional(),
    priceInCents: z.number().int().min(0).max(2_000_000_000),
    stock: z.number().int().min(0).max(2_000_000_000),
    images: z.array(z.url().max(2048)).max(8).default([]),
    active: z.boolean().default(true),
  })
  .strict();

export const updateProductSchema = createProductSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, "Enviá al menos un campo");

export const updateStoreSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    logoUrl: optionalUrl,
    bannerUrl: optionalUrl,
    primaryColor: z
      .string()
      .trim()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Usá un color hexadecimal de seis dígitos")
      .optional(),
    contactEmail: z.email().trim().toLowerCase().max(254).nullable().optional(),
    whatsapp: z.string().trim().max(30).nullable().optional(),
    currency: z.string().trim().toUpperCase().length(3).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, "Enviá al menos un campo");
