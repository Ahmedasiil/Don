import { db } from "./db";
import type { Ctx } from "./auth";

export async function audit(ctx: Partial<Ctx> & { ip?: string | null }, action: string, entity?: string, entityId?: string, data?: unknown) {
  try {
    await db.auditLog.create({
      data: {
        userId: ctx.user?.id ?? null,
        actor: ctx.actor ?? "system",
        action,
        entity,
        entityId,
        ip: ctx.ip ?? null,
        data: data === undefined ? undefined : JSON.parse(JSON.stringify(data)),
      },
    });
  } catch (e) {
    console.error("audit failed", e);
  }
}
