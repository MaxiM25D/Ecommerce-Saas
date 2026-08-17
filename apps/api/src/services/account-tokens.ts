import { createHash, randomBytes } from "node:crypto";

import { environment } from "../config.js";

export function createAccountToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashAccountToken(token) };
}

export function hashAccountToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function expiresInHours(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function expiresInMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function developmentUrl(path: string, token: string): string | undefined {
  if (environment.NODE_ENV === "production") return undefined;
  const url = new URL(path, environment.WEB_URL);
  url.searchParams.set("token", token);
  return url.toString();
}
