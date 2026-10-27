import { clientIp } from "./http";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import QRCode from "qrcode";
import { db } from "./db";
import { decrypt, encrypt, sha256 } from "./crypto";
import { HttpError } from "./http";
import { emailLayout, sendEmail } from "./messaging";
import { APP_URL } from "./env";

// ---------- Two-step sign-in (TOTP, RFC 6238: works with Google Authenticator, Microsoft Authenticator, 1Password...) ----------

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(buf: Buffer) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function unbase32(s: string) {
  const clean = s.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("Bad base32");
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function hotp(secret: Buffer, counter: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const code = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1_000_000).padStart(6, "0");
}
const step = (t = Date.now()) => Math.floor(t / 30_000);

/** Returns the matched time step, or null. Accepts one step either side for clock drift. */
export function checkTotp(secretB32: string, code: string, lastStep?: number | null) {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const key = unbase32(secretB32);
  const now = step();
  for (const s of [now, now - 1, now + 1]) {
    if (lastStep != null && s <= lastStep) continue; // a code can be used only once
    if (hotp(key, s) === c) return s;
  }
  return null;
}

export async function startTotpSetup(user: { id: string; email: string }) {
  const secret = base32(randomBytes(20));
  await db.user.update({ where: { id: user.id }, data: { totpSecret: encrypt(secret), totpEnabledAt: null } });
  const uri = `otpauth://totp/oenodpay:${encodeURIComponent(user.email)}?secret=${secret}&issuer=oenodpay&algorithm=SHA1&digits=6&period=30`;
  return { secret, uri, qrSvg: await QRCode.toString(uri, { type: "svg", margin: 1, color: { dark: "#0B1020", light: "#FFFFFF" } }) };
}

export function newRecoveryCodes() {
  const codes = Array.from({ length: 10 }, () => randomBytes(5).toString("hex").toUpperCase().replace(/(.{5})/, "$1-"));
  return { codes, hashes: codes.map((c) => sha256(c.replace("-", ""))) };
}

/** Check a 6-digit app code or a one-time recovery code for this user. Records use so codes can't be replayed. */
export async function verifySecondFactor(userId: string, code: string) {
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u?.totpSecret || !u.totpEnabledAt) return false;
  const s = checkTotp(decrypt(u.totpSecret)!, code, u.totpLastStep);
  if (s !== null) { await db.user.update({ where: { id: u.id }, data: { totpLastStep: s } }); return true; }
  const h = sha256(code.replace(/[\s-]/g, "").toUpperCase());
  if (u.recoveryCodes.includes(h)) {
    await db.user.update({ where: { id: u.id }, data: { recoveryCodes: u.recoveryCodes.filter((x) => x !== h) } });
    return true;
  }
  return false;
}

// ---------- Passwords ----------

const COMMON = new Set(["password", "password1", "password123", "123456789", "1234567890", "qwerty123", "qwertyuiop", "iloveyou", "welcome1", "letmein123", "admin123", "abc123456", "11111111", "12345678", "oenodpay1", "football1", "sunshine1", "princess1", "baseball1", "dragon123", "monkey123", "passw0rd", "p@ssw0rd", "changeme1"]);

/** Strong-password rules plus a private check against known leaked passwords (only 5 characters of a hash leave the server). */
export async function checkPassword(pw: string, ctx: { email?: string; name?: string; minLength?: number } = {}) {
  const min = Math.max(10, ctx.minLength ?? 10);
  if (pw.length < min) throw new HttpError(422, `Use at least ${min} characters.`);
  if (pw.length > 200) throw new HttpError(422, "That password is too long.");
  const lower = pw.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(pw)) throw new HttpError(422, "That password is too common. Try a short sentence you'll remember.");
  const local = ctx.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) throw new HttpError(422, "Don't use your email address in your password.");
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (kinds < 2 && pw.length < 16) throw new HttpError(422, "Mix letters with numbers or symbols, or use a longer passphrase.");
  try {
    const sha1 = createHash("sha1").update(pw).digest("hex").toUpperCase();
    const r = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, { headers: { "Add-Padding": "true" }, signal: AbortSignal.timeout(2500) });
    if (r.ok && (await r.text()).split("\n").some((l) => l.startsWith(sha1.slice(5)) && Number(l.split(":")[1]) > 0)) {
      throw new HttpError(422, "This password has appeared in a data breach. Please choose a different one.");
    }
  } catch (e) {
    if (e instanceof HttpError) throw e; // network problems never block sign-up
  }
}

// ---------- Lockout ----------

export const MAX_FAILED = 5;

