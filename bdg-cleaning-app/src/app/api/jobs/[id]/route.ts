import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { assignCleanerToJob, completeJob, isSameDayTurnover, ensureJobForBooking } from "@/lib/jobs"
import { format } from "date-fns"

// After a job is cancelled, its booking still needs a cleaner unless the
// checkout already passed — recreate an UNASSIGNED job so it doesn't
// silently disappear from the calendar.
async function recreateJobIfBookingStillNeedsOne(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { property: { include: { checklistTemplate: { include: { items: true } } } } },
  })
  if (!booking || !booking.property) return
  await ensureJobForBooking(booking.property, booking)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        property: { include: { supplyItems: { orderBy: { order: "asc" } } } },
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
      include: { property: true },
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

      // Unassigning a cleaner; assigning goes through assignCleanerToJob below.
      // Stamping unassignedAt (rather than just relying on updatedAt) keeps a
      // clear "pulled off this job at X" record even after a new cleaner is
      // later assigned and updatedAt moves on.
      if (body.cleanerId !== undefined && !body.cleanerId) {
        updateData.cleanerId = null
        updateData.status = "UNASSIGNED"
        updateData.actionToken = null
        updateData.actionTokenExpiry = null
        updateData.unassignedAt = new Date()
      }
    }

    // Completion and assignment run through shared helpers so side effects
    // (payment, token, notifications, email) are identical on every path
    if (isCompleting || isAssigning) delete updateData.status

    await prisma.job.update({ where: { id }, data: updateData })

    if (isCompleting) await completeJob(id)
    if (isAssigning) await assignCleanerToJob(id, body.cleanerId, { silent: body.silent === true })

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        property: { include: { supplyItems: { orderBy: { order: "asc" } } } },
        cleaner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        checklistItems: { orderBy: { order: "asc" } },
      },
    })

    if (user.role === "ADMIN" && body.status === "CANCELLED") {
      // Notify the cleaner who was on it
      if (existing.cleanerId) {
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

      // The booking's checkout still needs a cleaner — cancelling the job
      // shouldn't make that checkout silently vanish from the calendar.
      if (existing.bookingId) {
        await recreateJobIfBookingStillNeedsOne(existing.bookingId)
      }
    }

    // Unassign (distinct from cancel): the job itself stays alive and open
    // for a new cleaner, we just notify whoever was pulled off it.
    const isUnassigning = user.role === "ADMIN" && body.cleanerId !== undefined && !body.cleanerId
    if (isUnassigning && existing.cleanerId) {
      await prisma.notification.create({
        data: {
          userId: existing.cleanerId,
          jobId: id,
          type: "JOB_CANCELLED",
          title: "Removed From Job",
          message: `You've been unassigned from the cleaning at ${existing.property?.name} on ${format(new Date(existing.scheduledDate), "MMM d")}. It's being reassigned to another cleaner.`,
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
    if (existing.bookingId) {
      await recreateJobIfBookingStillNeedsOne(existing.bookingId)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
