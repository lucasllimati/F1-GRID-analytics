import { db } from "./db";

export async function audit(actor: string, action: string, entity: string, entityId: string | null, details: unknown = {}) {
  await db.auditLog.create({
    data: { actor, action, entity, entityId, details: JSON.stringify(details).slice(0, 8000) },
  });
}
