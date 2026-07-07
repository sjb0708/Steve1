import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { completeJob } from "@/lib/jobs"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const { completed } = await req.json()

    const item = await prisma.checklistItem.findUnique({
      where: { id },
      include: { job: true },
    })

    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

    // Cleaners can only update items on their own assigned jobs
    const canUpdate = user.role === "ADMIN" || item.job.cleanerId === user.userId
    if (!canUpdate) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const updated = await prisma.checklistItem.update({
      where: { id },
      data: { completed },
    })

    // Check if all items are completed — if so, auto-complete the job
    const allItems = await prisma.checklistItem.findMany({ where: { jobId: item.jobId } })
    const allDone = allItems.every((i) => (i.id === id ? completed : i.completed))

    if (allDone && item.job.status !== "COMPLETED") {
      // Shared helper: payment + admin notification, same as Mark Complete
      await completeJob(item.jobId)
    }

    return NextResponse.json({ item: updated, jobCompleted: allDone })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
