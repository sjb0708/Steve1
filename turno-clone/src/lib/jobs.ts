import crypto from "crypto"
import { format } from "date-fns"
import { prisma } from "@/lib/prisma"
import { sendEmail, jobAssignedEmail } from "@/lib/email"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export const DEFAULT_CHECKLIST = [
  { label: "Vacuum all floors", room: "General", order: 0, completed: false },
  { label: "Mop hard floors", room: "General", order: 1, completed: false },
  { label: "Empty all trash cans", room: "General", order: 2, completed: false },
  { label: "Clean bathrooms", room: "Bathroom", order: 3, completed: false },
  { label: "Replace towels and toiletries", room: "Bathroom", order: 4, completed: false },
  { label: "Make all beds with fresh linens", room: "Bedroom", order: 5, completed: false },
  { label: "Clean kitchen counters and appliances", room: "Kitchen", order: 6, completed: false },
  { label: "Final walkthrough", room: "General", order: 7, completed: false },
]

type PropertyWithTemplate = {
  id: string
  hostId: string
  cleaningDuration: number
  checklistTemplate: { items: { label: string; room: string | null; order: number }[] } | null
}

export function buildChecklistItems(property: PropertyWithTemplate) {
  return property.checklistTemplate && property.checklistTemplate.items.length > 0
    ? property.checklistTemplate.items.map((item) => ({
        label: item.label,
        room: item.room,
        order: item.order,
        completed: false,
      }))
    : DEFAULT_CHECKLIST
}

// Turnover automation: every synced booking with a future checkout gets a
// cleaning job at checkout time. Returns "created" | "rescheduled" | null.
export async function ensureJobForBooking(
  property: PropertyWithTemplate,
  booking: { id: string; checkOut: Date; guestName: string | null }
) {
  if (booking.checkOut <= new Date()) return null

  const existingJob = await prisma.job.findFirst({
    where: { bookingId: booking.id, status: { not: "CANCELLED" } },
  })

  if (!existingJob) {
    await prisma.job.create({
      data: {
        propertyId: property.id,
        hostId: property.hostId,
        bookingId: booking.id,
        scheduledDate: booking.checkOut,
        duration: property.cleaningDuration,
        status: "UNASSIGNED",
        notes: booking.guestName ? `Turnover after ${booking.guestName}'s stay (auto-created from calendar sync).` : "Auto-created from calendar sync.",
        checklistItems: { create: buildChecklistItems(property) },
      },
    })
    return "created"
  }

  // Booking dates moved — follow them unless the cleaning already started
  const movable = ["UNASSIGNED", "PENDING_ACCEPTANCE", "ASSIGNED"].includes(existingJob.status)
  if (movable && existingJob.scheduledDate.getTime() !== booking.checkOut.getTime()) {
    await prisma.job.update({
      where: { id: existingJob.id },
      data: { scheduledDate: booking.checkOut },
    })
    return "rescheduled"
  }

  return null
}

// True when another booking on this property checks in the same calendar
// day this job's booking checks out — the cleaner gets zero buffer, so the
// assignment message needs to say so up front, not bury it.
export async function isSameDayTurnover(propertyId: string, date: Date, excludeBookingId?: string | null) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  const incoming = await prisma.booking.findFirst({
    where: {
      propertyId,
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      checkIn: { gte: dayStart, lt: dayEnd },
    },
  })
  return !!incoming
}

// Single assignment path: sets PENDING_ACCEPTANCE, issues a one-click respond
// token, notifies + emails the cleaner. Used by job create AND reassign so the
// accept/decline step can never be bypassed.
export async function assignCleanerToJob(jobId: string, cleanerId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { property: { select: { name: true, checkoutTime: true } } },
  })
  if (!job) return

  const actionToken = crypto.randomBytes(24).toString("hex")
  // Token lives until the day after the scheduled cleaning
  const actionTokenExpiry = new Date(new Date(job.scheduledDate).getTime() + 24 * 60 * 60 * 1000)

  await prisma.job.update({
    where: { id: jobId },
    data: { cleanerId, status: "PENDING_ACCEPTANCE", actionToken, actionTokenExpiry },
  })

  // Date only, not date+time — Airbnb/VRBO calendar feeds only give a date for
  // checkout, so any "time" derived from the booking is a meaningless artifact.
  // The real checkout time is the property's own policy (checkoutTime).
  const dateStr = format(new Date(job.scheduledDate), "EEEE, MMMM d")
  const checkoutTime = job.property?.checkoutTime || "11:00 AM"
  const turnover = await isSameDayTurnover(job.propertyId, new Date(job.scheduledDate), job.bookingId)

  await prisma.notification.create({
    data: {
      userId: cleanerId,
      jobId,
      type: "JOB_ASSIGNED",
      title: "New Job — Action Required",
      message: `You've been assigned a cleaning job at ${job.property?.name} on ${dateStr}. Checkout: ${checkoutTime}.${turnover ? " ⚡ Same-day turnover — a new guest checks in today, so it needs a quick turnaround." : ""} Please accept or decline.`,
    },
  })

  const cleaner = await prisma.user.findUnique({ where: { id: cleanerId } })
  if (cleaner?.emailNotifications && cleaner.email) {
    await sendEmail({
      to: cleaner.email,
      subject: `New cleaning job at ${job.property?.name} — ${dateStr}${turnover ? " (same-day turnover)" : ""}`,
      html: jobAssignedEmail(
        cleaner.name,
        job.property?.name ?? "",
        dateStr,
        `${APP_URL}/jobs/${jobId}`,
        `${APP_URL}/respond/${actionToken}`,
        turnover,
        checkoutTime
      ),
    })
  }
}

// Single completion path: stamps COMPLETED, creates the Payment from the
// property's cleaning fee, and notifies the admin. Used by the Mark Complete
// button AND the checklist auto-complete so side effects stay consistent.
export async function completeJob(jobId: string) {
  const job = await prisma.job.update({
    where: { id: jobId },
    data: { status: "COMPLETED", completedAt: new Date(), actionToken: null, actionTokenExpiry: null },
    include: {
      property: { select: { name: true, cleaningFee: true } },
      cleaner: { select: { id: true, name: true } },
    },
  })

  if (job.cleanerId) {
    const existingPayment = await prisma.payment.findUnique({ where: { jobId } })
    if (!existingPayment && (job.property?.cleaningFee ?? 0) > 0) {
      await prisma.payment.create({
        data: {
          jobId,
          cleanerId: job.cleanerId,
          propertyId: job.propertyId,
          amount: job.property!.cleaningFee,
        },
      })
    }
  }

  await prisma.notification.create({
    data: {
      userId: job.hostId,
      jobId,
      type: "JOB_COMPLETED",
      title: "Job Completed ✓",
      message: `${job.cleaner?.name ?? "The cleaner"} completed the cleaning at ${job.property?.name} on ${format(new Date(), "MMM d 'at' h:mm a")}.`,
    },
  })

  return job
}
