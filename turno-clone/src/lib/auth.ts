import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import type { JwtPayload } from "@/types"

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
)

const COOKIE_NAME = "bdc_auth"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export async function signToken(payload: JwtPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret)
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value
}

export async function getCurrentUser(): Promise<JwtPayload | null> {
  const token = await getAuthCookie()
  if (!token) return null
  return verifyToken(token)
}

export function createAuthCookieHeader(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  }
}

export function clearAuthCookieHeader() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/",
  }
}
