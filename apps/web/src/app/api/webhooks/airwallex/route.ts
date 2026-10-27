import { loadPlatformSettings } from "@/lib/platform-plugins";
import { hmac, safeEqual } from "@/lib/crypto";
import { transfer } from "@/lib/pay/providers/airwallex";
import { settle } from "@/lib/pay/transfers";

// Airwallex payout status. Signed with HMAC-SHA256 over timestamp + body; we then re-read the transfer from Airwallex.
export async function POST(req: Request) {
  await loadPlatformSettings();
  const secret = process.env.AIRWALLEX_WEBHOOK_SECRET;
  const ts = req.headers.get("x-timestamp") ?? "";
  const sig = req.headers.get("x-signature") ?? "";
  const raw = await req.text();
  if (!secret || !ts || !sig) return new Response("Not configured", { status: 400 });
  if (Math.abs(Date.now() - Number(ts)) > 5 * 60_000) return new Response("Stale", { status: 400 });
  if (!safeEqual(hmac(secret, ts + raw), sig)) return new Response("Bad signature", { status: 401 });
  const e = JSON.parse(raw) as { name?: string; data?: { object?: { id?: string } } };
  const id = e.data?.object?.id;
  if (id && e.name?.startsWith("payout.transfer")) {
    const t = await transfer(id);
    await settle("airwallex", t.id, t.status, t.failure_reason);
  }
  return Response.json({ received: true });
}
