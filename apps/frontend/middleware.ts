import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  const isAuthPage = request.nextUrl.pathname.startsWith("/auth");
  const isApiAuthRoute = request.nextUrl.pathname.startsWith("/api/auth");

  if (isAuthPage || isApiAuthRoute) {
    if (token) {
      const userData = verifyToken(token);
      if (userData) {
        if (userData.isGovtOfficial) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        } else {
          return NextResponse.redirect(new URL("/safe-route", request.url));
        }
      }
    }
    return NextResponse.next();
  }
  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const userData = verifyToken(token);
  if (!userData) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  if (
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/video-analyser") ||
    request.nextUrl.pathname.startsWith("/investigation")
  ) {
    if (!userData.isGovtOfficial) {
      return NextResponse.redirect(new URL("/safe-route", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/video-analyser/:path*",
    "/investigation/:path*",
    "/lawbot/:path*",
    "/therapybot/:path*",
    "/safe-route/:path*",
    "/auth/:path*",
  ],
};