export async function recordFailedLogin(user: { id: string; email: string; name: string; failedLogins: number }, ip: string | null) {
  const n = user.failedLogins + 1;
  const lock = n >= MAX_FAILED ? new Date(Date.now() + Math.min(24 * 60, 15 * 2 ** (n - MAX_FAILED)) * 60_000) : null;
  await db.user.update({ where: { id: user.id }, data: { failedLogins: n, ...(lock ? { lockedUntil: lock } : {}) } });
  if (n === MAX_FAILED) {
    await sendEmail({ to: user.email, scope: "PLATFORM", idempotencyKey: `lock:${user.id}:${lock!.toISOString().slice(0, 13)}`, subject: "We paused sign-ins to your oenodpay account", html: emailLayout({ title: "Your account is temporarily locked", body: `Hi ${user.name.split(" ")[0]},\n\nThere were ${n} wrong password attempts on your account${ip ? ` from IP ${ip}` : ""}, so we paused sign-ins for 15 minutes to keep it safe.\n\nIf this wasn't you, reset your password now and turn on two-step sign-in.`, ctaLabel: "Reset my password", ctaUrl: `${APP_URL}/forgot` }) }).catch(() => {});
  }
  return lock;
}

// ---------- Devices and sessions ----------

export function describeDevice(ua: string | null, client: string) {
  if (client === "mobile") return /android/i.test(ua ?? "") ? "oenodpay Android app" : "oenodpay iPhone app";
  if (client === "desktop") return /windows/i.test(ua ?? "") ? "oenodpay desktop (Windows)" : /mac/i.test(ua ?? "") ? "oenodpay desktop (macOS)" : "oenodpay desktop";
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export function clientOf(h: Headers) {
  const c = h.get("x-oenodpay-client") ?? "";
  if (c.startsWith("mobile")) return "mobile";
  if (c.startsWith("desktop") || /oenodpay-desktop/i.test(h.get("user-agent") ?? "")) return "desktop";
  return "web";
}

/** Create a session row; email the person when it's a device we haven't seen before. */
export async function openSession(user: { id: string; email: string; name: string }, req: Request, opts: { mfa: boolean; days: number }) {
  const ua = req.headers.get("user-agent");
  const ip = clientIp(req);
  const client = clientOf(req.headers);
  const device = describeDevice(ua, client);
  const seen = await db.session.findFirst({ where: { userId: user.id, device, OR: [{ ip }, { userAgent: ua }] } });
  const s = await db.session.create({ data: { userId: user.id, device, client, ip, userAgent: ua?.slice(0, 400), mfa: opts.mfa, expiresAt: new Date(Date.now() + opts.days * 864e5) } });
  const firstEver = !(await db.session.count({ where: { userId: user.id, id: { not: s.id } } }));
  if (!seen && !firstEver) {
    await sendEmail({ to: user.email, scope: "PLATFORM", idempotencyKey: `newdevice:${s.id}`, subject: "New sign-in to your oenodpay account", html: emailLayout({ title: "New sign-in", body: `Hi ${user.name.split(" ")[0]},\n\nYour account was just used to sign in on ${device}${ip ? ` (IP ${ip})` : ""} at ${new Date().toUTCString()}.\n\nIf this was you, there's nothing to do. If not, sign that device out and change your password right away.`, ctaLabel: "Review my devices", ctaUrl: `${APP_URL}/app/security` }) }).catch(() => {});
  }
  return s;
}

// ---------- Network allowlists (super admin) ----------

function ipToBig(ip: string) {
  if (isIP(ip) === 4) return { v: 4, n: ip.split(".").reduce((a, p) => (a << 8n) + BigInt(Number(p)), 0n) };
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [], t = tail ? tail.split(":") : [];
  const parts = ip.includes("::") ? [...h, ...Array(8 - h.length - t.length).fill("0"), ...t] : h;
  return { v: 6, n: parts.reduce((a, p) => (a << 16n) + BigInt(parseInt(p || "0", 16)), 0n) };
}

/** true if ip falls inside one of the CIDR ranges (or exact IPs). */
export function ipAllowed(ip: string | null, list: string[]) {
  if (!list.length) return true;
  if (!ip) return false;
  const clean = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (!isIP(clean)) return false;
  const a = ipToBig(clean);
  return list.some((entry) => {
    const [base, bitsRaw] = entry.trim().split("/");
    if (!isIP(base)) return false;
    const b = ipToBig(base);
    if (a.v !== b.v) return false;
    const total = a.v === 4 ? 32 : 128;
    const bits = bitsRaw === undefined ? total : Math.min(total, Math.max(0, Number(bitsRaw)));
    const shift = BigInt(total - bits);
    return a.n >> shift === b.n >> shift;
  });
}

export function validCidr(s: string) {
  const [base, bits] = s.trim().split("/");
  const v = isIP(base);
  return Boolean(v) && (bits === undefined || (/^\d+$/.test(bits) && Number(bits) <= (v === 4 ? 32 : 128)));
}
