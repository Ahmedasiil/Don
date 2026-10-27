import { db } from "../db";
import { sendPush } from "../push";

export type NoticeKind = "MONEY_IN" | "MONEY_OUT" | "REQUEST" | "SECURITY" | "CARD" | "BILL" | "INVEST" | "LOAN" | "REWARD" | "TRAVEL" | "SYSTEM";

/** Add to the person's notification centre and send a push. Never put full account numbers in a notice. */
export async function notify(userId: string, kind: NoticeKind, title: string, body?: string, link = "/app") {
  await db.payNotice.create({ data: { userId, kind, title, body, link } });
  await sendPush(userId, title, body, { link }).catch(() => {});
}
