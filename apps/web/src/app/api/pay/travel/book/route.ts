import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requirePay } from "@/lib/pay/guard";
import { bookFlight, bookStay } from "@/lib/pay/travel";

const name = z.string().min(1).max(60);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const traveller = z.object({ title: z.enum(["mr", "ms", "mrs", "miss", "dr"]), given_name: name, family_name: name, born_on: day, gender: z.enum(["m", "f"]), email: z.string().email(), phone_number: z.string().regex(/^\+\d{7,15}$/) });
const common = { pin: z.string().regex(/^\d{6}$/), code: z.string().max(12).optional(), idempotencyKey: z.string().min(16).max(80) };

export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { money: true, action: "travel-book" });
  const d = await body(req, z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("FLIGHT"), offerId: z.string().max(80), travellers: z.array(traveller).min(1).max(9), ...common }),
    z.object({ kind: z.literal("STAY"), rateId: z.string().max(80), hotel: z.string().max(120), checkIn: day, checkOut: day, guest: z.object({ given_name: name, family_name: name }), phone: z.string().regex(/^\+\d{7,15}$/), ...common }),
  ]));
  const b = d.kind === "FLIGHT" ? await bookFlight(ctx, d) : await bookStay(ctx, d);
  return ok({ id: b.id, status: b.status, reference: b.reference, title: b.title }, 201);
});
