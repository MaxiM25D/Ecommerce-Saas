import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";

import { log } from "./services/logger.js";

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
    response.status(400).json({
      error: "UPLOAD_ERROR",
      message: error.code === "LIMIT_FILE_SIZE" ? "El archivo supera el tamaño permitido" : "No se pudo procesar el archivo",
    });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Los datos enviados no son válidos",
      details: error.issues.map(({ path, message }) => ({ field: path.join("."), message })),
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
