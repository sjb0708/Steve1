import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get("jobId")
    const status = searchParams.get("status")

    const where: Record<string, unknown> = {}
    if (user.role === "CLEANER") where.requestedById = user.userId
    if (jobId) where.jobId = jobId
    if (status) where.status = status

    const requests = await prisma.supplyRequest.findMany({
      where,
      include: {
        job: { select: { id: true, scheduledDate: true } },
        property: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ requests })
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
    const { jobId, items, notes } = body

    if (!jobId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "jobId and at least one item are required" }, { status: 400 })
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        property: { select: { name: true } },
        host: { select: { id: true, name: true, email: true, emailNotifications: true } },
      },
    })
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    // Cleaners can only request for jobs at their assigned property (or any job they're assigned to)
    if (user.role === "CLEANER" && job.cleanerId !== user.userId && job.hostId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const request = await prisma.supplyRequest.create({
      data: {
        jobId,
        propertyId: job.propertyId,
        requestedById: user.userId,
        items: JSON.stringify(items),
        notes: notes ?? null,
      },
      include: {
        property: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
      },
    })

    // Notify admin
    const itemList = items.slice(0, 3).join(", ") + (items.length > 3 ? `, +${items.length - 3} more` : "")
    await prisma.notification.create({
      data: {
        userId: job.hostId,
        jobId: job.id,
        type: "GENERAL",
        title: `Supplies Needed — ${job.property?.name}`,
        message: `${user.name} requested supplies at ${job.property?.name}: ${itemList}.`,
      },
    })

    return NextResponse.json({ request }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
