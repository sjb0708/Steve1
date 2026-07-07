import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail, issueReportedEmail } from "@/lib/email"

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const jobId = searchParams.get("jobId")

    const where: Record<string, unknown> = {}
    if (user.role === "CLEANER") where.reportedById = user.userId
    if (status) where.status = status
    if (jobId) where.jobId = jobId

    const issues = await prisma.issueReport.findMany({
      where,
      include: {
        job: { select: { id: true, scheduledDate: true } },
        property: { select: { id: true, name: true } },
        reportedBy: { select: { id: true, name: true, avatarUrl: true } },
        photos: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ issues })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { jobId, type, severity, description, photoUrls } = body

    if (!jobId || !type || !description) {
      return NextResponse.json({ error: "jobId, type, and description are required" }, { status: 400 })
    }

    // Verify the job belongs to this cleaner (or admin)
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        property: true,
        host: { select: { id: true, name: true, email: true, emailNotifications: true } },
      },
    })
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    if (user.role === "CLEANER" && job.cleanerId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const issue = await prisma.issueReport.create({
      data: {
        jobId,
        propertyId: job.propertyId,
        reportedById: user.userId,
        type,
        severity: severity ?? "MEDIUM",
        description,
        photos: {
          create: (photoUrls ?? []).map((url: string) => ({ url })),
        },
      },
      include: {
        photos: true,
        property: { select: { id: true, name: true } },
        reportedBy: { select: { id: true, name: true } },
      },
    })

    // Notify admin (host)
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const issueUrl = `${APP_URL}/issues/${issue.id}`
    const typeLabel = TYPE_LABELS[type] ?? type
    const severityLabel = SEVERITY_LABELS[severity ?? "MEDIUM"] ?? severity

    await prisma.notification.create({
      data: {
        userId: job.hostId,
        type: "GENERAL",
        title: `Issue Reported — ${job.property?.name}`,
        message: `${user.name} reported a ${severityLabel.toLowerCase()} severity issue (${typeLabel}) at ${job.property?.name}.`,
      },
    })

    if (job.host?.emailNotifications && job.host.email) {
      await sendEmail({
        to: job.host.email,
        subject: `Issue reported at ${job.property?.name}`,
        html: issueReportedEmail(
          job.host.name,
          user.name,
          job.property?.name ?? "",
          typeLabel,
          severityLabel,
          description,
          photoUrls ?? [],
          issueUrl
        ),
      })
    }

    return NextResponse.json({ issue }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const TYPE_LABELS: Record<string, string> = {
  DAMAGE: "Damage",
  BROKEN_ITEM: "Broken Item",
  STAIN: "Stain",
  PEST: "Pest",
  OTHER: "Other",
}

const SEVERITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
}
