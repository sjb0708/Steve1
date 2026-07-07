import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

function getJwtSecret(): Uint8Array {
  const value = process.env.JWT_SECRET
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is required in production")
    }
    return new TextEncoder().encode("dev-only-fallback-do-not-use-in-production")
  }
  return new TextEncoder().encode(value)
}

const secret = getJwtSecret()

const PUBLIC_ROUTES = ["/login", "/logout", "/register"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get("bdc_auth")?.value

  // Always allow public routes and API auth endpoints
  const isPublic =
    PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r)) ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/invite/") ||
    pathname.startsWith("/api/reminders") ||
    pathname.startsWith("/api/bookings/sync") ||
    pathname.startsWith("/respond/") ||
    pathname.startsWith("/api/respond/")

  let user = null
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret)
      user = payload
    } catch {
      // invalid token — treat as logged out
    }
  }

  // Redirect logged-in users away from login/register
  if (user && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Redirect unauthenticated users to login for protected routes
  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    // Clear stale cookie if present
    const response = NextResponse.redirect(loginUrl)
    if (token) response.cookies.delete("bdc_auth")
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
