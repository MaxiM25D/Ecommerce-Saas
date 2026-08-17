import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { environment } from "../config.js";
import { HttpError } from "../errors.js";

function encryptionKey(): Buffer {
  if (!environment.MP_TOKEN_ENCRYPTION_KEY) {
    throw new HttpError(503, "Configurá MP_TOKEN_ENCRYPTION_KEY para conectar Mercado Pago");
  }
  return createHash("sha256").update(environment.MP_TOKEN_ENCRYPTION_KEY).digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(value: string): string {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Secreto cifrado inválido");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function hashOpaqueToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
