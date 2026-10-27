import { db } from "./db";

const EXPO_TOKEN = /^Expo(nent)?PushToken\[[\w-]+\]$/;
export const isPushToken = (t: string) => EXPO_TOKEN.test(t);

/** Send a push notification to one person's phone through Expo. Quietly does nothing if they have no app. */
export async function sendPush(userId: string, title: string, body?: string, data?: Record<string, unknown>) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { pushToken: true, disabledAt: true } });
  if (!u?.pushToken || u.disabledAt || !isPushToken(u.pushToken)) return { sent: false };
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
      body: JSON.stringify({ to: u.pushToken, title: title.slice(0, 120), body: body?.slice(0, 240), data, sound: "default" }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await res.json().catch(() => null)) as { data?: { status?: string; details?: { error?: string } } } | null;
    // The app was removed or the token expired: stop sending to it.
    if (j?.data?.details?.error === "DeviceNotRegistered") await db.user.update({ where: { id: userId }, data: { pushToken: null } });
    return { sent: j?.data?.status === "ok" };
  } catch {
    return { sent: false };
  }
}
