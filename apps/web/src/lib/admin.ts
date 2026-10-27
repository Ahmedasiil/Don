import { db } from "./db";

/** Every super admin action is recorded with who did it. */
export async function adminAudit(userId: string | null, action: string, entity?: string, entityId?: string, data?: unknown) {
  await db.auditLog.create({ data: { userId, actor: "super-admin", action, entity, entityId, data: data === undefined ? undefined : JSON.parse(JSON.stringify(data)) } });
}
