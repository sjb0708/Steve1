import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone, location, bio } = await req.json()

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

    // Self-registered users are always CLEANER and require approval
    await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashed,
        role: "CLEANER",
        approved: false,
        phone: phone || null,
        location: location || null,
        bio: bio || null,
        avatarUrl: null,
      },
    })

    // Return success but do NOT set auth cookie — they need approval first
    return NextResponse.json({
      message: "Registration successful. Your account is pending approval. You will be notified once approved.",
    })
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
