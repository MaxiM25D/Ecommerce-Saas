import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { z } from "zod";

const applicationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

config({ path: resolve(applicationDirectory, "../../.env") });

const emptyAsUndefined = (value: unknown) => value === "" ? undefined : value;
const optionalText = z.preprocess(emptyAsUndefined, z.string().trim().min(1).optional());
const optionalSecret = z.preprocess(emptyAsUndefined, z.string().min(1).optional());
const optionalEmail = z.preprocess(emptyAsUndefined, z.email().optional());

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_PUBLIC_URL: z.url().default("http://localhost:4000"),
  WEB_URL: z.url().default("http://localhost:3000"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  MP_CLIENT_ID: optionalText,
  MP_CLIENT_SECRET: optionalText,
  MP_WEBHOOK_SECRET: optionalText,
  MP_TOKEN_ENCRYPTION_KEY: z.preprocess(emptyAsUndefined, z.string().min(32).optional()),
  SMTP_HOST: optionalText,
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z.string().default("true").transform((value) => value === "true"),
  SMTP_USER: optionalText,
  SMTP_PASS: optionalSecret,
  SMTP_FROM: optionalEmail,
  CLOUDINARY_NAME: optionalText,
  CLOUDINARY_KEY: optionalText,
  CLOUDINARY_SECRET: optionalText,
  PUBLIC_UPLOAD_DIR: z.string().default("storage/public"),
  PRIVATE_UPLOAD_DIR: z.string().default("storage/private"),
  RESERVATION_SWEEP_INTERVAL_MS: z.coerce.number().int().min(10_000).default(60_000),
});

export const environment = environmentSchema.parse(process.env);
