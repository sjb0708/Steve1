import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        property: true,
        host: { select: { id: true, name: true, email: true, avatarUrl: true, rating: true, phone: true } },
        cleaner: { select: { id: true, name: true, email: true, avatarUrl: true, rating: true, phone: true } },
        checklistItems: true,
        review: true,
      },
    })

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    const canAccess = job.hostId === user.userId || job.cleanerId === user.userId
    if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    return NextResponse.json({ job })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const existing = await prisma.job.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    const canAccess = existing.hostId === user.userId || existing.cleanerId === user.userId
    if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { status, cleanerId, notes } = body
    const updateData: Record<string, unknown> = {}

    if (status) updateData.status = status
    if (cleanerId !== undefined) updateData.cleanerId = cleanerId
    if (notes !== undefined) updateData.notes = notes
    if (status === "COMPLETED") updateData.completedAt = new Date()

    const job = await prisma.job.update({ where: { id }, data: updateData })
    return NextResponse.json({ job })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
