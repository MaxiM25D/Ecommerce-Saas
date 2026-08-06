import cors from "cors";
import express from "express";

import { environment } from "./config.js";

export const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: environment.WEB_URL, credentials: true }));
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "lunek-api" });
});
