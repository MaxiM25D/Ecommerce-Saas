import { randomUUID } from "node:crypto";

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { environment } from "./config.js";
import { errorHandler, HttpError } from "./errors.js";
import { adminRouter } from "./modules/admin/routes.js";
import { authRouter } from "./modules/auth/routes.js";
import { storefrontRouter } from "./modules/storefront/routes.js";
import { platformRouter } from "./modules/platform/routes.js";
import { tenantRouter } from "./modules/tenants/routes.js";
import { adminIntegrationRouter, integrationRouter } from "./modules/integrations/routes.js";
import { paymentRouter } from "./modules/payments/routes.js";
import { billingRouter } from "./modules/billing/routes.js";
import { growthRouter } from "./modules/growth/routes.js";
import { publicRoot } from "./services/storage.js";
import { database } from "./database.js";
import { log } from "./services/logger.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", environment.TRUST_PROXY_HOPS);
app.use((request, response, next) => {
  const suppliedId = request.get("x-request-id");
  request.requestId = suppliedId && /^[a-zA-Z0-9._-]{1,100}$/.test(suppliedId) ? suppliedId : randomUUID();
  response.setHeader("x-request-id", request.requestId);
  const startedAt = performance.now();
  response.on("finish", () => {
    log(response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "info", "http_request", {
      requestId: request.requestId,
      method: request.method,
      path: request.path,
      status: response.statusCode,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      tenantId: request.auth?.tenant.id,
      userId: request.auth?.user.id,
    });
  });
  next();
});
app.use(helmet());
async function isVerifiedStoreOrigin(origin: string): Promise<boolean> {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return Boolean(await database.customDomain.findFirst({ where: { hostname, status: "VERIFIED", tenant: { status: "ACTIVE" } }, select: { id: true } }));
  } catch { return false; }
}

app.use(cors((request, callback) => {
  const origin = request.get("origin");
  if (!origin || origin === new URL(environment.WEB_URL).origin) return callback(null, { origin: origin ?? false, credentials: true });
  if (!request.path.startsWith("/api/storefront/")) return callback(null, { origin: false });
  void isVerifiedStoreOrigin(origin).then((allowed) => callback(null, { origin: allowed ? origin : false, credentials: false })).catch(() => callback(null, { origin: false }));
}));
app.use(async (request, _response, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const origin = request.get("origin");
    const customStoreOrigin = origin && request.path.startsWith("/api/storefront/") ? await isVerifiedStoreOrigin(origin) : false;
    if (origin && origin !== new URL(environment.WEB_URL).origin && !customStoreOrigin) {
      next(new HttpError(403, "Origen no permitido"));
      return;
    }
  }
  next();
});
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use("/uploads", express.static(publicRoot, { maxAge: "1d" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "infinityshop-api", version: environment.APP_VERSION, uptimeSeconds: Math.round(process.uptime()) });
});

app.get("/api/ready", async (_request, response) => {
  try {
    await database.$queryRaw`SELECT 1`;
    response.json({ status: "ready", database: "ok" });
  } catch (error) {
    log("error", "readiness_failed", { error });
    response.status(503).json({ status: "unavailable", database: "error" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/tenants", tenantRouter);
app.use("/api/storefront", storefrontRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin/integrations", adminIntegrationRouter);
app.use("/api/integrations", integrationRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/billing", billingRouter);
app.use("/api/admin/growth", growthRouter);
app.use("/api/platform", platformRouter);

app.use((_request, response) => {
  response.status(404).json({ error: "NOT_FOUND", message: "Ruta no encontrada" });
});
app.use(errorHandler);
