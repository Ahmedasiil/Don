import { db } from "../db";
import { BLOCKED_COUNTRIES, REPORT_OVER_CENTS, REVIEW_COUNTRIES, REVIEW_OVER_CENTS } from "./config";
import { screenPerson } from "./providers/sanctions";

// Anti-money-laundering rules run on every transfer before money leaves.
// BLOCK stops it. REVIEW holds the money until a compliance officer approves it in Super admin, Compliance.

export type Verdict = { action: "ALLOW" | "REVIEW" | "BLOCK"; flags: string[]; reasons: string[] };

export async function assessTransfer(o: { userId: string; sendCents: number; country: string; recipient: { id: string; name: string; createdAt: Date; sanctionsHit: boolean } }): Promise<Verdict> {
  const flags: string[] = [];
  const reasons: string[] = [];
  let action: Verdict["action"] = "ALLOW";
  const raise = (a: Verdict["action"], flag: string, reason: string) => {
    flags.push(flag); reasons.push(reason);
    if (a === "BLOCK" || (a === "REVIEW" && action === "ALLOW")) action = a;
  };

  const profile = await db.payProfile.findUnique({ where: { userId: o.userId } });
  if (profile?.sanctionsHit) raise("BLOCK", "SENDER_SANCTIONS", "Sender matches a sanctions list");
  if (profile?.pepHit || profile?.riskLevel === "HIGH") raise("REVIEW", "HIGH_RISK_SENDER", "Sender is a politically exposed or high-risk person");
  if (BLOCKED_COUNTRIES.has(o.country)) raise("BLOCK", "BLOCKED_COUNTRY", "Destination is under FATF call for action");
  if (REVIEW_COUNTRIES.has(o.country)) raise("REVIEW", "HIGH_RISK_COUNTRY", "Destination is under increased monitoring");

  // Screen the recipient fresh on every transfer: lists change daily.
  const s = await screenPerson({ name: o.recipient.name, country: o.country }).catch(() => null);
  if (!s?.ran) raise("REVIEW", "SCREENING_NOT_RUN", "Sanctions screening is not connected or failed");
  else if (s.sanction) raise("BLOCK", "RECIPIENT_SANCTIONS", `Recipient matches ${s.matches[0]?.name ?? "a sanctions list"}`);
  else if (s.pep) raise("REVIEW", "RECIPIENT_PEP", "Recipient is a politically exposed person");
  if (s?.ran) await db.payRecipient.update({ where: { id: o.recipient.id }, data: { sanctionsHit: s.sanction, screenedAt: new Date() } });

  if (o.sendCents >= REVIEW_OVER_CENTS) raise("REVIEW", "LARGE_TRANSFER", "Large transfer");

  const hour = new Date(Date.now() - 3600_000), day = new Date(Date.now() - 86400_000), week = new Date(Date.now() - 7 * 86400_000);
  const live = { notIn: ["FAILED", "CANCELLED", "REFUNDED"] };
  const [lastHour, lastDay, newRecipients] = await Promise.all([
    db.payTransfer.count({ where: { userId: o.userId, createdAt: { gte: hour }, status: live } }),
    db.payTransfer.findMany({ where: { userId: o.userId, createdAt: { gte: day }, status: live }, select: { sendCents: true } }),
    db.payRecipient.count({ where: { userId: o.userId, createdAt: { gte: day } } }),
  ]);
  if (lastHour >= 5) raise("REVIEW", "VELOCITY", "More than 5 transfers in an hour");
  const dayTotal = lastDay.reduce((a, t) => a + t.sendCents, 0) + o.sendCents;
  // Structuring: several transfers just under the reporting line that add up past it within 24 hours.
  if (lastDay.length >= 2 && dayTotal >= REPORT_OVER_CENTS && o.sendCents < REPORT_OVER_CENTS) raise("REVIEW", "STRUCTURING", "Several transfers in 24 hours add up past the reporting threshold");
  if (dayTotal >= REPORT_OVER_CENTS) flags.push("REPORTABLE"); // FINTRAC EFT report (Canada) / CTR-style report elsewhere
  if (newRecipients >= 4) raise("REVIEW", "NEW_RECIPIENT_BURST", "Many new recipients in 24 hours");
  if (o.recipient.createdAt > new Date(Date.now() - 600_000) && o.sendCents >= REVIEW_OVER_CENTS / 3) raise("REVIEW", "NEW_RECIPIENT_LARGE", "Large first payment to a brand-new recipient");
  const first = await db.payTransfer.count({ where: { userId: o.userId, createdAt: { lt: week } } });
  if (!first && o.sendCents >= REVIEW_OVER_CENTS / 2) raise("REVIEW", "NEW_ACCOUNT_LARGE", "Large transfer from an account under a week old");

  return { action, flags, reasons };
}

export async function riskEvent(userId: string, kind: string, severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", entity: string | null, entityId: string | null, details: unknown) {
  return db.payRiskEvent.create({ data: { userId, kind, severity, entity, entityId, details: JSON.parse(JSON.stringify(details ?? {})) } });
}

/** Screen the account holder after identity is verified, and again by cron every week. */
export async function screenProfile(userId: string) {
  const p = await db.payProfile.findUnique({ where: { userId } });
  if (!p?.legalName) return null;
  const s = await screenPerson({ name: p.legalName, birthDate: p.dob?.toISOString().slice(0, 10), country: p.country });
  if (!s.ran) return s;
  const freeze = s.sanction && !p.sanctionsHit;
  await db.payProfile.update({ where: { userId }, data: { sanctionsHit: s.sanction, pepHit: s.pep, screenedAt: new Date(), riskLevel: s.sanction || s.pep ? "HIGH" : p.riskLevel, ...(freeze ? { frozenAt: new Date(), frozenReason: "Sanctions match, under compliance review" } : {}) } });
  if (s.sanction) await riskEvent(userId, "SANCTIONS_MATCH", "CRITICAL", "PayProfile", p.id, s);
  else if (s.pep && !p.pepHit) await riskEvent(userId, "PEP_MATCH", "HIGH", "PayProfile", p.id, s);
  return s;
}
