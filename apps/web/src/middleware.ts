import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = ["/overview", "/settings"];

export function middleware(request: NextRequest) {
  const isProtected = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get("poip_session");
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/overview/:path*", "/settings/:path*"]
};
