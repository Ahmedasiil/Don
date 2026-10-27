import { loadPlatformSettings } from "@/lib/platform-plugins";
import { db } from "@/lib/db";
import { supportTurn, summarizeCase } from "@/lib/pay/ai";
import { ask, dial, say, twilioParams, twiml } from "@/lib/pay/voice";

// Each thing the caller says comes here as text. The AI answers, or hands the call to a person.
export async function POST(req: Request) {
  await loadPlatformSettings();
  const { params, valid } = await twilioParams(req, "/api/voice/turn");
  if (!valid) return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const caseId = url.searchParams.get("case") ?? "";
  const c = await db.supportCase.findUnique({ where: { id: caseId } });
  if (!c || c.callSid !== params.CallSid) return twiml(`${say("Sorry, something went wrong. Please call again.")}<Hangup/>`);
  const speech = (params.SpeechResult ?? "").trim();
  if (!speech) {
    const silent = await db.supportMessage.count({ where: { caseId, from: "SYSTEM", body: "silence" } });
    await db.supportMessage.create({ data: { caseId, from: "SYSTEM", body: "silence", internal: true } });
    return silent >= 2 ? twiml(dial("Let me connect you with our team.")) : twiml(ask("Are you still there? How can I help?", caseId));
  }
  try {
    const r = await supportTurn(caseId, speech);
    if (r.escalate) {
      summarizeCase(caseId).catch(() => {});
      return twiml(dial(r.reply));
    }
    if (r.resolved) return twiml(`${say(r.reply)}${say("Thanks for calling oenodpay. Goodbye.")}<Hangup/>`);
    const turns = await db.supportMessage.count({ where: { caseId, from: "AI" } });
    if (turns > 12) { await db.supportCase.update({ where: { id: caseId }, data: { status: "WAITING_AGENT" } }); return twiml(dial("Let me bring in one of our team to finish this with you.")); }
    return twiml(ask(r.reply, caseId));
  } catch (e) {
    console.error("voice turn failed", e);
    await db.supportCase.update({ where: { id: caseId }, data: { status: "WAITING_AGENT" } });
    return twiml(dial("Let me connect you with our team."));
  }
}
