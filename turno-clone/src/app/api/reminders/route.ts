import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Protected by CRON_SECRET — called by Vercel Cron every morning at 8 AM
// Can also be triggered manually: GET /api/reminders?secret=<CRON_SECRET>

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function hoursAgo(n: number) {
  return new Date(Date.now() - n * HOUR)
}
function hoursFromNow(n: number) {
  return new Date(Date.now() + n * HOUR)
}

// Dedup guard: skip if we already sent an identical notification to this user in the last 20 hours
async function alreadySent(userId: string, title: string): Promise<boolean> {
  const recent = await prisma.notification.findFirst({
    where: {
      userId,
      title,
      createdAt: { gte: hoursAgo(20) },
    },
  })
  return !!recent
}

export async function GET(req: NextRequest) {
  // Auth: Vercel sends Authorization: Bearer <CRON_SECRET>
  // Also allow ?secret= for manual triggers
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader = req.headers.get("authorization")
    const querySecret = new URL(req.url).searchParams.get("secret")
    if (authHeader !== `Bearer ${secret}` && querySecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const results = {
    supplyPending: 0,
    supplyOrderedBeforeJob: 0,
    unassignedJobsApproaching: 0,
    openIssuesStale: 0,
  }

  try {
    // ── 1. Supply requests PENDING for > 24 hours ──────────────────────────────
    const stalePending = await prisma.supplyRequest.findMany({
      where: {
        status: "PENDING",
        createdAt: { lte: hoursAgo(24) },
      },
      include: {
        property: { select: { name: true, hostId: true } },
        requestedBy: { select: { name: true } },
        job: { select: { id: true } },
      },
    })

    for (const req of stalePending) {
      const hostId = req.property?.hostId
      if (!hostId) continue
      const title = `Reminder: Supplies still needed — ${req.property?.name}`
      if (await alreadySent(hostId, title)) continue

      const items: string[] = (() => { try { return JSON.parse(req.items) } catch { return [] } })()
      const itemList = items.slice(0, 3).join(", ") + (items.length > 3 ? ` +${items.length - 3} more` : "")

      await prisma.notification.create({
        data: {
          userId: hostId,
          jobId: req.jobId,
          type: "GENERAL",
          title,
          message: `${req.requestedBy?.name ?? "Your cleaner"} requested supplies at ${req.property?.name} over 24 hours ago and they're still unordered: ${itemList}.`,
        },
      })
      results.supplyPending++
    }

    // ── 2. Supply ORDERED but next job at property is within 48 hours ──────────
    const orderedSupplies = await prisma.supplyRequest.findMany({
      where: { status: "ORDERED" },
      include: {
        property: {
          select: {
            name: true,
            hostId: true,
            jobs: {
              where: {
                scheduledDate: {
                  gte: new Date(),
                  lte: hoursFromNow(48),
                },
                status: { notIn: ["CANCELLED", "COMPLETED"] },
              },
              orderBy: { scheduledDate: "asc" },
              take: 1,
            },
          },
        },
        job: { select: { id: true } },
      },
    })

    for (const req of orderedSupplies) {
      const upcomingJob = req.property?.jobs?.[0]
      if (!upcomingJob) continue
      const hostId = req.property?.hostId
      if (!hostId) continue

      const title = `Supplies ordered — confirm delivery before next job at ${req.property?.name}`
      if (await alreadySent(hostId, title)) continue

      const scheduledDate = new Date(upcomingJob.scheduledDate)
      const dateStr = scheduledDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

      await prisma.notification.create({
        data: {
          userId: hostId,
          jobId: upcomingJob.id,
          type: "GENERAL",
          title,
          message: `Supplies are marked as ordered for ${req.property?.name}. Please confirm delivery before the cleaning on ${dateStr}.`,
        },
      })
      results.supplyOrderedBeforeJob++
    }

    // ── 3. Jobs UNASSIGNED within 72 hours ─────────────────────────────────────
    const unassignedSoon = await prisma.job.findMany({
      where: {
        status: "UNASSIGNED",
        scheduledDate: {
          gte: new Date(),
          lte: hoursFromNow(72),
        },
      },
      include: {
        property: { select: { name: true } },
        host: { select: { id: true } },
      },
    })

    for (const job of unassignedSoon) {
      const hostId = job.host?.id
      if (!hostId) continue
      const title = `Action needed: No cleaner assigned for ${job.property?.name}`
      if (await alreadySent(hostId, title)) continue

      const dateStr = new Date(job.scheduledDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

      await prisma.notification.create({
        data: {
          userId: hostId,
          jobId: job.id,
          type: "GENERAL",
          title,
          message: `The cleaning at ${job.property?.name} on ${dateStr} still has no cleaner assigned. Assign one now to keep your schedule on track.`,
        },
      })
      results.unassignedJobsApproaching++
    }

    // ── 4. Issue reports OPEN for > 48 hours ───────────────────────────────────
    const staleIssues = await prisma.issueReport.findMany({
      where: {
        status: "OPEN",
        createdAt: { lte: hoursAgo(48) },
      },
      include: {
        property: { select: { name: true, hostId: true } },
        reportedBy: { select: { name: true } },
        job: { select: { id: true } },
      },
    })

    for (const issue of staleIssues) {
      const hostId = issue.property?.hostId
      if (!hostId) continue
      const title = `Reminder: Open issue needs review at ${issue.property?.name}`
      if (await alreadySent(hostId, title)) continue

      await prisma.notification.create({
        data: {
          userId: hostId,
          jobId: issue.jobId,
          type: "GENERAL",
          title,
          message: `An issue reported by ${issue.reportedBy?.name ?? "your cleaner"} at ${issue.property?.name} has been open for over 48 hours. Please review it.`,
        },
      })
      results.openIssuesStale++
    }

    console.log("[reminders]", results)
    return NextResponse.json({ ok: true, ...results })
  } catch (error) {
    console.error("[reminders] error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
