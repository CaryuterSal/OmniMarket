import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    // Real OAuth session (Google / GitHub via NextAuth)
    const nextAuthToken =
      request.cookies.get("next-auth.session-token")?.value ||
      request.cookies.get("__Secure-next-auth.session-token")?.value;

    // E2E test bypass — ONLY active when E2E_SECRET is configured in the
    // environment (i.e. in CI / local dev). In production (Vercel) this
    // variable MUST be left unset so the bypass is completely disabled and
    // the dashboard is exclusively protected by real OAuth.
    const e2eSecret = process.env.E2E_SECRET;
    const e2eCookieValue =
      request.cookies.get("x-e2e-test-auth")?.value ||
      request.cookies.get("omnimarket-session")?.value;
    const e2eHeaderValue = request.headers.get("x-e2e-test-auth");

    const e2eBypassActive =
      Boolean(e2eSecret) &&
      (e2eCookieValue === e2eSecret || e2eHeaderValue === e2eSecret);

    const isAuthenticated = Boolean(nextAuthToken || e2eBypassActive);

    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
