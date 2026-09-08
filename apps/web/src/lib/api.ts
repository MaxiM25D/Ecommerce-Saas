import { beginOperation } from "./pending-operation";

// Requests go through the web domain so authentication cookies remain first-party.
const apiUrl = "/api";

export function apiAbsoluteUrl(path: string): string {
  return `${apiUrl}${path}`;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const mutation = !["GET", "HEAD", "OPTIONS"].includes((init.method ?? "GET").toUpperCase());
  const release = mutation && typeof window !== "undefined" ? beginOperation() : () => {};
  const timeout = AbortSignal.timeout(mutation ? 120_000 : 20_000);
  try {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    credentials: "include",
    headers: {
      ...(init.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(response.status, body?.message ?? "No se pudo completar la operación");
  }

  if (response.status === 204) return undefined as T;
  return await response.json() as T;
  } catch (error) {
    if (timeout.aborted) throw new ApiError(408, mutation
      ? "No pudimos confirmar el resultado a tiempo. Revisá el estado antes de volver a enviar."
      : "La consulta está tardando demasiado. Volvé a intentar en unos instantes.");
    throw error;
  } finally {
    release();
  }
}
