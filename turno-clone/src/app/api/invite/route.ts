import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 })

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (existing) return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 })

    const token = crypto.randomBytes(32).toString("hex")
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create a placeholder user that will be activated via invite link
    await prisma.user.create({
      data: {
        name: "Invited Admin",
        email: email.toLowerCase().trim(),
        password: "",
        role: "ADMIN",
        approved: true,
        inviteToken: token,
        inviteExpiry: expiry,
      },
    })

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/register?invite=${token}`

    return NextResponse.json({ inviteUrl, token })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
