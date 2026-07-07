import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signToken, createAuthCookieHeader } from "@/lib/auth"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const { token, name, password } = await req.json()

    if (!token || !name || !password) {
      return NextResponse.json({ error: "Token, name and password are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { inviteToken: token } })

    if (!user) return NextResponse.json({ error: "Invalid or expired invite link" }, { status: 400 })
    if (user.inviteExpiry && user.inviteExpiry < new Date()) {
      return NextResponse.json({ error: "This invite link has expired" }, { status: 400 })
    }
    if (user.password !== "") {
      return NextResponse.json({ error: "This invite has already been used" }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 12)

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name.trim(),
        password: hashed,
        inviteToken: null,
        inviteExpiry: null,
      },
    })

    const jwtToken = await signToken({
      userId: updated.id,
      email: updated.email,
      role: updated.role as "ADMIN" | "CLEANER",
      name: updated.name,
    })

    const response = NextResponse.json({
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role },
    })

    response.cookies.set(createAuthCookieHeader(jwtToken))
    return response
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
