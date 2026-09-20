import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyUser } from "@/lib/notify"
import { adminAlertEmail } from "@/lib/email"
import { closingSmsBody, closingEmailIntro } from "@/lib/closing-text"

// Manual "text the cleaner" from the job page.
//
// Deliberately calls notifyUser, NOT notifyCleaner — the cleaner-notification
// pause exists to stop AUTOMATED messages going out while the schedule is
// being set up. This is an admin pressing a button on purpose, so it sends.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { message } = await req.json().catch(() => ({ message: undefined }))

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        property: { select: { name: true, closingInstructions: true, supplyClosetCode: true } },
        cleaner: {
          select: {
            id: true, name: true, email: true, phone: true, carrier: true,
            emailNotifications: true, smsNotifications: true,
          },
        },
      },
    })

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    if (!job.cleaner) {
      return NextResponse.json({ error: "No cleaner is assigned to this job yet." }, { status: 400 })
    }

    // A typed message wins; otherwise send the property's closing list.
    const custom = typeof message === "string" && message.trim() ? message.trim() : null
    const body = custom
      ? `BDG Cleaning: ${custom}`
      : closingSmsBody(job)

    if (!body) {
      return NextResponse.json(
        { error: "This property has no before-you-leave list yet. Add one on the property page, or type a message." },
        { status: 400 }
      )
    }

    const result = await notifyUser(job.cleaner, {
      subject: custom ? `Message from Bailey Development Group` : `Before you leave — ${job.property?.name}`,
      emailHtml: adminAlertEmail({
        recipientName: job.cleaner.name.split(" ")[0],
        heading: custom ? "A Message About Your Cleaning" : "Before You Leave",
        intro: custom ?? closingEmailIntro(job),
        bullets: custom
          ? []
          : (job.property?.closingInstructions ?? "").split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean),
        tone: "info",
      }),
      smsBody: body,
    })

    await prisma.notification.create({
      data: {
        userId: job.cleaner.id,
        jobId: job.id,
        type: "GENERAL",
        title: custom ? "Message from Bailey Development Group" : `Before you leave — ${job.property?.name}`,
        message: custom ?? job.property?.closingInstructions ?? "",
      },
    })

    return NextResponse.json({
      sentTo: job.cleaner.name,
      emailSent: result.emailOk,
      smsSent: result.smsOk,
      problems: result.problems,
      preview: body,
    })
  } catch (error) {
    console.error("[jobs/text-cleaner]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
