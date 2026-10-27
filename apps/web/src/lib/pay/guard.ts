import bcrypt from "bcryptjs";
import type { PayProfile, User } from "@prisma/client";
import { db } from "../db";
import { HttpError, clientIp, requireUser } from "../http";
import { limit } from "../ratelimit";
import { verifySecondFactor } from "../security";
import { sendPush } from "../push";
import { emailLayout, sendEmail } from "../messaging";
import { APP_URL } from "../env";
import { audit } from "../audit";
import { HOME_COUNTRIES, LIMITS } from "./config";

// Every money action passes through here. The layers, in order:
//  1. signed in, with a session that is not revoked (lib/auth)
//  2. rate limits per person and per network address
//  3. account not frozen by compliance
//  4. two-step sign-in turned on (money can't move from a password alone)
//  5. identity verified to the tier the amount needs, living in a launch country
//  6. a 6-digit transaction PIN, locked for 30 minutes after 5 wrong tries
//  7. a fresh authenticator code for large amounts, new recipients and security changes
//  8. new devices: a 24-hour cooling period with a lower limit, and an alert to the owner

export const STEP_UP_OVER_CENTS = Number(process.env.PAY_STEP_UP_OVER_CENTS ?? 100_000);
export const NEW_DEVICE_CAP_CENTS = Number(process.env.PAY_NEW_DEVICE_CAP_CENTS ?? 25_000);
const PIN_MAX_TRIES = 5;
const PIN_LOCK_MS = 30 * 60_000;

export type PayCtx = Awaited<ReturnType<typeof requireUser>> & { profile: PayProfile; ip: string | null };

export async function profileFor(userId: string) {
  return db.payProfile.upsert({ where: { userId }, create: { userId }, update: {} });
}

/** Signed-in person with their Pay profile. `money: true` adds every check needed to move money. */
export async function requirePay(req: Request, opts: { money?: boolean; action?: string } = {}): Promise<PayCtx> {
  const ctx = await requireUser();
  const ip = clientIp(req);
  const action = opts.action ?? "pay";
  if (!limit(`pay:${action}:u:${ctx.user.id}`, opts.money ? 10 : 120) || (ip && !limit(`pay:${action}:ip:${ip}`, opts.money ? 30 : 600))) {
    throw new HttpError(429, "Too many requests. Please wait a minute and try again.");
  }
  const profile = await profileFor(ctx.user.id);
  if (profile.frozenAt) throw new HttpError(423, "Your oenodpay account is on hold while our team reviews it. Contact support for help.", { code: "FROZEN" });
  if (opts.money) {
    if (process.env.PAY_REQUIRE_2FA !== "false" && !ctx.user.totpEnabledAt) {
      throw new HttpError(403, "Turn on two-step sign-in in Security before moving money. It keeps your money safe even if your password leaks.", { code: "MFA_REQUIRED" });
    }
    if (profile.tier < 1 || profile.kycStatus !== "VERIFIED") throw new HttpError(403, "Verify your identity first. It takes about two minutes with your ID and a selfie.", { code: "KYC_REQUIRED" });
    if (profile.country && HOME_COUNTRIES.size && !HOME_COUNTRIES.has(profile.country)) {
      throw new HttpError(403, "oenodpay accounts aren't open in your country yet. We'll email you when they are.", { code: "COUNTRY_NOT_OPEN" });
    }
  }
  return { ...ctx, profile, ip };
}

// ── Transaction PIN ──

export async function setPin(ctx: PayCtx, pin: string, code: string) {
  if (!/^\d{6}$/.test(pin) || /^(\d)\1{5}$/.test(pin) || "0123456789012".includes(pin) || "9876543210987".includes(pin)) {
    throw new HttpError(422, "Choose 6 digits that aren't all the same or in a row.");
  }
  // Changing the PIN needs a fresh authenticator code, so a stolen session alone can't take over.
  if (ctx.user.totpEnabledAt && !(await verifySecondFactor(ctx.user.id, code))) throw new HttpError(401, "That authenticator code didn't match.");
  await db.payProfile.update({ where: { id: ctx.profile.id }, data: { pinHash: await bcrypt.hash(pin, 12), pinFailed: 0, pinLockedUntil: null } });
  await alert(ctx.user, "Your oenodpay PIN was changed", "If this wasn't you, freeze your account in the app right away and contact support.");
  await audit(ctx, "pay.pin_set", "PayProfile", ctx.profile.id);
}

