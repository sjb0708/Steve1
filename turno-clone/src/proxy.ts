import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
)

const PUBLIC_ROUTES = ["/", "/login", "/register"]
const AUTH_ROUTES = ["/login", "/register"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get("bdc_auth")?.value

  const isPublic = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith("/api/auth/")
  )

  let user = null
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret)
      user = payload
    } catch {
      // invalid token
    }
  }

  // Redirect logged-in users away from auth pages
  if (user && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Redirect unauthenticated users to login for protected routes
  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
