import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { alertAdmins } from "@/lib/notify"
import { adminAlertEmail } from "@/lib/email"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
const DAY = 24 * 60 * 60 * 1000

// A cron endpoint must never be answered from a cache.
export const dynamic = "force-dynamic"

// Evening heads-up: what's on tomorrow. Sent the night before rather than the
// morning of, so there's still an evening to do something about it — call a
// cleaner, check supplies — instead of finding out an hour before checkout.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader = req.headers.get("authorization")
    const querySecret = new URL(req.url).searchParams.get("secret")
    if (authHeader !== `Bearer ${secret}` && querySecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const now = new Date()
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const tomorrowEnd = new Date(tomorrowStart.getTime() + DAY)

    const jobs = await prisma.job.findMany({
      where: {
        archivedAt: null,
        scheduledDate: { gte: tomorrowStart, lt: tomorrowEnd },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      include: {
        property: { select: { name: true, address: true, city: true, checkoutTime: true } },
        cleaner: { select: { name: true } },
      },
      orderBy: { scheduledDate: "asc" },
    })

    // Nothing tomorrow means nothing to say. A nightly "you have no cleanings"
    // text would train you to ignore the ones that matter.
    if (jobs.length === 0) {
      return NextResponse.json({ ok: true, tomorrowsCleanings: 0, sent: 0 })
    }

    const dateStr = tomorrowStart.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    const unstaffed = jobs.filter((j) => !j.cleanerId).length
    const n = jobs.length

    const lines = jobs.map((j) => {
      const where = [j.property?.address, j.property?.city].filter(Boolean).join(", ")
      const who = j.cleaner?.name ?? "NO CLEANER ASSIGNED"
      return `<b>${j.property?.name}</b> — ${where} — checkout ${j.property?.checkoutTime ?? "11:00 AM"} — ${who}`
    })
    const smsLines = jobs.map((j) => {
      const where = [j.property?.address, j.property?.city].filter(Boolean).join(", ")
      const who = j.cleaner?.name ?? "NO CLEANER"
      return `${j.property?.name} (${where}), checkout ${j.property?.checkoutTime ?? "11:00 AM"}, ${who}`
    })

    const summary = `${n} cleaning${n > 1 ? "s" : ""} scheduled for tomorrow, ${dateStr}${unstaffed ? ` — ${unstaffed} with nobody assigned` : ""}.`

    const sent = await alertAdmins({
      title: `Tomorrow's cleanings — ${dateStr}`,
      message: summary,
      dedupeWithinHours: 20,
      emailSubject: unstaffed
        ? `Tomorrow: ${unstaffed} cleaning${unstaffed > 1 ? "s" : ""} with no cleaner`
        : `Cleaning tomorrow — ${dateStr}`,
      emailHtml: (admin) =>
        adminAlertEmail({
          recipientName: admin.name,
          heading: `Tomorrow — ${dateStr}`,
          intro: summary,
          bullets: lines,
          ctaLabel: "Open the Schedule",
          ctaUrl: `${APP_URL}/jobs`,
          tone: unstaffed ? "action" : "info",
        }),
      smsBody: `BDG Cleaning tomorrow (${dateStr}): ${smsLines.join("; ")}.`,
    })

    console.log("[reminders/evening]", { tomorrowsCleanings: n, unstaffed, sent })
    return NextResponse.json({ ok: true, tomorrowsCleanings: n, unstaffed, sent })
  } catch (error) {
    console.error("[reminders/evening]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
