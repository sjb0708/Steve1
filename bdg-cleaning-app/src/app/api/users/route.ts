import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Admin adds a cleaner directly — no self-registration or login needed.
// The cleaner works entirely from email (one-click accept/decline links);
// a random unguessable password is set so the account can't be logged into
// until an admin/reset flow ever changes it.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { name, email, phone } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Email is optional — a profile can exist just to put someone on the
    // schedule. Without one they can't log in or receive emailed job offers.
    const normalizedEmail = email?.trim() ? email.trim().toLowerCase() : null
    if (normalizedEmail) {
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
      if (existing) {
        return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 })
      }
    }

    const randomPassword = crypto.randomBytes(32).toString("hex")
    const created = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        password: await bcrypt.hash(randomPassword, 12),
        role: "CLEANER",
        approved: true,
      },
      select: {
        id: true, name: true, email: true, role: true, phone: true, carrier: true,
        location: true, bio: true, avatarUrl: true, approved: true, createdAt: true,
      },
    })

    return NextResponse.json({ user: created }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const roleFilter = searchParams.get("role")
    const approvedFilter = searchParams.get("approved")

    const where: Record<string, unknown> = {}
    if (roleFilter) where.role = roleFilter
    if (approvedFilter !== null) where.approved = approvedFilter === "true"

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        carrier: true,
        location: true,
        bio: true,
        avatarUrl: true,
        approved: true,
        emailNotifications: true,
        appNotifications: true,
        notificationChannel: true,
        paymentMethod: true,
        paymentDetails: true,
        createdAt: true,
      },
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
