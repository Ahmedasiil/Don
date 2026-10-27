import { loadPlatformSettings } from "@/lib/platform-plugins";
import { safeEqual } from "@/lib/crypto";
import { transaction } from "@/lib/pay/providers/thunes";
import { settle } from "@/lib/pay/transfers";

// Thunes transaction callbacks. The body is only a hint: we check our secret and re-read the status from Thunes.
export async function POST(req: Request) {
  await loadPlatformSettings();
  const k = new URL(req.url).searchParams.get("k") ?? "";
  if (!process.env.THUNES_CALLBACK_SECRET || !safeEqual(k, process.env.THUNES_CALLBACK_SECRET)) return new Response("Forbidden", { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: number };
  if (b.id) {
    const t = await transaction(String(b.id));
    await settle("thunes", String(t.id), t.status_message || t.status);
  }
  return Response.json({ received: true });
}
