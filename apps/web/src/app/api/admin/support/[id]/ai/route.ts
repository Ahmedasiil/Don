import { z } from "zod";
import { body, ok, requireSuperAdmin, route } from "@/lib/http";
import { draftReply, summarizeCase } from "@/lib/pay/ai";

// AI help for agents: a summary with the customer's mood, or a draft reply to edit.
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireSuperAdmin();
  const { id } = await params;
  const d = await body(req, z.object({ kind: z.enum(["summary", "draft"]) }));
  return ok(d.kind === "summary" ? await summarizeCase(id) : { draft: await draftReply(id) });
});
