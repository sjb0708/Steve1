import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { notifyCleaner, alertAdmins } from "@/lib/notify"
import { archivePastJobs } from "@/lib/jobs"
import { jobReminderEmail, adminAlertEmail } from "@/lib/email"
import { alertHorizon, isMonthAheadLeadTime, nextMonthRange, MONTH_AHEAD_LEAD_DAYS } from "@/lib/alert-window"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

// A cron endpoint must never be answered from a cache — a cached 200 looks
// like a successful run while the sweeps never actually execute.
export const dynamic = "force-dynamic"

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
    jobsArchived: 0,
    supplyPending: 0,
    supplyOrderedBeforeJob: 0,
    unassignedJobsApproaching: 0,
    windowUnassigned: 0,
    openIssuesStale: 0,
    unstaffedToday: 0,
    monthAheadDigest: 0,
    cleanerUpcomingReminders: 0,
  }

  try {
    // ── 0. Archive yesterday's leftovers ───────────────────────────────────────
    // Runs first so the sweeps below never nag about a cleaning whose date
    // has already passed.
    results.jobsArchived = await archivePastJobs()

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
      const title = `Reminder: Supplies still needed — ${req.property?.name}`
      const items: string[] = (() => { try { return JSON.parse(req.items) } catch { return [] } })()
      const itemList = items.slice(0, 3).join(", ") + (items.length > 3 ? ` +${items.length - 3} more` : "")
      const who = req.requestedBy?.name ?? "Your cleaner"
      const message = `${who} requested supplies at ${req.property?.name} over 24 hours ago and they're still unordered: ${itemList}.`
      const url = `${APP_URL}/supply-requests`

      const sent = await alertAdmins({
        title,
        message,
        jobId: req.jobId,
        dedupeWithinHours: 20,
        emailHtml: (admin) =>
          adminAlertEmail({
            recipientName: admin.name,
            heading: "Supplies Still Needed",
            intro: message,
            details: [
              { label: "PROPERTY", value: req.property?.name ?? "" },
              { label: "REQUESTED BY", value: who },
              { label: "ITEMS", value: items.join(", ") || itemList },
            ],
            ctaLabel: "Order Supplies",
            ctaUrl: url,
            tone: "action",
          }),
        smsBody: `BDG Cleaning: supplies at ${req.property?.name} requested by ${who} are still unordered after 24h: ${itemList}. ${url}`,
      })
      if (sent) results.supplyPending++
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

      const title = `Supplies ordered — confirm delivery before next job at ${req.property?.name}`
      const scheduledDate = new Date(upcomingJob.scheduledDate)
      const dateStr = scheduledDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      const message = `Supplies are marked as ordered for ${req.property?.name}. Please confirm delivery before the cleaning on ${dateStr}.`
      const url = `${APP_URL}/supply-requests`

      const sent = await alertAdmins({
        title,
        message,
        jobId: upcomingJob.id,
        dedupeWithinHours: 20,
        emailHtml: (admin) =>
          adminAlertEmail({
            recipientName: admin.name,
            heading: "Confirm Supply Delivery",
            intro: message,
            details: [
              { label: "PROPERTY", value: req.property?.name ?? "" },
              { label: "NEXT CLEANING", value: dateStr },
            ],
            ctaLabel: "Review Supply Requests",
            ctaUrl: url,
            tone: "action",
          }),
        smsBody: `BDG Cleaning: supplies for ${req.property?.name} are marked ordered — confirm they arrived before the cleaning on ${dateStr}. ${url}`,
      })
      if (sent) results.supplyOrderedBeforeJob++
    }

    // ── 3. Jobs UNASSIGNED within 72 hours ─────────────────────────────────────
    // Starts at TOMORROW, not now — a cleaning today with nobody on it is
    // handled by the same-day check below, and covering both here would send
    // two texts about the identical problem in the same cron run.
    const tomorrowStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1)
    const unassignedSoon = await prisma.job.findMany({
      where: {
        status: "UNASSIGNED",
        archivedAt: null,
        scheduledDate: {
          gte: tomorrowStart,
          lte: hoursFromNow(72),
        },
      },
      include: {
        property: { select: { name: true } },
        host: { select: { id: true } },
      },
    })

    for (const job of unassignedSoon) {
      const title = `Action needed: No cleaner assigned for ${job.property?.name}`
      const scheduled = new Date(job.scheduledDate)
      const dateStr = scheduled.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      // Inside 24 hours this stops being a nudge and becomes the thing that
      // ruins a check-in, so it says so — in the subject line and the text.
      const urgent = scheduled.getTime() - Date.now() <= DAY
      const message = `The cleaning at ${job.property?.name} on ${dateStr} still has no cleaner assigned. Assign one now to keep your schedule on track.`
      const url = `${APP_URL}/jobs/${job.id}`

      const sent = await alertAdmins({
        title,
        message,
        jobId: job.id,
        dedupeWithinHours: 20,
        emailSubject: urgent
          ? `URGENT — cleaning tomorrow at ${job.property?.name} has no cleaner`
          : `Cleaning needed: no cleaner assigned at ${job.property?.name}`,
        emailHtml: (admin) =>
          adminAlertEmail({
            recipientName: admin.name,
            heading: urgent ? "Cleaning Needed — Urgent" : "Cleaning Needed",
            intro: urgent
              ? `The cleaning at <b>${job.property?.name}</b> is on ${dateStr} and still has nobody assigned.`
              : message,
            details: [
              { label: "PROPERTY", value: job.property?.name ?? "" },
              { label: "CLEANING DATE", value: dateStr },
              { label: "STATUS", value: "No cleaner assigned" },
            ],
            ctaLabel: "Assign a Cleaner",
            ctaUrl: url,
            tone: urgent ? "urgent" : "action",
          }),
        smsBody: `BDG Cleaning${urgent ? " URGENT" : ""}: cleaning needed at ${job.property?.name} on ${dateStr} — no cleaner assigned yet. Assign one: ${url}`,
      })
      if (sent) results.unassignedJobsApproaching++
    }

    // ── 3b. Unassigned, further out, but still inside the alert window ─────────
    // Section 3 above covers the next 72 hours and section 5 below covers next
    // month at lead time. Between them sat a silent gap: a cleaning that synced
    // weeks early got exactly ONE email — from the sync itself, the moment the
    // booking appeared — and then nothing at all until it was 72 hours away.
    // A single send that failed or got missed meant the cleaning stayed
    // unstaffed with no further word (BigHouse 2040 on Aug 18 went a week that
    // way). This re-nudges every third day for anything still unassigned inside
    // the window, so no cleaning depends on one message landing.
    //
    // One consolidated alert, not one per job, and a fixed title so the dedupe
    // actually matches across runs — a title carrying the count would change as
    // jobs get staffed and defeat it.
    const windowUnassigned = await prisma.job.findMany({
      where: {
        status: "UNASSIGNED",
        archivedAt: null,
        scheduledDate: { gt: hoursFromNow(72), lte: alertHorizon().end },
      },
      include: { property: { select: { name: true, checkoutTime: true } } },
      orderBy: { scheduledDate: "asc" },
    })

    if (windowUnassigned.length > 0) {
      const n = windowUnassigned.length
      const fmt = (d: Date) =>
        new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
      const lines = windowUnassigned.map(
        (j) =>
          `<b>${fmt(j.scheduledDate)}</b> — ${j.property?.name} — checkout ${j.property?.checkoutTime ?? "11:00 AM"}`
      )
      const smsLines = windowUnassigned.map((j) => `${fmt(j.scheduledDate)} — ${j.property?.name}`)
      const summary = `${n} upcoming cleaning${n > 1 ? "s" : ""} still ${n > 1 ? "have" : "has"} no cleaner assigned.`

      const sent = await alertAdmins({
        title: "Cleanings still need a cleaner",
        message: `${summary} ${smsLines.join("; ")}.`,
        dedupeWithinHours: 72,
        emailSubject: `${n} cleaning${n > 1 ? "s" : ""} still need${n > 1 ? "" : "s"} a cleaner`,
        emailHtml: (admin) =>
          adminAlertEmail({
            recipientName: admin.name,
            heading: "Cleaners Still Needed",
            intro: `${summary} There's still time to get ${n > 1 ? "them" : "it"} covered:`,
            bullets: lines,
            ctaLabel: "Assign a Cleaner",
            ctaUrl: `${APP_URL}/jobs?status=UNASSIGNED`,
            tone: "action",
          }),
        smsBody: `BDG Cleaning: ${summary} ${smsLines.slice(0, 4).join("; ")}${smsLines.length > 4 ? `; +${smsLines.length - 4} more` : ""}. Assign: ${APP_URL}/jobs`,
      })
      if (sent) results.windowUnassigned++
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
      const title = `Reminder: Open issue needs review at ${issue.property?.name}`
      const who = issue.reportedBy?.name ?? "your cleaner"
      const message = `An issue reported by ${who} at ${issue.property?.name} has been open for over 48 hours. Please review it.`
      const url = `${APP_URL}/issues/${issue.id}`

      const sent = await alertAdmins({
        title,
        message,
        jobId: issue.jobId,
        dedupeWithinHours: 20,
        emailHtml: (admin) =>
          adminAlertEmail({
            recipientName: admin.name,
            heading: "Open Issue Needs Review",
            intro: message,
            details: [
              { label: "PROPERTY", value: issue.property?.name ?? "" },
              { label: "REPORTED BY", value: who },
            ],
            ctaLabel: "Review Issue",
            ctaUrl: url,
            tone: "action",
          }),
        smsBody: `BDG Cleaning: the issue ${who} reported at ${issue.property?.name} has been open 48+ hours. ${url}`,
      })
      if (sent) results.openIssuesStale++
    }

    // ── 4b. Same-day exception check ───────────────────────────────────────────
    // The nightly 6 PM message (/api/reminders/evening) is the heads-up for
    // tomorrow, so there's deliberately NO routine morning rundown — it would
    // just repeat what was already sent. This only speaks up when something
    // changed overnight: a cleaning today that still has nobody on it.
    const dayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
    const dayEnd = new Date(dayStart.getTime() + DAY)

    const unstaffedToday = await prisma.job.findMany({
      where: {
        archivedAt: null,
        cleanerId: null,
        scheduledDate: { gte: dayStart, lt: dayEnd },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      include: { property: { select: { name: true, checkoutTime: true } } },
      orderBy: { scheduledDate: "asc" },
    })

    if (unstaffedToday.length > 0) {
      const dateStr = dayStart.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
      const n = unstaffedToday.length
      const lines = unstaffedToday.map(
        (j) => `<b>${j.property?.name}</b> — checkout ${j.property?.checkoutTime ?? "11:00 AM"}`
      )
      const summary = `${n} cleaning${n > 1 ? "s" : ""} today ${n > 1 ? "have" : "has"} nobody assigned.`

      const sent = await alertAdmins({
        title: `No cleaner for today — ${dateStr}`,
        message: summary,
        dedupeWithinHours: 20,
        emailSubject: `TODAY: ${n} cleaning${n > 1 ? "s" : ""} with no cleaner`,
        emailHtml: (admin) =>
          adminAlertEmail({
            recipientName: admin.name,
            heading: "No Cleaner for Today",
            intro: summary,
            bullets: lines,
            ctaLabel: "Assign a Cleaner",
            ctaUrl: `${APP_URL}/jobs?status=UNASSIGNED`,
            tone: "urgent",
          }),
        smsBody: `BDG Cleaning URGENT: ${summary} ${unstaffedToday.map((j) => j.property?.name).join("; ")}. ${APP_URL}/jobs`,
      })
      if (sent) results.unstaffedToday++
    }

    // ── 5. Month-ahead heads-up ────────────────────────────────────────────────
    // Bookings for next month sync weeks early and stay quiet (see
    // lib/alert-window.ts). Two weeks out from month end, next month's
    // unstaffed cleanings get one consolidated heads-up — after which the
    // daily sync alerts cover that month normally. Deduped over 20 days so it
    // lands once, not every morning for a fortnight. The title carries the
    // month name, so consecutive months can't suppress each other.
    if (isMonthAheadLeadTime()) {
      const { start, end, label } = nextMonthRange()
      const nextMonthUnassigned = await prisma.job.findMany({
        where: { status: "UNASSIGNED", scheduledDate: { gte: start, lte: end } },
        include: { property: { select: { name: true } } },
        orderBy: { scheduledDate: "asc" },
      })

      if (nextMonthUnassigned.length > 0) {
        const n = nextMonthUnassigned.length
        const title = `${label}: ${n} cleaning${n > 1 ? "s" : ""} need a cleaner`
        const lines = nextMonthUnassigned.map((job) => {
          const d = new Date(job.scheduledDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
          return `${d} — ${job.property?.name}`
        })
        const message = `${label} starts in under ${MONTH_AHEAD_LEAD_DAYS} days and ${n} cleaning${n > 1 ? "s have" : " has"} no cleaner assigned yet.`

        const sent = await alertAdmins({
          title,
          message,
          dedupeWithinHours: 20 * 24,
          emailSubject: `Next month's schedule — ${n} cleaning${n > 1 ? "s" : ""} to staff in ${label}`,
          emailHtml: (admin) =>
            adminAlertEmail({
              recipientName: admin.name,
              heading: `${label} — Cleaners Needed`,
              intro: `${message} Here's the full list so you can get ahead of it:`,
              bullets: lines,
              ctaLabel: "Assign Cleaners",
              ctaUrl: `${APP_URL}/jobs`,
              tone: "action",
            }),
          smsBody: `BDG Cleaning: ${n} cleaning${n > 1 ? "s" : ""} in ${label} still need a cleaner. ${lines.slice(0, 4).join("; ")}${lines.length > 4 ? `; +${lines.length - 4} more` : ""}. ${APP_URL}/jobs`,
        })
        if (sent) results.monthAheadDigest++
      }
    }

    // ── 6. Cleaner reminder: your cleaning is today/tomorrow ───────────────────
    // Covers accepted jobs (heads-up) AND still-pending offers (nudge to
    // respond). 36h window on a daily cron = each job reminds the day before
    // and again the morning of.
    const upcomingForCleaners = await prisma.job.findMany({
      where: {
        status: { in: ["ASSIGNED", "PENDING_ACCEPTANCE"] },
        cleanerId: { not: null },
        scheduledDate: { gte: new Date(), lte: hoursFromNow(36) },
      },
      include: {
        property: { select: { name: true, checkoutTime: true } },
        cleaner: true,
      },
    })

    for (const job of upcomingForCleaners) {
      if (!job.cleaner || !job.cleanerId) continue
      const pending = job.status === "PENDING_ACCEPTANCE"
      const dateStr = new Date(job.scheduledDate).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
      const checkoutTime = job.property?.checkoutTime || "11:00 AM"
      const title = pending
        ? `Please respond: cleaning at ${job.property?.name} on ${dateStr}`
        : `Upcoming cleaning: ${job.property?.name} on ${dateStr}`
      if (await alreadySent(job.cleanerId, title)) continue

      await prisma.notification.create({
        data: {
          userId: job.cleanerId,
          jobId: job.id,
          type: "GENERAL",
          title,
          message: pending
            ? `The cleaning offered to you at ${job.property?.name} on ${dateStr} is coming up and still needs your accept or decline.`
            : `Reminder: you have a cleaning at ${job.property?.name} on ${dateStr}. Checkout: ${checkoutTime}.`,
        },
      })

      const actionUrl = pending && job.actionToken
        ? `${APP_URL}/respond/${job.actionToken}`
        : `${APP_URL}/jobs/${job.id}`
      await notifyCleaner(job.cleaner, {
        subject: title,
        emailHtml: jobReminderEmail(job.cleaner.name, job.property?.name ?? "", dateStr, checkoutTime, pending, actionUrl),
        smsBody: pending
          ? `BDG Cleaning reminder: the job at ${job.property?.name} on ${dateStr} still needs your answer. Accept or decline: ${actionUrl}`
          : `BDG Cleaning reminder: you have a cleaning at ${job.property?.name} on ${dateStr}. Checkout ${checkoutTime}. Details: ${actionUrl}`,
      })
      results.cleanerUpcomingReminders++
    }

    console.log("[reminders]", results)
    return NextResponse.json({ ok: true, ...results })
  } catch (error) {
    console.error("[reminders] error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
