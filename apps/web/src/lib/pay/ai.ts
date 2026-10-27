import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { HttpError } from "../http";
import { model } from "../ai";
import { BASE } from "./config";
import { activity, available } from "./ledger";

// Two assistants: "Oeno", the personal money coach, and the support agent behind chat and the phone line.
// Neither can move money. The support agent can only look up the caller's own records and hand off to a person.

export const ready = () => { if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) throw new HttpError(503, "The AI isn't switched on yet. A super admin adds the Claude key in the Plugin centre."); };
export const text = (c: Anthropic.Beta.BetaContentBlock[]) => c.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();

/** A 0-100 Financial Health Score from the last 90 days of wallet activity, with the parts that make it up. */
export async function healthScore(userId: string) {
  const since = new Date(Date.now() - 90 * 86400_000);
  const lines = await db.payLedgerLine.findMany({ where: { wallet: { userId }, journal: { createdAt: { gte: since } } }, include: { journal: { select: { kind: true, createdAt: true } } } });
  const inflow = lines.filter((l) => l.amountCents > 0).reduce((a, l) => a + l.amountCents, 0);
  const outflow = -lines.filter((l) => l.amountCents < 0).reduce((a, l) => a + l.amountCents, 0);
  const { availableCents } = await available(userId);
  const monthlySpend = outflow / 3;
  const savingsRate = inflow ? Math.max(-1, Math.min(1, (inflow - outflow) / inflow)) : 0;
  const bufferMonths = monthlySpend ? availableCents / monthlySpend : availableCents > 0 ? 6 : 0;
  const fees = await db.payTransfer.aggregate({ where: { userId, createdAt: { gte: since } }, _sum: { feeCents: true } });
  const parts = {
    savings: Math.round(Math.min(1, Math.max(0, savingsRate) / 0.2) * 100), // 20%+ saved = full marks
    buffer: Math.round(Math.min(1, bufferMonths / 3) * 100), // 3 months of spending set aside = full marks
    steadiness: lines.length >= 6 ? 80 : lines.length ? 50 : 0,
    fees: (fees._sum.feeCents ?? 0) < 2000 ? 100 : 60,
  };
  const score = Math.round(parts.savings * 0.35 + parts.buffer * 0.35 + parts.steadiness * 0.15 + parts.fees * 0.15);
  return { score, parts, inflowCents: inflow, outflowCents: outflow, availableCents, bufferMonths: Number(bufferMonths.toFixed(1)), currency: BASE };
}

const COACH = `You are Oeno, the oenodpay money coach. You help everyday people in Canada, the US and around the world get their finances healthy.
Be warm, specific and practical. Use the person's real numbers when given. Prefer short paragraphs and numbered steps.
You can explain budgeting (50/30/20), emergency funds, debt payoff (avalanche vs snowball), credit scores (Canada: Equifax/TransUnion, 300-900; US: FICO 300-850), TFSA/RRSP/FHSA in Canada and 401k/IRA in the US, sending money home cheaply, and halal options when asked.
You are not a licensed financial adviser: for investments, taxes or legal questions, give general education and suggest a licensed professional for personal advice. Never promise returns.
Never ask for passwords, PINs, full card or account numbers.`;

export async function coach(userId: string, message: string) {
  ready();
  const [h, recent, thread] = await Promise.all([healthScore(userId), activity(userId, 30), db.payCoachThread.findUnique({ where: { userId } })]);
  const history = ((thread?.messages as unknown as { role: "user" | "assistant"; content: string }[]) ?? []).slice(-20);
  const facts = `Financial Health Score ${h.score}/100 (savings ${h.parts.savings}, buffer ${h.parts.buffer}, steadiness ${h.parts.steadiness}, fees ${h.parts.fees}). Last 90 days: in ${(h.inflowCents / 100).toFixed(2)} ${h.currency}, out ${(h.outflowCents / 100).toFixed(2)}. Available now ${(h.availableCents / 100).toFixed(2)}. Buffer ${h.bufferMonths} months.
Recent activity: ${recent.slice(0, 15).map((a) => `${a.at.toISOString().slice(0, 10)} ${a.kind} ${(a.amountCents / 100).toFixed(2)} ${a.memo ?? ""}`).join("; ") || "none yet"}`;
  const client = new Anthropic();
  const res = await client.beta.messages.create({
    model: model(), max_tokens: 4000, thinking: { type: "adaptive" }, output_config: { effort: "medium" },
    system: [{ type: "text", text: COACH }, { type: "text", text: `The person's numbers (private, from their oenodpay wallet):\n${facts}` }],
    messages: [...history, { role: "user", content: message }],
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
  });
  const reply = res.stop_reason === "refusal" ? "I can't help with that one, but I'm happy to help with budgeting, saving or paying down debt." : text(res.content);
  const messages = [...history, { role: "user", content: message }, { role: "assistant", content: reply }];
  await db.payCoachThread.upsert({ where: { userId }, create: { userId, messages }, update: { messages } });
  return { reply, score: h };
}

