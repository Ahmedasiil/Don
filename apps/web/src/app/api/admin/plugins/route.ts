import { z } from "zod";
import { body, HttpError, ok, requireSuperAdmin, route } from "@/lib/http";
import { PLATFORM_PLUGINS, pluginStatus, saveSetting, testPlugin } from "@/lib/platform-plugins";
import { adminAudit } from "@/lib/admin";

// Platform plugin centre: payments, email, SMS, AI, maps... Keys are encrypted and never sent back.
export const GET = route(async () => {
  await requireSuperAdmin();
  return ok({ data: await pluginStatus() });
});

// Save a plugin's settings. An empty value removes the saved setting (hosting env values still apply).
export const PUT = route(async (req: Request) => {
  const ctx = await requireSuperAdmin();
  const d = await body(req, z.object({ plugin: z.string(), values: z.record(z.string(), z.string().max(8000).nullable()) }));
  const p = PLATFORM_PLUGINS.find((x) => x.key === d.plugin);
  if (!p) throw new HttpError(404, "Unknown plugin.");
  const allowed = new Set(p.fields.map((f) => f.key));
  for (const [k, v] of Object.entries(d.values)) {
    if (!allowed.has(k)) throw new HttpError(422, `${k} isn't a setting of ${p.name}.`);
    if (v !== null && v.startsWith("••••")) continue; // unchanged masked value
    await saveSetting(k, v, p.key, ctx.user.name);
  }
  await adminAudit(ctx.user.id, "plugin.saved", "platform_plugin", p.key, { keys: Object.keys(d.values) });
  return ok({ plugin: (await pluginStatus()).find((x) => x.key === p.key), test: p.test ? await testPlugin(p.key) : null });
});

export const POST = route(async (req: Request) => {
  await requireSuperAdmin();
  const d = await body(req, z.object({ plugin: z.string() }));
  return ok(await testPlugin(d.plugin));
});
