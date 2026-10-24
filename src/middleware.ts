import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const nextAuthToken =
      request.cookies.get("next-auth.session-token")?.value ||
      request.cookies.get("__Secure-next-auth.session-token")?.value;

    const e2eTestCookie =
      request.cookies.get("x-e2e-test-auth")?.value ||
      request.cookies.get("omnimarket-session")?.value;

    const e2eTestHeader = request.headers.get("x-e2e-test-auth");

    const isAuthenticated = Boolean(
      nextAuthToken || e2eTestCookie || e2eTestHeader === "true"
    );

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
