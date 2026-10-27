import { ok, requireSuperAdmin, route } from "@/lib/http";
import { db } from "@/lib/db";
import { BASE, travelFeeBps } from "@/lib/pay/config";

// Flights, hotels and eSIMs sold, and any booking that needs a look.
export const GET = route(async (req: Request) => {
  await requireSuperAdmin();
  const status = new URL(req.url).searchParams.get("status");
  const month = new Date(Date.now() - 30 * 86400_000);
  const [bookings, byKind, esims] = await Promise.all([
    db.payBooking.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 150 }),
    db.payBooking.groupBy({ by: ["kind", "status"], where: { createdAt: { gte: month } }, _sum: { amountCents: true }, _count: true }),
    db.payEsimOrder.groupBy({ by: ["status"], where: { createdAt: { gte: month } }, _sum: { priceCents: true }, _count: true }),
  ]);
  const users = Object.fromEntries((await db.user.findMany({ where: { id: { in: [...new Set(bookings.map((b) => b.userId))] } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]));
  return ok({ currency: BASE, feeBps: travelFeeBps(), byKind, esims, bookings: bookings.map(({ idempotencyKey: _k, ...b }) => ({ ...b, customer: users[b.userId] ?? null })) });
});
