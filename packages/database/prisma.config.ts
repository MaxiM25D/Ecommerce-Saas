import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

const packageDirectory = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(packageDirectory, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
