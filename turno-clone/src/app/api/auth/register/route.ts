import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signToken, createAuthCookieHeader } from "@/lib/auth"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role, phone, location, bio, hourlyRate } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashed,
        role: role === "CLEANER" ? "CLEANER" : "HOST",
        phone: phone || null,
        location: location || null,
        bio: bio || null,
        hourlyRate: hourlyRate || null,
        avatarUrl: null,
      },
    })

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
      },
    })

    const cookie = createAuthCookieHeader(token)
    response.cookies.set(cookie)

    return response
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
