import twilio from "twilio";
import { APP_URL } from "../env";

// Twilio Voice helpers for the AI call center. Every request is checked against Twilio's signature.

export async function twilioParams(req: Request, path: string) {
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  const sig = req.headers.get("x-twilio-signature") ?? "";
  const url = `${APP_URL}${path}${new URL(req.url).search}`;
  const valid = !!process.env.TWILIO_AUTH_TOKEN && twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, sig, url, params);
  return { params, valid };
}

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
const VOICE = () => process.env.SUPPORT_VOICE || "Polly.Joanna-Neural";

export const twiml = (inner: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, { headers: { "Content-Type": "text/xml" } });
export const say = (text: string, lang = "en-US") => `<Say voice="${VOICE()}" language="${lang}">${esc(text)}</Say>`;
/** Speak, then listen for the caller's answer and post it to /api/voice/turn. */
export const ask = (text: string, caseId: string, lang = "en-US") =>
  `<Gather input="speech" action="${esc(`${APP_URL}/api/voice/turn?case=${caseId}`)}" method="POST" speechTimeout="auto" language="${lang}" enhanced="true">${say(text, lang)}</Gather>${say("Sorry, I didn't catch that.", lang)}<Redirect method="POST">${esc(`${APP_URL}/api/voice/turn?case=${caseId}&silent=1`)}</Redirect>`;
export const dial = (text: string, lang = "en-US") =>
  process.env.SUPPORT_AGENT_PHONE
    ? `${say(text, lang)}<Dial timeout="40">${esc(process.env.SUPPORT_AGENT_PHONE)}</Dial>${say("Our team is busy right now. We've saved your request and will call you back soon. Goodbye.", lang)}`
    : `${say("Our team will call you back shortly. Thank you for calling oenodpay. Goodbye.", lang)}<Hangup/>`;
