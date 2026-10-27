import { HttpError, ok, requireUser, route } from "@/lib/http";
import { startTotpSetup } from "@/lib/security";

// Step 1: a new secret and QR code to scan with an authenticator app. Not active until confirmed.
export const POST = route(async () => {
  const ctx = await requireUser();
  if (ctx.user.totpEnabledAt) throw new HttpError(409, "Two-step sign-in is already on. Turn it off first to move it to a new phone.");
  return ok(await startTotpSetup(ctx.user));
});
