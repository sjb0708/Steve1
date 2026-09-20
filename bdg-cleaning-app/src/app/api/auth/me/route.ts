import { NextResponse } from "next/server"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { getCurrentUser, clearAuthCookieHeader } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        phone: true,
        carrier: true,
        avatarUrl: true,
        bio: true,
        location: true,
        approved: true,
        emailNotifications: true,
        smsNotifications: true,
        appNotifications: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Me error:", error)
    return NextResponse.json({ user: null }, { status: 500 })
  }
}

// Self-service account deletion (App Store guideline 5.1.1(v)): any account
// must be deletable from inside the app, not by asking an admin.
export async function DELETE() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const id = payload.userId
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Never let the last admin delete themselves — the account would be unmanageable
    if (target.role === "ADMIN") {
      const otherAdmins = await prisma.user.count({ where: { role: "ADMIN", id: { not: id } } })
      if (otherAdmins === 0) {
        return NextResponse.json(
          { error: "You're the only admin. Add another admin before deleting your account." },
          { status: 400 }
        )
      }
    }

    const paymentCount = await prisma.payment.count({ where: { cleanerId: id } })

    // Open work goes back on the board either way
    const unassignOpenJobs = prisma.job.updateMany({
      where: { cleanerId: id, status: { in: ["PENDING_ACCEPTANCE", "ASSIGNED", "IN_PROGRESS"] } },
      data: { cleanerId: null, status: "UNASSIGNED", actionToken: null, actionTokenExpiry: null, unassignedAt: new Date() },
    })

    // Admins are referenced by properties/jobs via hostId (restrict FKs), so a
    // hard delete would throw — anonymize instead, same as payment history.
    if (paymentCount > 0 || target.role === "ADMIN") {
      // Payment rows are financial records we retain (disclosed in the privacy
      // policy) — so anonymize: strip every piece of personal data but keep the
      // row the payments point at.
      await prisma.$transaction([
        unassignOpenJobs,
        prisma.notification.deleteMany({ where: { userId: id } }),
        prisma.user.update({
          where: { id },
          data: {
            name: "Deleted User",
            // Free the username too, or a deleted account keeps holding it
            username: null,
            email: null,
            phone: null,
            carrier: null,
            location: null,
            bio: null,
            avatarUrl: null,
            paymentMethod: null,
            paymentDetails: null,
            password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
            approved: false,
            inviteToken: null,
            inviteExpiry: null,
          },
        }),
      ])
    } else {
      await prisma.$transaction([
        unassignOpenJobs,
        prisma.job.updateMany({ where: { cleanerId: id }, data: { cleanerId: null } }),
        prisma.issueReport.deleteMany({ where: { reportedById: id } }),
        prisma.supplyRequest.deleteMany({ where: { requestedById: id } }),
        prisma.user.delete({ where: { id } }), // notifications cascade
      ])
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set(clearAuthCookieHeader())
    return response
  } catch (error) {
    console.error("Delete account error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
