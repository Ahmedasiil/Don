import { z } from "zod";
import { db } from "@/lib/db";
import { body, ok, requireUser, route } from "@/lib/http";

// The phone app registers its push address here after the person allows notifications.
export const PUT = route(async (req: Request) => {
  const ctx = await requireUser();
  const d = await body(req, z.object({ token: z.string().regex(/^Expo(nent)?PushToken\[[\w-]+\]$/) }));
  await db.user.update({ where: { id: ctx.user.id }, data: { pushToken: d.token } });
  return ok({ ok: true });
});

export const DELETE = route(async () => {
  const ctx = await requireUser();
  await db.user.update({ where: { id: ctx.user.id }, data: { pushToken: null } });
  return ok({ ok: true });
});
