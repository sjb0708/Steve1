import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { assignCleanerToJob, buildChecklistItems } from "@/lib/jobs"

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "50")
    const upcoming = searchParams.get("upcoming") === "1"
    const archived = searchParams.get("archived") === "1"

    // Admins see all jobs; cleaners only see their assigned jobs
    const where: Record<string, unknown> =
      user.role === "ADMIN"
        ? { ...(status ? { status: status as never } : {}) }
        : { cleanerId: user.userId, ...(status ? { status: status as never } : {}) }

    // Archived jobs are past cleanings that were never finished. They stay in
    // the database but off every list unless asked for by name.
    where.archivedAt = archived ? { not: null } : null

    // upcoming=1: today onward, still-active jobs only — past never-completed
    // jobs would otherwise sort to the top of "Upcoming" lists forever
    if (upcoming) {
      const now = new Date()
      where.scheduledDate = { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }
      if (!status) where.status = { notIn: ["COMPLETED", "CANCELLED"] }
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        property: true,
        host: { select: { id: true, name: true, email: true, avatarUrl: true } },
        cleaner: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
        booking: true,
        checklistItems: { orderBy: { order: "asc" } },
      },
      // Archived jobs are history — newest first is the useful order there.
      orderBy: { scheduledDate: archived ? "desc" : "asc" },
      take: limit,
    })

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { propertyId, scheduledDate, notes, bookingId, cleanerId, silent } = body

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: { checklistTemplate: { include: { items: { orderBy: { order: "asc" } } } } },
    })
    if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 })

    // Use checklist template items if available, otherwise use defaults
    const checklistItems = buildChecklistItems(property)

    const created = await prisma.job.create({
      data: {
        propertyId,
        hostId: user.userId,
        scheduledDate: new Date(scheduledDate),
        duration: property.cleaningDuration,
        notes: notes || null,
        bookingId: bookingId || null,
        status: "UNASSIGNED",
        checklistItems: { create: checklistItems },
      },
    })

    // Assignment goes through the accept/decline flow unless the admin opted
    // into a silent backfill (no notifications, lands directly on ASSIGNED)
    if (cleanerId) {
      await assignCleanerToJob(created.id, cleanerId, { silent: silent === true })
    }

    const job = await prisma.job.findUnique({
      where: { id: created.id },
      include: {
        property: true,
        cleaner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        booking: true,
        checklistItems: { orderBy: { order: "asc" } },
      },
    })

    return NextResponse.json({ job }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