export async function checkPin(ctx: PayCtx, pin: string | undefined) {
  const p = await db.payProfile.findUniqueOrThrow({ where: { id: ctx.profile.id } });
  if (!p.pinHash) throw new HttpError(403, "Set your 6-digit oenodpay PIN first.", { code: "PIN_NOT_SET" });
  if (p.pinLockedUntil && p.pinLockedUntil > new Date()) throw new HttpError(423, "Too many wrong PINs. Try again in 30 minutes, or reset it with your authenticator code.", { code: "PIN_LOCKED" });
  if (pin && /^\d{6}$/.test(pin) && (await bcrypt.compare(pin, p.pinHash))) {
    if (p.pinFailed) await db.payProfile.update({ where: { id: p.id }, data: { pinFailed: 0 } });
    return;
  }
  const failed = p.pinFailed + 1;
  const lock = failed >= PIN_MAX_TRIES;
  await db.payProfile.update({ where: { id: p.id }, data: { pinFailed: lock ? 0 : failed, pinLockedUntil: lock ? new Date(Date.now() + PIN_LOCK_MS) : null } });
  await audit(ctx, "pay.pin_failed", "PayProfile", p.id, { ip: ctx.ip, failed });
  if (lock) {
    await alert(ctx.user, "Your oenodpay PIN is locked", `Someone entered a wrong PIN ${PIN_MAX_TRIES} times. Money can't move for 30 minutes. If this wasn't you, change your password now.`);
    throw new HttpError(423, "Too many wrong PINs. Money is locked for 30 minutes.", { code: "PIN_LOCKED" });
  }
  throw new HttpError(401, `Wrong PIN. ${PIN_MAX_TRIES - failed} tries left.`, { code: "PIN_WRONG" });
}

/** A fresh authenticator code (or recovery code). Required above STEP_UP_OVER_CENTS, for new recipients, and for security changes. */
export async function stepUp(ctx: PayCtx, code: string | undefined, why: string) {
  if (!ctx.user.totpEnabledAt) return; // requirePay({money}) already insists on 2FA where money moves
  if (!code) throw new HttpError(401, `Enter the code from your authenticator app to ${why}.`, { code: "STEP_UP_REQUIRED" });
  if (!(await verifySecondFactor(ctx.user.id, code))) {
    await audit(ctx, "pay.step_up_failed", "User", ctx.user.id, { ip: ctx.ip, why });
    throw new HttpError(401, "That authenticator code didn't match.", { code: "STEP_UP_WRONG" });
  }
}

/** True when this sign-in is under 24 hours old on a device the person hasn't used before. */
export async function onNewDevice(ctx: PayCtx) {
  if (!ctx.sessionId) return false;
  const s = await db.session.findUnique({ where: { id: ctx.sessionId } });
  if (!s || Date.now() - s.createdAt.getTime() > 24 * 3600_000) return false;
  const seen = await db.session.count({ where: { userId: ctx.user.id, id: { not: s.id }, device: s.device, createdAt: { lt: s.createdAt } } });
  return seen === 0;
}

/** Limits for this person right now, including the new-device cap. */
export async function limitsFor(ctx: PayCtx) {
  const base = LIMITS[ctx.profile.tier] ?? LIMITS[0];
  return (await onNewDevice(ctx)) ? { ...base, perTransfer: Math.min(base.perTransfer, NEW_DEVICE_CAP_CENTS), newDevice: true } : { ...base, newDevice: false };
}

/** Push and email for anything security-related. Never includes amounts' full details or account numbers. */
export async function alert(user: Pick<User, "id" | "email" | "name">, title: string, body: string) {
  await sendPush(user.id, title, body, { link: "/app" }).catch(() => {});
  await sendEmail({ to: user.email, scope: "PLATFORM", subject: title, html: emailLayout({ title, body: `<p>Hi ${escapeHtml(user.name.split(" ")[0])},</p><p>${escapeHtml(body)}</p>`, ctaLabel: "Open oenodpay", ctaUrl: `${APP_URL}/app` }) }).catch(() => {});
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The owner can freeze their own account instantly (lost phone, suspicious activity). Unfreezing needs support. */
export async function selfFreeze(ctx: PayCtx) {
  await db.payProfile.update({ where: { id: ctx.profile.id }, data: { frozenAt: new Date(), frozenReason: "Frozen by the owner" } });
  const cards = await db.payCard.findMany({ where: { userId: ctx.user.id, status: "ACTIVE" } });
  if (cards.length) {
    const { setCardStatus } = await import("./providers/stripe");
    for (const c of cards) await setCardStatus(c.stripeCardId, "inactive").catch(() => {});
    await db.payCard.updateMany({ where: { userId: ctx.user.id, status: "ACTIVE" }, data: { status: "FROZEN" } });
  }
  await audit(ctx, "pay.self_freeze", "PayProfile", ctx.profile.id, { ip: ctx.ip });
  await alert(ctx.user, "Your oenodpay account is frozen", "No money can leave and your cards are paused. Contact support to unfreeze it.");
}
