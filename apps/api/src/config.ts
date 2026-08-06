import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_URL: z.url().default("http://localhost:3000"),
});

export const environment = environmentSchema.parse(process.env);
