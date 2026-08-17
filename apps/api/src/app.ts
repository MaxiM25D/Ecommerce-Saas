import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { environment } from "./config.js";
import { errorHandler } from "./errors.js";
import { adminRouter } from "./modules/admin/routes.js";
import { authRouter } from "./modules/auth/routes.js";
import { storefrontRouter } from "./modules/storefront/routes.js";
import { platformRouter } from "./modules/platform/routes.js";
import { tenantRouter } from "./modules/tenants/routes.js";
import { adminIntegrationRouter, integrationRouter } from "./modules/integrations/routes.js";
import { paymentRouter } from "./modules/payments/routes.js";
import { publicRoot } from "./services/storage.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: environment.WEB_URL, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use("/uploads", express.static(publicRoot, { maxAge: "1d" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "infinityshop-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/tenants", tenantRouter);
app.use("/api/storefront", storefrontRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin/integrations", adminIntegrationRouter);
app.use("/api/integrations", integrationRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/platform", platformRouter);

app.use((_request, response) => {
  response.status(404).json({ error: "NOT_FOUND", message: "Ruta no encontrada" });
});
app.use(errorHandler);
