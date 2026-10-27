import { loadPlatformSettings } from "@/lib/platform-plugins";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { handleStripePay } from "@/lib/pay/webhooks";

// Stripe: wallet top-ups, identity checks and real-time card decisions. Every event is signature-checked.
export async function POST(req: Request) {
  await loadPlatformSettings();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new Response("Not configured", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }
  const pay = await handleStripePay(event);
  if (pay) return pay;
  return Response.json({ received: true });
}
