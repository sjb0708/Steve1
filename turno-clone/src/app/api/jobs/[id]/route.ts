import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { assignCleanerToJob, completeJob, isSameDayTurnover } from "@/lib/jobs"
import { format } from "date-fns"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        property: true,
        host: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
        cleaner: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true, location: true } },
        booking: true,
        checklistItems: { orderBy: { order: "asc" } },
      },
    })

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    const canAccess = user.role === "ADMIN" || job.cleanerId === user.userId
    if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Computed server-side (not a raw field) so both admin and cleaner views
    // show a correct, real turnover signal instead of guessing client-side
    const isTurnover = await isSameDayTurnover(job.propertyId, new Date(job.scheduledDate), job.bookingId)

    return NextResponse.json({ job: { ...job, isTurnover } })
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

    const existing = await prisma.job.findUnique({
      where: { id },
      include: {
        property: true,
        host: { select: { id: true, name: true, email: true } },
        cleaner: { select: { id: true, name: true, email: true } },
      },
    })
    if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    const canAccess = user.role === "ADMIN" || existing.cleanerId === user.userId
    if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const updateData: Record<string, unknown> = {}
    const isAssigning = user.role === "ADMIN" && body.cleanerId && body.cleanerId !== existing.cleanerId
    const isCompleting = body.markComplete === true || body.status === "COMPLETED"

    if (user.role === "ADMIN") {
      if (body.status !== undefined) updateData.status = body.status
      if (body.notes !== undefined) updateData.notes = body.notes
      if (body.scheduledDate !== undefined) updateData.scheduledDate = new Date(body.scheduledDate)

      // Unassigning a cleaner; assigning goes through assignCleanerToJob below
      if (body.cleanerId !== undefined && !body.cleanerId) {
        updateData.cleanerId = null
        updateData.status = "UNASSIGNED"
        updateData.actionToken = null
        updateData.actionTokenExpiry = null
      }
    }

    // Cleaners can start cleaning (ASSIGNED → IN_PROGRESS)
    if (user.role === "CLEANER") {
      if (body.status === "IN_PROGRESS" && existing.status === "ASSIGNED") {
        updateData.status = "IN_PROGRESS"
      }
    }

    // Completion and assignment run through shared helpers so side effects
    // (payment, token, notifications, email) are identical on every path
    if (isCompleting || isAssigning) delete updateData.status

    await prisma.job.update({ where: { id }, data: updateData })

    if (isCompleting) await completeJob(id)
    if (isAssigning) await assignCleanerToJob(id, body.cleanerId)

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        property: true,
        cleaner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        checklistItems: { orderBy: { order: "asc" } },
      },
    })

    // Notify admin if job was cancelled
    if (user.role === "ADMIN" && body.status === "CANCELLED" && existing.cleanerId) {
      await prisma.notification.create({
        data: {
          userId: existing.cleanerId,
          jobId: id,
          type: "JOB_CANCELLED",
          title: "Job Cancelled",
          message: `The cleaning job at ${existing.property?.name} on ${format(new Date(existing.scheduledDate), "MMM d")} has been cancelled.`,
        },
      })
    }

    return NextResponse.json({ job })
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
    const existing = await prisma.job.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    if (existing.cleanerId) {
      await prisma.notification.create({
        data: {
          userId: existing.cleanerId,
          jobId: id,
          type: "JOB_CANCELLED",
          title: "Job Cancelled",
          message: `A cleaning job scheduled for ${format(new Date(existing.scheduledDate), "MMM d")} has been cancelled.`,
        },
      })
    }

    await prisma.job.update({ where: { id }, data: { status: "CANCELLED" } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
