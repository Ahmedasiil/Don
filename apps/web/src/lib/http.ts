import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";
import { getCtx, type Ctx } from "./auth";
import { loadPlatformSettings } from "./platform-plugins";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const ok = (data: unknown, init?: number | ResponseInit) =>
  NextResponse.json(data, typeof init === "number" ? { status: init } : init);

export function fail(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: "Please check the highlighted fields.", details: e.flatten() }, { status: 422 });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function requireUser() {
  const ctx = await getCtx();
  if (!ctx.user) throw new HttpError(401, "Please sign in.");
  return ctx as Ctx & { user: NonNullable<Ctx["user"]> };
}

export async function requireSuperAdmin() {
  const ctx = await getCtx();
  if (!ctx.user?.isSuperAdmin) throw new HttpError(403, "Super admin only.");
  // The keys to the whole platform: two-step sign-in is mandatory in production.
  if (process.env.NODE_ENV === "production" && !ctx.user.totpEnabledAt && process.env.SUPER_ADMIN_ALLOW_NO_2FA !== "true") {
    throw new HttpError(403, "Turn on two-step sign-in in Security to use the super admin.", { code: "MFA_REQUIRED" });
  }
  return ctx as Ctx & { user: NonNullable<Ctx["user"]> };
}

export async function body<S extends ZodTypeAny>(req: Request, schema: S): Promise<output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Expected a JSON body.");
  }
  return schema.parse(raw);
}

export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      await loadPlatformSettings();
      if (args[0] instanceof Request) {
        crossSiteCheck(args[0]);
      }
      return await fn(...args);
    } catch (e) {
      return fail(e);
    }
  };
}

/**
 * Block cross-site form/fetch posts that ride on the browser's session cookie (CSRF).
 * Apps and API clients use an Authorization header and are not affected.
 */
function crossSiteCheck(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  if (req.headers.get("authorization")) return;
  if (!/(?:^|;\s*)oenodpay_session=/.test(req.headers.get("cookie") ?? "")) return;
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site") throw new HttpError(403, "Request blocked for your security. Please use the oenodpay app or website.");
  if (origin && origin !== "null") {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    try { if (new URL(origin).host !== host) throw new HttpError(403, "Request blocked for your security. Please use the oenodpay app or website."); }
    catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(403, "Request blocked for your security."); }
  }
}

/**
 * The caller's IP, for rate limits and audit logs. The left side of X-Forwarded-For can be typed by anyone,
 * so we count back from the right by the number of proxies we run behind (TRUSTED_PROXY_HOPS, default 1).
 * Behind Cloudflare or an Nginx that sets X-Real-IP, set CLIENT_IP_HEADER to that header instead.
 */
export function clientIp(req: Request) {
  const named = process.env.CLIENT_IP_HEADER ? req.headers.get(process.env.CLIENT_IP_HEADER) : null;
  if (named) return named.trim();
  const chain = req.headers.get("x-forwarded-for")?.split(",").map((x) => x.trim()).filter(Boolean) ?? [];
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
  return chain[Math.max(0, chain.length - hops)] ?? null;
}
