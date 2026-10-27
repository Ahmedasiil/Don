import { z } from "zod";
import { body, ok, requireSuperAdmin, route } from "@/lib/http";
import { db } from "@/lib/db";
import { adminAudit } from "@/lib/admin";
import { billerSchema } from "@/lib/pay/bills";


export const POST = route(async (req: Request) => {
  const ctx = await requireSuperAdmin();
  const b = await db.payBiller.create({ data: await body(req, billerSchema) });
  await adminAudit(ctx.user.id, "bills.biller_added", "PayBiller", b.id, { name: b.name, country: b.country });
  return ok(b, 201);
});