// ── Support agent (chat and phone) ──

const SUPPORT = (channel: string, verified: boolean) => `You are the oenodpay support agent on ${channel === "VOICE" ? "a phone call. Speak in short, natural sentences, no lists, no markdown, at most three sentences per turn" : "in-app chat"}.
You help with: sending money abroad, top-ups, cards, family accounts, eSIMs, identity verification, fees and limits, and security.
Security rules you never break:
- Never ask for or repeat a password, PIN, authenticator code, full card number or full account number.
- ${verified ? "The customer is signed in, so you may use the lookup tools for their own records." : "The caller is not verified. Do not discuss any account, balance or transfer. Offer general help, or escalate."}
- You cannot move money, change limits, unfreeze accounts or change contact details. For those, use escalate_to_agent.
- If the person says they were scammed, hacked or see a transfer they didn't make: tell them to freeze their account in the app (Pay, Security, Freeze) and escalate with priority URGENT.
- Escalate when the person asks for a human, is upset, or you can't solve it in two tries.`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: "escalate_to_agent", description: "Hand this conversation to a human support agent.", input_schema: { type: "object", properties: { reason: { type: "string" }, priority: { type: "string", enum: ["LOW", "NORMAL", "HIGH", "URGENT"] }, category: { type: "string", enum: ["TRANSFER", "CARD", "KYC", "ACCOUNT", "FRAUD", "ESIM", "FAMILY", "OTHER"] } }, required: ["reason", "priority", "category"] } },
  { name: "resolve_case", description: "Mark the case solved when the person confirms they're all set.", input_schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] } },
];
const SIGNED_IN_TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: "my_recent_transfers", description: "The customer's last 10 transfers with status (no account numbers).", input_schema: { type: "object", properties: {} } },
  { name: "my_account_status", description: "Verification level, whether the account is frozen, PIN lock, and card statuses.", input_schema: { type: "object", properties: {} } },
];

