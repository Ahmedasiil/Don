import { NextResponse, type NextRequest } from "next/server";

// Passes the requested path to server layouts (for sign-in redirects back to the same page).
export function middleware(req: NextRequest) {
  const h = new Headers(req.headers);
  h.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers: h } });
}

export const config = { matcher: ["/app/:path*", "/app", "/admin/:path*", "/admin"] };
