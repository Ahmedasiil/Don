import { db } from "@/lib/db";
import { ok, requireSuperAdmin, route } from "@/lib/http";

// The compliance queue: transfers held for review, open risk events, and identity checks needing a person.
export const GET = route(async (req: Request) => {
  await requireSuperAdmin();
  const status = new URL(req.url).searchParams.get("status") ?? "OPEN";
  const [transfers, risks, kyc] = await Promise.all([
    db.payTransfer.findMany({ where: { status: "REVIEW" }, orderBy: { createdAt: "asc" }, take: 100, include: { recipient: { select: { name: true, country: true, method: true, network: true, label: true, sanctionsHit: true } } } }),
    db.payRiskEvent.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.payProfile.findMany({ where: { OR: [{ kycStatus: "REVIEW" }, { sanctionsHit: true }, { pepHit: true }, { frozenAt: { not: null } }] }, orderBy: { updatedAt: "desc" }, take: 100 }),
  ]);
  const ids = [...new Set([...transfers.map((t) => t.userId), ...risks.map((r) => r.userId), ...kyc.map((p) => p.userId)])];
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true, phone: true, createdAt: true } });
  const profiles = await db.payProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, legalName: true, country: true, tier: true, kycStatus: true, riskLevel: true, sanctionsHit: true, pepHit: true, frozenAt: true, frozenReason: true, dob: true } });
  const who = (id: string) => ({ user: users.find((u) => u.id === id) ?? null, profile: profiles.find((p) => p.userId === id) ?? null });
  return ok({
    transfers: transfers.map((t) => ({ ...t, ...who(t.userId) })),
    risks: risks.map((r) => ({ ...r, ...who(r.userId) })),
    kyc: kyc.map(({ pinHash: _p, kycSessionId: _s, ...p }) => ({ ...p, user: users.find((u) => u.id === p.userId) ?? null })),
  });
});
