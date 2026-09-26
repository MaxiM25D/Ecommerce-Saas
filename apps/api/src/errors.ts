import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";

import { log } from "./services/logger.js";

const fieldLabels: Record<string, string> = {
  announcement: "el anuncio superior",
  banner: "la portada",
  bannerUrl: "la portada",
  contactEmail: "el email de contacto",
  description: "la descripción",
  email: "el email",
  emailFromName: "el nombre del remitente",
  firstName: "el nombre",
  images: "las imágenes",
  lastName: "el apellido",
  logo: "el logo",
  logoUrl: "el logo",
  name: "el nombre",
  password: "la contraseña",
  primaryColor: "el color principal",
  secondaryColor: "el color secundario",
  storeName: "el nombre de la tienda",
  storeSlug: "la dirección de la tienda",
  whatsapp: "el WhatsApp",
};

function validationMessage(issue: ZodError["issues"][number]): string {
  const spanishMessage = /^(Completá|Debe|Elegí|El |Enviá|Ingresá|La |No |Revisá|Seleccioná|Usá)/.test(issue.message);
  if (spanishMessage) return issue.message;
  const metadata = issue as typeof issue & {
    format?: string;
    maximum?: number;
    minimum?: number;
    origin?: string;
  };
  if (issue.code === "too_small")
    return metadata.origin === "string"
      ? `Debe tener al menos ${metadata.minimum} caracteres`
      : `Debe incluir al menos ${metadata.minimum} elementos`;
  if (issue.code === "too_big")
    return metadata.origin === "string"
      ? `No puede superar los ${metadata.maximum} caracteres`
      : `No puede incluir más de ${metadata.maximum} elementos`;
  if (issue.code === "invalid_format" && metadata.format === "email")
    return "Ingresá un email válido";
  if (issue.code === "invalid_format" && metadata.format === "url")
    return "Ingresá una dirección web completa y válida";
  if (issue.code === "invalid_type") return "El valor ingresado no tiene el formato esperado";
  if (issue.code === "invalid_value") return "Elegí una opción válida";
  if (issue.code === "unrecognized_keys") return "El formulario contiene campos que no corresponden";
  return issue.message === "Invalid input" ? "Revisá el valor ingresado" : issue.message;
}

function validationField(path: PropertyKey[]): string {
  const key = [...path].reverse().find((segment) => typeof segment === "string");
  if (!key) return "este formulario";
  return fieldLabels[String(key)] ?? String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof MulterError) {
    const uploadMessages: Partial<Record<MulterError["code"], string>> = {
      LIMIT_FILE_COUNT: "Seleccionaste más archivos de los permitidos",
      LIMIT_FILE_SIZE: "El archivo supera el tamaño permitido",
      LIMIT_UNEXPECTED_FILE: "El archivo no corresponde a este campo o supera la cantidad permitida",
    };
    response.status(400).json({
      error: "UPLOAD_ERROR",
      message: uploadMessages[error.code] ?? "No pudimos procesar el archivo. Revisá el formato y volvé a intentarlo",
      details: error.field ? [{ field: error.field, message: uploadMessages[error.code] ?? "No se pudo procesar el archivo" }] : [],
    });
    return;
  }
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: validationMessage(issue),
    }));
    const firstIssue = error.issues[0];
    response.status(400).json({
      error: "VALIDATION_ERROR",
      message: firstIssue
        ? `Revisá ${validationField(firstIssue.path)}: ${validationMessage(firstIssue)}`
        : "Revisá los datos ingresados",
      details,
    });
    return;
  }

  if (error instanceof HttpError) {
    if (error.status >= 500) log("error", "http_error", { requestId: request.requestId, method: request.method, path: request.path, status: error.status, error });
    response.status(error.status).json({ error: "REQUEST_ERROR", message: error.message });
    return;
  }

  log("error", "unhandled_request_error", { requestId: request.requestId, method: request.method, path: request.path, error });
  response.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" });
};
