import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

function key() {
  const raw = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET || "dev-only-insecure-key";
  return createHash("sha256").update(raw).digest();
}

// AES-256-GCM for integration tokens at rest.
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1") return null;
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const token = (bytes = 24) => randomBytes(bytes).toString("base64url");

export function hmac(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
