import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

config({ path: resolve(packageDirectory, "../../.env") });

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está configurada");
  }

  return databaseUrl;
}
