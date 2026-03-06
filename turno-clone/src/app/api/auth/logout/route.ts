import { NextResponse } from "next/server"
import { clearAuthCookieHeader } from "@/lib/auth"

export async function POST() {
  const response = NextResponse.json({ success: true })
  const cookie = clearAuthCookieHeader()
  response.cookies.set(cookie)
  return response
}
