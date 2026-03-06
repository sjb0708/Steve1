import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signToken, createAuthCookieHeader } from "@/lib/auth"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role as "HOST" | "CLEANER",
      name: user.name,
    })

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        location: user.location,
        rating: user.rating,
        reviewCount: user.reviewCount,
      },
    })

    const cookie = createAuthCookieHeader(token)
    response.cookies.set(cookie)

    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
