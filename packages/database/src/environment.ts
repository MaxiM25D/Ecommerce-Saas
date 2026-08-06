import { existsSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

function findEnvironmentFile(startDirectory: string): string | undefined {
  let directory = resolve(startDirectory);
  const root = parse(directory).root;

  while (directory !== root) {
    const candidate = join(directory, ".env");
    if (existsSync(candidate)) return candidate;
    directory = dirname(directory);
  }

  return undefined;
}

const environmentFile =
  findEnvironmentFile(process.cwd()) ?? findEnvironmentFile(dirname(fileURLToPath(import.meta.url)));

if (environmentFile) config({ path: environmentFile });

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está configurada");
  }

  return databaseUrl;
}
