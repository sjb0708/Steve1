import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { notifyCleaner } from "@/lib/notify"
import { adminAlertEmail } from "@/lib/email"
import { closingSmsBody, closingEmailIntro } from "@/lib/closing-text"

const DAY = 24 * 60 * 60 * 1000

export const dynamic = "force-dynamic"

// 2 PM on cleaning day: text the assigned cleaner the before-you-leave list
// for that property. Goes out while they're still on site, which is the only
// moment the reminder is actually useful.
//
// Respects the cleaner-notification pause (notifyCleaner checks it), so this
// stays silent along with everything else until that's switched off.
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
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dayEnd = new Date(dayStart.getTime() + DAY)

    const jobs = await prisma.job.findMany({
      where: {
        archivedAt: null,
        scheduledDate: { gte: dayStart, lt: dayEnd },
        cleanerId: { not: null },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      include: {
        property: { select: { name: true, closingInstructions: true, supplyClosetCode: true } },
        cleaner: { select: { name: true, email: true, phone: true, carrier: true, emailNotifications: true, smsNotifications: true } },
      },
    })

    let sent = 0
    let notDelivered = 0
    let skippedNoInstructions = 0
    const problems: string[] = []

    for (const job of jobs) {
      const smsBody = closingSmsBody(job)
      if (!smsBody) {
        skippedNoInstructions++
        continue
      }
      if (!job.cleaner) continue

      const result = await notifyCleaner(job.cleaner, {
        subject: `Before you leave — ${job.property?.name}`,
        emailHtml: adminAlertEmail({
          recipientName: job.cleaner.name.split(" ")[0],
          heading: "Before You Leave",
          intro: closingEmailIntro(job),
          bullets: (job.property?.closingInstructions ?? "")
            .split(/\r?\n|;/)
            .map((s) => s.trim())
            .filter(Boolean),
          tone: "info",
        }),
        smsBody,
      })

      await prisma.notification.create({
        data: {
          userId: job.cleanerId!,
          jobId: job.id,
          type: "GENERAL",
          title: `Before you leave — ${job.property?.name}`,
          message: job.property?.closingInstructions ?? "",
        },
      })

      // Only count it as sent if a channel actually carried it. Counting
      // attempts instead of deliveries is how "it said it sent" turns into
      // a cleaner who never got the message.
      if (result.emailOk || result.smsOk) {
        sent++
      } else {
        notDelivered++
        for (const p of result.problems) {
          const line = `${job.cleaner.name}: ${p}`
          if (!problems.includes(line)) problems.push(line)
        }
      }
    }

    const summary = { jobsToday: jobs.length, sent, notDelivered, skippedNoInstructions, problems }
    console.log("[reminders/closing]", summary)
    return NextResponse.json({ ok: true, ...summary })
  } catch (error) {
    console.error("[reminders/closing]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
