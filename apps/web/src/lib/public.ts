/** A same-site path to return to after sign-in, or null. Blocks open redirects. */
export function safeNext(n: string | null | undefined) {
  return n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : null;
}
