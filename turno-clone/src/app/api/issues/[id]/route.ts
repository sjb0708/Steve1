import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const issue = await prisma.issueReport.findUnique({
      where: { id },
      include: {
        job: { select: { id: true, scheduledDate: true } },
        property: { select: { id: true, name: true, address: true, city: true, state: true } },
        reportedBy: { select: { id: true, name: true, avatarUrl: true, phone: true } },
        photos: true,
      },
    })

    if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const canAccess = user.role === "ADMIN" || issue.reportedById === user.userId
    if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    return NextResponse.json({ issue })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const issue = await prisma.issueReport.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
      },
      include: {
        photos: true,
        property: { select: { id: true, name: true } },
        reportedBy: { select: { id: true, name: true } },
        job: { select: { id: true, scheduledDate: true } },
      },
    })

    return NextResponse.json({ issue })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
