import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { signToken, createAuthCookieHeader } from "@/lib/auth"

// One endpoint for both ways of setting a password without being logged in:
//   • an invite from an admin  (?invite=…)
//   • a forgotten password     (?reset=…)
// Both end the same way — password set, token burned, signed in.
export async function POST(req: NextRequest) {
  try {
    const { token, kind, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: "A link and a password are required" }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const user =
      kind === "reset"
        ? await prisma.user.findUnique({ where: { resetToken: token } })
        : await prisma.user.findUnique({ where: { inviteToken: token } })

    if (!user) {
      return NextResponse.json({ error: "This link is not valid. Ask for a new one." }, { status: 400 })
    }

    const expiry = kind === "reset" ? user.resetExpiry : user.inviteExpiry
    if (expiry && expiry < new Date()) {
      return NextResponse.json({ error: "This link has expired. Ask for a new one." }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 12)
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        // Burn BOTH tokens — a password change should invalidate every
        // outstanding way into the account, not just the one used.
        resetToken: null,
        resetExpiry: null,
        inviteToken: null,
        inviteExpiry: null,
        // An invited cleaner who has now set a password is a real user.
        ...(kind !== "reset" ? { approved: true } : {}),
      },
    })

    const jwt = await signToken({
      userId: updated.id,
      email: updated.email ?? "",
      role: updated.role as "ADMIN" | "CLEANER",
      name: updated.name,
    })

    const response = NextResponse.json({
      user: { id: updated.id, name: updated.name, username: updated.username, role: updated.role },
    })
    response.cookies.set(createAuthCookieHeader(jwt))
    return response
  } catch (error) {
    console.error("[auth/set-password]", error)
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 })
  }
}
