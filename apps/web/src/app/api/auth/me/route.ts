import { HttpError, ok, route } from "@/lib/http";
import { loadSession } from "@/lib/session";

export const GET = route(async () => {
  const s = await loadSession();
  if (!s) throw new HttpError(401, "Please sign in.");
  return ok(s);
});
