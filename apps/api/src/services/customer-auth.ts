import { database } from "../database.js";
import { HttpError } from "../errors.js";
import { hashAccountToken } from "./account-tokens.js";

export async function requireCustomerSession(
  tenantId: string,
  token: string | undefined,
) {
  if (!token) throw new HttpError(401, "Iniciá sesión para ver tus pedidos");
  const session = await database.customerSession.findFirst({
    where: {
      tenantId,
      tokenHash: hashAccountToken(token),
      expiresAt: { gt: new Date() },
    },
    include: { customer: true },
  });
  if (!session) throw new HttpError(401, "La sesión venció o no es válida");
  await database.customerSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });
  return session;
}
