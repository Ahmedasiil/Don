import { db } from "../db";
import { sendPush } from "../push";
import { retryStuck, settle } from "./transfers";
import { screenProfile } from "./risk";
import { quotes } from "./providers/market";
import * as airwallex from "./providers/airwallex";
import * as thunes from "./providers/thunes";

/** Re-read transfers that have been on their way for over 10 minutes, in case a webhook was missed. */
export async function syncTransfers() {
  await retryStuck().catch((e) => console.error("retryStuck", e));
  const list = await db.payTransfer.findMany({ where: { status: "SENT", providerRef: { not: null }, updatedAt: { lt: new Date(Date.now() - 600_000) } }, take: 50, orderBy: { updatedAt: "asc" } });
  let n = 0;
  for (const t of list) {
    try {
      if (t.provider === "airwallex") { const r = await airwallex.transfer(t.providerRef!); await settle("airwallex", r.id, r.status, r.failure_reason); }
      else if (t.provider === "thunes") { const r = await thunes.transaction(t.providerRef!); await settle("thunes", String(r.id), r.status_message || r.status); }
      await db.payTransfer.update({ where: { id: t.id }, data: { updatedAt: new Date() } });
      n++;
    } catch (e) { console.error("transfer sync", t.id, e); }
  }
  return n;
}

/** Price alerts from the watchlist (once per alert until the person resets it). */
export async function priceAlerts() {
  const watch = await db.payWatch.findMany({ where: { alertedAt: null, OR: [{ alertAbove: { not: null } }, { alertBelow: { not: null } }] } });
  if (!watch.length) return 0;
  const q = new Map((await quotes()).map((x) => [x.symbol, x]));
  let n = 0;
  for (const w of watch) {
    const p = q.get(w.symbol)?.price;
    if (p == null) continue;
    const hit = (w.alertAbove && p >= w.alertAbove) ? `is above ${w.alertAbove}` : (w.alertBelow && p <= w.alertBelow) ? `is below ${w.alertBelow}` : null;
    if (!hit) continue;
    await sendPush(w.userId, `${w.symbol} ${hit}`, `Now ${p.toLocaleString("en-CA", { maximumFractionDigits: 4 })}`, { link: "/app/markets" }).catch(() => {});
    await db.payWatch.update({ where: { id: w.id }, data: { alertedAt: new Date() } });
    n++;
  }
  return n;
}

/** Sanctions lists change daily: re-screen every verified customer once a week. */
export async function rescreen() {
  const due = await db.payProfile.findMany({ where: { kycStatus: "VERIFIED", OR: [{ screenedAt: null }, { screenedAt: { lt: new Date(Date.now() - 7 * 86400_000) } }] }, take: 200, select: { userId: true } });
  for (const p of due) await screenProfile(p.userId).catch(() => {});
  return due.length;
}

/** Card checkouts nobody finished. */
export const expireTopUps = async () => (await db.payTopUp.updateMany({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 86400_000) } }, data: { status: "FAILED" } })).count;