/** One AI turn on a support case. Returns what to say and whether a human should take over. */
export async function supportTurn(caseId: string, said: string) {
  ready();
  const c = await db.supportCase.findUniqueOrThrow({ where: { id: caseId }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  await db.supportMessage.create({ data: { caseId, from: "CUSTOMER", body: said.slice(0, 4000) } });
  const verified = !!c.userId && c.channel !== "VOICE";
  const msgs: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of c.messages.filter((m) => !m.internal && m.from !== "SYSTEM")) {
    const role = m.from === "CUSTOMER" ? "user" : "assistant";
    if (msgs.at(-1)?.role === role) (msgs.at(-1)!.content as string) += `\n${m.body}`; else msgs.push({ role, content: m.body });
  }
  if (msgs.at(-1)?.role === "user") (msgs.at(-1)!.content as string) += `\n${said}`; else msgs.push({ role: "user", content: said });
  if (msgs[0]?.role === "assistant") msgs.unshift({ role: "user", content: "(call started)" });

  const client = new Anthropic();
  let reply = "", escalate = false, resolved = false;
  for (let step = 0; step < 4; step++) {
    const res = await client.beta.messages.create({
      model: process.env.SUPPORT_AI_MODEL || model(), max_tokens: 1500, output_config: { effort: c.channel === "VOICE" ? "low" : "medium" },
      system: SUPPORT(c.channel, verified), tools: verified ? [...TOOLS, ...SIGNED_IN_TOOLS] : TOOLS, messages: msgs,
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    });
    msgs.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    reply = text(res.content) || reply;
    if (res.stop_reason !== "tool_use" || !uses.length) break;
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of uses) {
      const i = (u.input ?? {}) as Record<string, string>;
      let out: unknown = {};
      if (u.name === "escalate_to_agent") {
        escalate = true;
        await db.supportCase.update({ where: { id: caseId }, data: { status: "WAITING_AGENT", priority: i.priority ?? "NORMAL", category: i.category ?? c.category, aiSummary: i.reason } });
        out = { ok: true, note: "A person will take over. Tell the customer briefly." };
      } else if (u.name === "resolve_case") {
        resolved = true;
        await db.supportCase.update({ where: { id: caseId }, data: { status: "RESOLVED", resolvedAt: new Date(), aiSummary: i.summary } });
        out = { ok: true };
      } else if (verified && u.name === "my_recent_transfers") {
        out = (await db.payTransfer.findMany({ where: { userId: c.userId! }, orderBy: { createdAt: "desc" }, take: 10, include: { recipient: { select: { name: true, country: true, label: true } } } }))
          .map((t) => ({ date: t.createdAt.toISOString().slice(0, 10), to: t.recipient.name, country: t.recipient.country, amount: `${(t.sendCents / 100).toFixed(2)} ${t.sendCurrency}`, status: t.status, note: t.status === "REVIEW" ? "Being checked by our compliance team (usually within one business day)" : t.failureReason }));
      } else if (verified && u.name === "my_account_status") {
        const p = await db.payProfile.findUnique({ where: { userId: c.userId! } });
        const cards = await db.payCard.findMany({ where: { userId: c.userId! }, select: { last4: true, status: true, type: true } });
        out = { verified: p?.kycStatus, level: p?.tier, frozen: !!p?.frozenAt, pinLocked: !!(p?.pinLockedUntil && p.pinLockedUntil > new Date()), cards };
      } else out = { error: "Not available" };
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out) });
    }
    msgs.push({ role: "user", content: results });
  }
  if (!reply) reply = escalate ? "I'm connecting you with one of our team now." : "Sorry, could you say that again?";
  await db.supportMessage.create({ data: { caseId, from: "AI", body: reply } });
  return { reply, escalate, resolved };
}

/** A two-line summary and the mood, for the agent picking up the case. */
export async function summarizeCase(caseId: string) {
  ready();
  const c = await db.supportCase.findUniqueOrThrow({ where: { id: caseId }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  const client = new Anthropic();
  const res = await client.beta.messages.create({
    model: model(), max_tokens: 400, output_config: { effort: "low" },
    system: "Summarize this support conversation for the agent taking over in at most two sentences, then on a new line write one word for the customer's mood: CALM, CONFUSED, FRUSTRATED or ANGRY.",
    messages: [{ role: "user", content: c.messages.map((m) => `${m.from}: ${m.body}`).join("\n").slice(0, 20000) || "(empty)" }],
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
  });
  const out = text(res.content).split("\n").filter(Boolean);
  const sentiment = (out.at(-1) ?? "").trim().toUpperCase();
  const summary = out.slice(0, -1).join(" ") || out.join(" ");
  await db.supportCase.update({ where: { id: caseId }, data: { aiSummary: summary, sentiment: ["CALM", "CONFUSED", "FRUSTRATED", "ANGRY"].includes(sentiment) ? sentiment : null } });
  return { summary, sentiment };
}

/** Draft a reply for a human agent to edit and send. */
export async function draftReply(caseId: string) {
  ready();
  const c = await db.supportCase.findUniqueOrThrow({ where: { id: caseId }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  const client = new Anthropic();
  const res = await client.beta.messages.create({
    model: model(), max_tokens: 800, output_config: { effort: "low" },
    system: "Draft the next reply from an oenodpay support agent. Warm, clear, specific, under 120 words. Never include or ask for passwords, PINs, codes or full account numbers. Reply with only the message.",
    messages: [{ role: "user", content: c.messages.map((m) => `${m.from}${m.internal ? " (internal note)" : ""}: ${m.body}`).join("\n").slice(0, 20000) }],
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
  });
  return text(res.content);
}
