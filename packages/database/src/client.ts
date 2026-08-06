import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client/client.js";
import { getDatabaseUrl } from "./environment.js";

export function createDatabaseClient(databaseUrl = getDatabaseUrl()): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });

  return new PrismaClient({ adapter });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
