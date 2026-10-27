import { ok, requireSuperAdmin, route } from "@/lib/http";
import { db } from "@/lib/db";
import { BASE } from "@/lib/pay/config";

// Every customer, searchable by name, email or phone.
export const GET = route(async (req: Request) => {
  await requireSuperAdmin();
  const u = new URL(req.url).searchParams;
  const q = u.get("q")?.trim();
  const status = u.get("status");
  const pf = status === "frozen" ? { frozenAt: { not: null } } : status === "unverified" ? { kycStatus: { not: "VERIFIED" } } : status === "verified" ? { kycStatus: "VERIFIED" } : null;
  const users = await db.user.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
      ...(pf ? { id: { in: (await db.payProfile.findMany({ where: pf, select: { userId: true }, take: 2000 })).map((x) => x.userId) } } : {}),
    },
    orderBy: { createdAt: "desc" }, take: 100,
    select: { id: true, name: true, email: true, phone: true, createdAt: true, lastSeenAt: true, isSuperAdmin: true, totpEnabledAt: true },
  });
  const wallets = await db.payWallet.findMany({ where: { userId: { in: users.map((x) => x.id) }, currency: BASE }, select: { userId: true, balanceCents: true } });
  const profiles = Object.fromEntries((await db.payProfile.findMany({ where: { userId: { in: users.map((x) => x.id) } }, select: { userId: true, country: true, tier: true, kycStatus: true, riskLevel: true, frozenAt: true } })).map((p) => [p.userId, p]));
  const bal = Object.fromEntries(wallets.map((w) => [w.userId, w.balanceCents]));
  return ok({ currency: BASE, rows: users.map(({ totpEnabledAt, ...x }) => ({ ...x, payProfile: profiles[x.id] ?? null, twoFactor: !!totpEnabledAt, balanceCents: bal[x.id] ?? 0 })) });
});
