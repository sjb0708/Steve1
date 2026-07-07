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
      if (body.phone !== undefined) updateData.phone = body.phone || null
      if (body.location !== undefined) updateData.location = body.location || null
      if (body.bio !== undefined) updateData.bio = body.bio || null
      if (body.emailNotifications !== undefined) updateData.emailNotifications = body.emailNotifications
      if (body.appNotifications !== undefined) updateData.appNotifications = body.appNotifications
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        location: true,
        bio: true,
        avatarUrl: true,
        approved: true,
        emailNotifications: true,
        appNotifications: true,
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

    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
