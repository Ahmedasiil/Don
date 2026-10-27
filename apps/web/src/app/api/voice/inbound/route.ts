import { loadPlatformSettings } from "@/lib/platform-plugins";
import { db } from "@/lib/db";
import { limit } from "@/lib/ratelimit";
import { ask, say, twilioParams, twiml } from "@/lib/pay/voice";

// A customer calls the support number: open a case and let the AI agent greet them.
export async function POST(req: Request) {
  await loadPlatformSettings();
  const { params, valid } = await twilioParams(req, "/api/voice/inbound");
  if (!valid) return new Response("Forbidden", { status: 403 });
  const from = params.From ?? "";
  if (!limit(`voice:${from}`, 5, 10 * 60_000)) return twiml(`${say("We've received several calls from this number. Please try again later.")}<Hangup/>`);
  const c = await db.supportCase.upsert({
    where: { callSid: params.CallSid },
    create: { channel: "VOICE", callSid: params.CallSid, phone: from, subject: `Call from ${from.replace(/\d(?=\d{4})/g, "•")}` },
    update: {},
  });
  const greeting = "Hi, thanks for calling oenodpay. I'm the virtual assistant. For your security I can't discuss account details by phone, but I can help with most questions or connect you to our team. How can I help?";
  await db.supportMessage.create({ data: { caseId: c.id, from: "AI", body: greeting } });
  return twiml(ask(greeting, c.id));
}
