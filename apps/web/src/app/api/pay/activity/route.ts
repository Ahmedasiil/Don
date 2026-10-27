import { ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { BASE } from "@/lib/pay/config";

// Every movement on the wallet, with filters. ?format=csv returns a statement for the chosen dates.
const GROUPS: Record<string, string[]> = {
  in: ["TOPUP", "REQUEST_IN", "REWARD", "LOAN_OUT", "INVEST_SELL", "TRAVEL_REFUND", "BILL_REFUND"],
  transfers: ["TRANSFER", "REVERSAL", "REQUEST", "REQUEST_IN", "REQUEST_OUT"],
  cards: ["CARD", "CARD_REFUND"],
  bills: ["BILL", "BILL_REFUND"],
  invest: ["INVEST_BUY", "INVEST_SELL", "INVEST_REFUND"],
  travel: ["TRAVEL", "TRAVEL_REFUND", "ESIM", "ESIM_REFUND"],
  loans: ["LOAN_OUT", "LOAN_PAYMENT"],
};

export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "activity" });
  const u = new URL(req.url).searchParams;
  const from = u.get("from") ? new Date(u.get("from")!) : new Date(Date.now() - 90 * 86400_000);
  const to = u.get("to") ? new Date(new Date(u.get("to")!).getTime() + 86400_000) : new Date(Date.now() + 60_000);
  const q = u.get("q")?.trim();
  const group = GROUPS[u.get("type") ?? ""];
  const csv = u.get("format") === "csv";
  const journals = await db.payJournal.findMany({
    where: { userId: ctx.user.id, createdAt: { gte: from, lt: to }, ...(group ? { kind: { in: group } } : {}), ...(q ? { memo: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: { createdAt: "desc" }, take: csv ? 5000 : 200, include: { lines: true },
  });
  const rows = journals.map((j) => {
    const w = j.lines.filter((l) => l.walletId);
    return { id: j.id, kind: j.kind, memo: j.memo, at: j.createdAt, amountCents: w.reduce((s, l) => s + l.amountCents, 0), currency: w[0]?.currency ?? BASE };
  }).filter((r) => r.amountCents !== 0);
  const inCents = rows.filter((r) => r.amountCents > 0).reduce((a, r) => a + r.amountCents, 0);
  const outCents = rows.filter((r) => r.amountCents < 0).reduce((a, r) => a - r.amountCents, 0);
  if (csv) {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = ["Date,Description,Type,Amount,Currency", ...rows.map((r) => [r.at.toISOString().slice(0, 10), esc(r.memo ?? r.kind), r.kind, (r.amountCents / 100).toFixed(2), r.currency].join(","))];
    return new Response(lines.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="oenodpay-statement-${from.toISOString().slice(0, 10)}-to-${new Date(to.getTime() - 86400_000).toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
  }
  return ok({ rows, inCents, outCents, currency: BASE, from, to: new Date(to.getTime() - 86400_000) });
});
