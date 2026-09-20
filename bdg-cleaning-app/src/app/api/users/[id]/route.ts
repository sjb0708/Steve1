import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    // Only admins can approve/deactivate; users can update their own profile
    const isSelf = user.userId === id
    const isAdmin = user.role === "ADMIN"

    if (!isSelf && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}

    // Admins can approve/deactivate users
    if (isAdmin) {
      if (body.approved !== undefined) updateData.approved = body.approved
      if (body.role !== undefined && body.role === "ADMIN") updateData.role = "ADMIN"
    }

    // Self or admin can update profile fields
    if (isSelf || isAdmin) {
      if (body.name !== undefined) updateData.name = body.name
      if (body.username !== undefined) {
        const uname = body.username?.trim().toLowerCase() || null
        if (uname) {
          const taken = await prisma.user.findUnique({ where: { username: uname } })
          if (taken && taken.id !== id) {
            return NextResponse.json({ error: "That username is already taken" }, { status: 409 })
          }
        }
        updateData.username = uname
      }
      if (body.phone !== undefined) updateData.phone = body.phone || null
      if (body.carrier !== undefined) updateData.carrier = body.carrier || null
      if (body.location !== undefined) updateData.location = body.location || null
      if (body.bio !== undefined) updateData.bio = body.bio || null
      if (body.emailNotifications !== undefined) updateData.emailNotifications = body.emailNotifications
      if (body.smsNotifications !== undefined) updateData.smsNotifications = body.smsNotifications
      if (body.appNotifications !== undefined) updateData.appNotifications = body.appNotifications
      if (body.notificationChannel !== undefined) updateData.notificationChannel = body.notificationChannel
      if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod || null
      if (body.paymentDetails !== undefined) updateData.paymentDetails = body.paymentDetails || null
      if (body.email !== undefined) {
        const normalized = body.email?.trim() ? body.email.trim().toLowerCase() : null
        if (normalized) {
          const existing = await prisma.user.findUnique({ where: { email: normalized } })
          if (existing && existing.id !== id) {
            return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 })
          }
        }
        updateData.email = normalized
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        phone: true,
        carrier: true,
        location: true,
        bio: true,
        avatarUrl: true,
        approved: true,
        emailNotifications: true,
        smsNotifications: true,
        appNotifications: true,
        notificationChannel: true,
        paymentMethod: true,
        paymentDetails: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ user: updated })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    // Prevent deleting yourself
    if (user.userId === id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
    }

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (target.role === "ADMIN") {
      return NextResponse.json({ error: "Admins can't be deleted from here" }, { status: 400 })
    }

    // Payment rows require a cleaner and are the pay-history record — deleting
    // them would erase what this cleaner was owed/paid. Deactivate covers this.
    const paymentCount = await prisma.payment.count({ where: { cleanerId: id } })
    if (paymentCount > 0) {
      return NextResponse.json(
        { error: "This cleaner has payment history. Deactivate them instead so those records stay intact." },
        { status: 400 }
      )
    }

    // Jobs, issue reports, and supply requests all reference the user with
    // restrict FKs — clean those up first or the delete throws.
    await prisma.$transaction([
      // Open work goes back on the board for someone else
      prisma.job.updateMany({
        where: { cleanerId: id, status: { in: ["PENDING_ACCEPTANCE", "ASSIGNED", "IN_PROGRESS"] } },
        data: { cleanerId: null, status: "UNASSIGNED", actionToken: null, actionTokenExpiry: null, unassignedAt: new Date() },
      }),
      // Finished/cancelled jobs keep their status, just drop the reference
      prisma.job.updateMany({
        where: { cleanerId: id },
        data: { cleanerId: null },
      }),
      prisma.issueReport.deleteMany({ where: { reportedById: id } }),
      prisma.supplyRequest.deleteMany({ where: { requestedById: id } }),
      prisma.user.delete({ where: { id } }), // notifications cascade
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
