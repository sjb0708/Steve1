import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail, jobAcceptedEmail, jobDeclinedEmail, cleanerConfirmedEmail } from "@/lib/email"
import { format } from "date-fns"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

// Public, token-authenticated accept/decline — lets a cleaner respond straight
// from their email without an account or login. Tokens are single-use and
// expire the day after the scheduled cleaning.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const { action } = await req.json() // "ACCEPT" | "DECLINE"

    if (!token || token.length < 32) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 })
    }

    const job = await prisma.job.findUnique({
      where: { actionToken: token },
      include: {
        property: true,
        host: { select: { id: true, name: true, email: true, emailNotifications: true } },
        cleaner: { select: { id: true, name: true, email: true } },
      },
    })

    if (!job || job.status !== "PENDING_ACCEPTANCE" || !job.cleanerId) {
      return NextResponse.json({ error: "This link is no longer valid" }, { status: 404 })
    }
    if (job.actionTokenExpiry && job.actionTokenExpiry < new Date()) {
      return NextResponse.json({ error: "This link has expired" }, { status: 410 })
    }

    const dateStr = format(new Date(job.scheduledDate), "EEEE, MMMM d 'at' h:mm a")
    const jobUrl = `${APP_URL}/jobs/${job.id}`

    if (action === "ACCEPT") {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "ASSIGNED", actionToken: null, actionTokenExpiry: null },
      })

      await prisma.notification.create({
        data: {
          userId: job.hostId,
          jobId: job.id,
          type: "JOB_ACCEPTED",
          title: "Job Accepted ✓",
          message: `${job.cleaner?.name} has accepted the cleaning job at ${job.property?.name} on ${dateStr}.`,
        },
      })

      if (job.host?.emailNotifications && job.host.email) {
        await sendEmail({
          to: job.host.email,
          subject: `${job.cleaner?.name} accepted the job at ${job.property?.name}`,
          html: jobAcceptedEmail(job.host.name, job.cleaner?.name ?? "Cleaner", job.property?.name ?? "", dateStr, jobUrl),
        })
      }

      // Close the loop with the cleaner too — not just the admin
      await prisma.notification.create({
        data: {
          userId: job.cleanerId!,
          jobId: job.id,
          type: "JOB_ACCEPTED",
          title: "You're Confirmed ✓",
          message: `Thanks for confirming — you're on the schedule for ${job.property?.name} on ${dateStr}.`,
        },
      })
      if (job.cleaner?.email) {
        await sendEmail({
          to: job.cleaner.email,
          subject: `You're confirmed for ${job.property?.name} — ${dateStr}`,
          html: cleanerConfirmedEmail(job.cleaner.name, job.property?.name ?? "", dateStr, job.property?.checkoutTime ?? "11:00 AM"),
        })
      }

      return NextResponse.json({ status: "ASSIGNED" })
    }

    if (action === "DECLINE") {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "UNASSIGNED", cleanerId: null, actionToken: null, actionTokenExpiry: null },
      })

      await prisma.notification.create({
        data: {
          userId: job.hostId,
          jobId: job.id,
          type: "JOB_DECLINED",
          title: "Job Declined",
          message: `${job.cleaner?.name} declined the cleaning job at ${job.property?.name} on ${dateStr}. Please assign another cleaner.`,
        },
      })

      if (job.host?.emailNotifications && job.host.email) {
        await sendEmail({
          to: job.host.email,
          subject: `${job.cleaner?.name} declined the job at ${job.property?.name}`,
          html: jobDeclinedEmail(job.host.name, job.cleaner?.name ?? "Cleaner", job.property?.name ?? "", dateStr, jobUrl),
        })
      }

      return NextResponse.json({ status: "UNASSIGNED" })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
