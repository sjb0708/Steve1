import { NextResponse } from "next/server"
import { clearAuthCookieHeader } from "@/lib/auth"

export async function POST() {
  const response = NextResponse.json({ success: true })
  const cookie = clearAuthCookieHeader()
  response.cookies.set(cookie)
  return response
}

// GET handler so visiting /api/auth/logout in the browser works
export async function GET() {
  const response = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"))
  const cookie = clearAuthCookieHeader()
  response.cookies.set(cookie)
  return response
}
