import { ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { places } from "@/lib/pay/providers/duffel";

// My trips, and place search for the from/to boxes (?q=).
export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "travel" });
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (q) return ok({ places: q.length < 2 ? [] : (await places(q)).slice(0, 8).map((p) => ({ id: p.id, name: p.name, type: p.type, iata: p.iata_code, city: p.city_name, country: p.iata_country_code })) });
  const [bookings, esims, thread] = await Promise.all([
    db.payBooking.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.payEsimOrder.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.payTravelThread.findUnique({ where: { userId: ctx.user.id } }),
  ]);
  return ok({ bookings: bookings.map(({ idempotencyKey: _k, offerId: _o, ...b }) => b), esims, messages: thread?.messages ?? [] });
});

// Start a fresh conversation with the travel agent.
export const DELETE = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "travel" });
  await db.payTravelThread.deleteMany({ where: { userId: ctx.user.id } });
  return ok({ ok: true });
});
