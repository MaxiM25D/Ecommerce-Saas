import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Los datos enviados no son válidos",
      details: error.issues.map(({ path, message }) => ({ field: path.join("."), message })),
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.status).json({ error: "REQUEST_ERROR", message: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" });
};
