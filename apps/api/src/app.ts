import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { environment } from "./config.js";
import { errorHandler } from "./errors.js";
import { authRouter } from "./modules/auth/routes.js";
import { tenantRouter } from "./modules/tenants/routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: environment.WEB_URL, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "lunek-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/tenants", tenantRouter);

app.use((_request, response) => {
  response.status(404).json({ error: "NOT_FOUND", message: "Ruta no encontrada" });
});
app.use(errorHandler);
