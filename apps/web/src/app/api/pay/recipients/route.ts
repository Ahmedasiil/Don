import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { addRecipient } from "@/lib/pay/transfers";

const field = z.string().trim().max(64).optional();

export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req);
  const list = await db.payRecipient.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, country: true, currency: true, method: true, network: true, label: true, createdAt: true } });
  return ok({ recipients: list });
});

export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { money: true, action: "recipient" });
  const d = await body(req, z.object({
    name: z.string().trim().min(2).max(80).regex(/^[\p{L}\p{M}' .-]+$/u, "Use the recipient's full legal name."),
    country: z.string().length(2), method: z.string().max(20), network: z.string().max(40).nullish(), code: z.string().max(12).optional(),
    details: z.object({ accountNumber: field, iban: field, swift: field, bankName: field, phone: field, ipa: field, cardNumber: field, walletId: field, city: field, street: field }),
  }));
  const r = await addRecipient(ctx, d);
  return ok({ id: r.id, name: r.name, label: r.label, country: r.country, method: r.method }, 201);
});
